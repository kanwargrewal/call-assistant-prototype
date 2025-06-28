from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from database import get_db
from models import User, UserRole, Business, Invite, InviteStatus
from auth import get_current_admin_user
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class InviteRequest:
    def __init__(self, email: str, role: str = "business_owner"):
        self.email = email
        self.role = role


@router.post("/invite")
async def invite_user(
    background_tasks: BackgroundTasks,
    email: str,
    role: str = "business_owner",
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Send an invitation email to a new user
    """
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists"
            )
        
        # Check if there's already a pending invite
        existing_invite = db.query(Invite).filter(
            Invite.email == email,
            Invite.status == InviteStatus.PENDING,
            Invite.expires_at > datetime.utcnow()
        ).first()
        
        if existing_invite:
            raise HTTPException(
                status_code=400,
                detail="Invite already sent to this email"
            )
        
        # Convert role string to enum
        role_enum = UserRole.BUSINESS_OWNER if role == "business_owner" else UserRole.ADMIN
        
        # Create new invite
        invite_token = str(uuid.uuid4())
        invite = Invite(
            email=email,
            role=role_enum,
            token=invite_token,
            invited_by_id=current_admin.id,
            expires_at=datetime.utcnow() + timedelta(days=7)  # 7 days expiry
        )
        
        db.add(invite)
        db.commit()
        
        # Send email in background
        background_tasks.add_task(
            send_invite_email,
            email=email,
            invite_token=invite_token,
            inviter_name=f"{current_admin.first_name} {current_admin.last_name}"
        )
        
        return {
            "message": "Invitation sent successfully",
            "email": email,
            "expires_at": invite.expires_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending invite: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send invitation"
        )


@router.get("/invites")
async def get_invites(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all invites with their status
    """
    invites = db.query(Invite).order_by(Invite.created_at.desc()).all()
    
    return [
        {
            "id": invite.id,
            "email": invite.email,
            "role": invite.role.value,  # Convert enum to string
            "status": invite.status.value,  # Convert enum to string
            "created_at": invite.created_at,
            "expires_at": invite.expires_at,
            "invited_by": f"{invite.invited_by.first_name} {invite.invited_by.last_name}",
            "used_at": invite.used_at
        }
        for invite in invites
    ]


@router.get("/validate-invite/{token}")
async def validate_invite(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Validate an invite token and return invite details
    """
    invite = db.query(Invite).filter(
        Invite.token == token,
        Invite.status == InviteStatus.PENDING,
        Invite.expires_at > datetime.utcnow()
    ).first()
    
    if not invite:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired invitation"
        )
    
    return {
        "email": invite.email,
        "role": invite.role.value,  # Convert enum to string
        "expires_at": invite.expires_at
    }


def send_invite_email(email: str, invite_token: str, inviter_name: str):
    """
    Send invitation email using SMTP
    """
    try:
        # Email configuration
        smtp_server = getattr(settings, 'smtp_server', 'smtp.gmail.com')
        smtp_port = getattr(settings, 'smtp_port', 587)
        smtp_username = getattr(settings, 'smtp_username', None)
        smtp_password = getattr(settings, 'smtp_password', None)
        
        if not smtp_username or not smtp_password:
            logger.warning("SMTP credentials not configured, skipping email send")
            return
        
        # Create message using the direct imports
        msg = MIMEMultipart()
        msg['From'] = smtp_username
        msg['To'] = email
        msg['Subject'] = "You're Invited to Join Call Assistant"
        
        # Email body
        registration_url = f"{getattr(settings, 'frontend_url', 'http://localhost:3000')}/register?invite={invite_token}"
        
        print(registration_url)
        body = f"""
        <html>
        <body>
            <h2>You're Invited to Call Assistant!</h2>
            <p>Hi there,</p>
            <p>{inviter_name} has invited you to join Call Assistant - an AI-powered call routing platform for businesses.</p>
            
            <h3>What's Call Assistant?</h3>
            <ul>
                <li>🤖 AI-powered voice agents for your business calls</li>
                <li>📞 Smart call routing - AI first, then to you</li>
                <li>📊 Call analytics and summaries</li>
                <li>💰 Cost-effective customer service</li>
            </ul>
            
            <p><strong>Ready to get started?</strong></p>
            <p><a href="{registration_url}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation & Sign Up</a></p>
            
            <p>This invitation expires in 7 days.</p>
            
            <p>If you have any questions, feel free to reply to this email.</p>
            
            <p>Best regards,<br>The Call Assistant Team</p>
            
            <hr>
            <p style="font-size: 12px; color: #666;">
                If the button doesn't work, copy and paste this link: {registration_url}
            </p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        text = msg.as_string()
        server.sendmail(smtp_username, email, text)
        server.quit()
        
        logger.info(f"Invitation email sent to {email}")
        
    except Exception as e:
        logger.error(f"Failed to send email to {email}: {e}")


@router.delete("/invites/{invite_id}")
async def cancel_invite(
    invite_id: int,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a pending invite
    """
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite.status != InviteStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only cancel pending invites")
    
    invite.status = InviteStatus.CANCELLED
    db.commit()
    
    return {"message": "Invite cancelled successfully"}


@router.get("/statistics")
async def get_admin_statistics(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get admin dashboard statistics
    """
    total_users = db.query(User).count()
    total_businesses = db.query(Business).count()
    active_businesses = db.query(Business).filter(Business.is_active == True).count()
    pending_invites = db.query(Invite).filter(Invite.status == InviteStatus.PENDING).count()
    
    return {
        "total_users": total_users,
        "total_businesses": total_businesses,
        "active_businesses": active_businesses,
        "inactive_businesses": total_businesses - active_businesses,
        "pending_invites": pending_invites
    } 