from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Business, UserRole
from schemas import BusinessCreate, BusinessUpdate, BusinessResponse
from auth import get_current_active_user

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.post("/", response_model=BusinessResponse)
def create_business(
    business: BusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new business (business owner only)."""
    if current_user.role != UserRole.BUSINESS_OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business owners can create businesses"
        )
    
    # Check if user already has a business
    existing_business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if existing_business:
        raise HTTPException(
            status_code=400,
            detail="User already has a business registered"
        )
    
    db_business = Business(
        **business.dict(),
        owner_id=current_user.id
    )
    
    db.add(db_business)
    db.commit()
    db.refresh(db_business)
    
    return db_business


@router.get("/", response_model=List[BusinessResponse])
def list_businesses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all businesses (admin) or current user's business (business owner)."""
    if current_user.role == UserRole.ADMIN:
        businesses = db.query(Business).offset(skip).limit(limit).all()
    else:
        businesses = db.query(Business).filter(Business.owner_id == current_user.id).all()
    
    return businesses


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific business."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and business.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this business"
        )
    
    return business


@router.put("/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: int,
    business_update: BusinessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a business."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and business.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this business"
        )
    
    # Update fields
    update_data = business_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(business, field, value)
    
    db.commit()
    db.refresh(business)
    
    return business


@router.delete("/{business_id}")
def delete_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a business (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete businesses"
        )
    
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Set business as inactive instead of deleting to preserve call history
    business.is_active = False
    db.commit()
    
    return {"message": "Business deactivated successfully"} 