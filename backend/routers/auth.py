from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from database import get_db
from models import User, UserRole, Invite, InviteStatus
from schemas import UserCreate, UserResponse, Token, LoginRequest
from auth import (
    authenticate_user, 
    create_access_token, 
    get_password_hash,
    get_current_active_user
)
from config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=UserResponse)
def register_user(
    user: UserCreate, 
    db: Session = Depends(get_db),
    invite_token: str = Query(None, description="Invitation token")
):
    """Register a new user, optionally with an invitation token."""
    # Check if user already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Handle invitation token if provided
    user_role = UserRole.BUSINESS_OWNER  # Default role
    invite = None
    
    if invite_token:
        # Validate invitation token
        invite = db.query(Invite).filter(
            Invite.token == invite_token,
            Invite.status == InviteStatus.PENDING,
            Invite.expires_at > datetime.utcnow()
        ).first()
        
        if not invite:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired invitation token"
            )
        
        # Check if invitation email matches registration email
        if invite.email != user.email:
            raise HTTPException(
                status_code=400,
                detail="Registration email must match invitation email"
            )
        
        # Use role from invitation
        user_role = invite.role
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user_role
    )
    
    db.add(db_user)
    
    # Mark invitation as used if it was provided
    if invite:
        invite.status = InviteStatus.ACCEPTED
        invite.used_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email and password."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login-json", response_model=Token)
def login_json(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login with JSON payload."""
    user = authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return current_user


@router.post("/create-admin", response_model=UserResponse)
def create_admin_user(
    user: UserCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create admin user (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create admin users"
        )
    
    # Check if user already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create new admin user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        role=UserRole.ADMIN
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user 