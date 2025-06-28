from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import User, Business, PhoneNumber, ApiConfiguration, Settings, UserRole, PhoneNumberStatus
from schemas import (
    UserResponse, BusinessCreate, BusinessUpdate, BusinessResponse, 
    ApiConfigurationCreate, ApiConfigurationUpdate, ApiConfigurationResponse,
    SettingsCreate, SettingsUpdate, SettingsResponse,
    PhoneNumberResponse, DashboardResponse
)
from auth import get_current_active_user
from services.twilio_service import twilio_service
from config import settings
from sqlalchemy import func
from models import Call, CallType
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["me"])


def get_business_for_user(db: Session, current_user: User, business_id: Optional[int] = None) -> Business:
    """
    Get business for current user. Handles both business owners and admins.
    - Business owners: Returns their own business
    - Admins: Returns specified business (business_id) or raises error if not specified
    """
    if current_user.role == UserRole.ADMIN:
        if business_id is None:
            raise HTTPException(
                status_code=400,
                detail="Admin users must specify business_id parameter"
            )
        business = db.query(Business).filter(Business.id == business_id).first()
        if not business:
            raise HTTPException(
                status_code=404,
                detail=f"Business with ID {business_id} not found"
            )
        logger.info(f"Admin {current_user.email} accessing business '{business.name}' (ID: {business.id})")
        return business
    else:
        # Business owner - get their own business
        business = db.query(Business).filter(Business.owner_id == current_user.id).first()
        if not business:
            logger.warning(f"No business found for user {current_user.email} (ID: {current_user.id})")
            raise HTTPException(
                status_code=404,
                detail="No business found for current user"
            )
        logger.info(f"Business owner {current_user.email} accessing their business '{business.name}' (ID: {business.id})")
        return business


# User endpoints
@router.get("/", response_model=UserResponse)
def get_current_user(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return current_user


# Admin-specific endpoint to list all businesses
@router.get("/businesses", response_model=List[BusinessResponse])
def list_all_businesses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all businesses. Only available to admin users."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admin users can list all businesses"
        )
    
    logger.info(f"Admin {current_user.email} requesting list of all businesses")
    businesses = db.query(Business).all()
    logger.info(f"Found {len(businesses)} businesses for admin {current_user.email}")
    return businesses


# Business endpoints
@router.get("/business", response_model=BusinessResponse)
def get_my_business(
    business_id: Optional[int] = Query(None, description="Business ID (required for admin users)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get business information. Business owners get their own business, admins specify business_id."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) requesting business information")
    
    if current_user.role == UserRole.ADMIN and business_id is None:
        # For admins without business_id, return list of all businesses
        logger.info(f"Admin {current_user.email} requesting business info without business_id, redirecting to businesses list")
        raise HTTPException(
            status_code=400,
            detail="Admin users must specify business_id parameter or use /businesses endpoint"
        )
    
    business = get_business_for_user(db, current_user, business_id)
    return business


@router.post("/business", response_model=BusinessResponse)
def create_my_business(
    business: BusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new business for current user."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) attempting to create business")
    logger.info(f"Business details - Name: '{business.name}', Phone: {business.owner_phone}")
    
    if current_user.role != UserRole.BUSINESS_OWNER:
        logger.error(f"User {current_user.email} (ID: {current_user.id}) is not a business owner, cannot create business")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business owners can create businesses"
        )
    
    # Check if user already has a business
    existing_business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if existing_business:
        logger.warning(f"User {current_user.email} (ID: {current_user.id}) already has a business: '{existing_business.name}' (ID: {existing_business.id})")
        raise HTTPException(
            status_code=400,
            detail="User already has a business registered"
        )
    
    try:
        db_business = Business(
            **business.dict(),
            owner_id=current_user.id
        )
        
        db.add(db_business)
        db.commit()
        db.refresh(db_business)
        
        logger.info(f"Successfully created business '{db_business.name}' (ID: {db_business.id}) for user {current_user.email}")
        
        return db_business
        
    except Exception as e:
        logger.error(f"Failed to create business for user {current_user.email} (ID: {current_user.id}): {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create business"
        )


@router.put("/business", response_model=BusinessResponse)
def update_my_business(
    business_update: BusinessUpdate,
    business_id: Optional[int] = Query(None, description="Business ID (required for admin users)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update business information. Business owners update their own business, admins specify business_id."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) attempting to update business")
    
    business = get_business_for_user(db, current_user, business_id)
    
    logger.info(f"Updating business '{business.name}' (ID: {business.id}) for user {current_user.email}")
    
    try:
        # Update fields
        update_data = business_update.dict(exclude_unset=True)
        updated_fields = []
        for field, value in update_data.items():
            if hasattr(business, field) and getattr(business, field) != value:
                updated_fields.append(f"{field}: {getattr(business, field)} -> {value}")
                setattr(business, field, value)
        
        if updated_fields:
            logger.info(f"Business '{business.name}' (ID: {business.id}) fields updated: {', '.join(updated_fields)}")
        else:
            logger.info(f"No changes made to business '{business.name}' (ID: {business.id})")
        
        db.commit()
        db.refresh(business)
        
        logger.info(f"Successfully updated business '{business.name}' (ID: {business.id}) for user {current_user.email}")
        
        return business
        
    except Exception as e:
        logger.error(f"Failed to update business for user {current_user.email} (ID: {current_user.id}): {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update business"
        )


# API Configuration endpoints
@router.get("/config", response_model=ApiConfigurationResponse)
def get_my_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's API configuration."""
    business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if not business:
        raise HTTPException(
            status_code=404,
            detail="No business found for current user"
        )
    
    config = db.query(ApiConfiguration).filter(
        ApiConfiguration.business_id == business.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail="No API configuration found"
        )
    
    return config


@router.post("/config", response_model=ApiConfigurationResponse)
def create_my_config(
    config: ApiConfigurationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create API configuration for current user's business."""
    business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if not business:
        raise HTTPException(
            status_code=404,
            detail="No business found for current user"
        )
    
    # Check if business already has an API config
    existing_config = db.query(ApiConfiguration).filter(
        ApiConfiguration.business_id == business.id
    ).first()
    if existing_config:
        raise HTTPException(
            status_code=400,
            detail="API configuration already exists"
        )
    
    db_config = ApiConfiguration(
        business_id=business.id,
        openai_api_key=config.openai_api_key,
        custom_instructions=config.custom_instructions
    )
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.put("/config", response_model=ApiConfigurationResponse)
def update_my_config(
    config_update: ApiConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's API configuration."""
    business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if not business:
        raise HTTPException(
            status_code=404,
            detail="No business found for current user"
        )
    
    config = db.query(ApiConfiguration).filter(
        ApiConfiguration.business_id == business.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail="No API configuration found"
        )
    
    # Update fields
    update_data = config_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    return config


# Phone Number endpoints
@router.get("/phone-numbers", response_model=List[PhoneNumberResponse])
def get_my_phone_numbers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's phone numbers."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) requesting their phone numbers")
    
    business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if not business:
        logger.warning(f"No business found for user {current_user.email} (ID: {current_user.id})")
        return []
    
    phone_numbers = db.query(PhoneNumber).filter(
        PhoneNumber.business_id == business.id
    ).all()
    
    logger.info(f"Found {len(phone_numbers)} phone numbers for business '{business.name}' (ID: {business.id})")
    
    return phone_numbers


@router.post("/phone-numbers", response_model=PhoneNumberResponse)
def purchase_my_phone_number(
    phone_number: str,
    area_code: str,
    country: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Purchase a phone number for current user's business."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) attempting to purchase phone number: {phone_number}")
    logger.info(f"Purchase details - Area code: {area_code}, Country: {country}")
    
    business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if not business:
        logger.error(f"No business found for user {current_user.email} (ID: {current_user.id}) during phone number purchase")
        raise HTTPException(
            status_code=404,
            detail="No business found for current user"
        )
    
    logger.info(f"Found business '{business.name}' (ID: {business.id}) for phone number purchase")
    
    # Check if business already has a phone number
    existing_number = db.query(PhoneNumber).filter(
        PhoneNumber.business_id == business.id,
        PhoneNumber.status == PhoneNumberStatus.ACTIVE
    ).first()
    if existing_number:
        logger.warning(f"Business '{business.name}' (ID: {business.id}) already has an active phone number: {existing_number.phone_number}")
        raise HTTPException(
            status_code=400,
            detail="Business already has an active phone number"
        )
    
    # Validate phone number format
    original_phone_number = phone_number
    if not phone_number.startswith("+1"):
        phone_number = f"+1{phone_number.replace('-', '').replace('(', '').replace(')', '').replace(' ', '')}"
        logger.info(f"Formatted phone number from '{original_phone_number}' to '{phone_number}'")
    
    # Construct webhook URL
    webhook_url = f"{settings.webhook_base_url}/webhooks/twilio/incoming-call"
    logger.info(f"Using webhook URL: {webhook_url}")
    
    # Purchase number from Twilio
    logger.info(f"Initiating Twilio purchase for number {phone_number}")
    twilio_sid = twilio_service.purchase_phone_number(phone_number, webhook_url)
    if not twilio_sid:
        logger.error(f"Failed to purchase phone number {phone_number} from Twilio for business '{business.name}' (ID: {business.id})")
        raise HTTPException(
            status_code=400,
            detail="Failed to purchase phone number"
        )
    
    logger.info(f"Successfully purchased phone number {phone_number} from Twilio with SID: {twilio_sid}")
    
    # Verify the number exists in Twilio before saving to database
    logger.info(f"Verifying phone number {phone_number} (SID: {twilio_sid}) exists in Twilio")
    if not twilio_service.verify_phone_number_exists(twilio_sid):
        logger.error(f"Phone number {phone_number} (SID: {twilio_sid}) was purchased but not found in Twilio account")
        raise HTTPException(
            status_code=500,
            detail="Phone number was purchased but not found in Twilio account"
        )
    
    logger.info(f"Phone number {phone_number} (SID: {twilio_sid}) verification successful")
    
    # Save to database
    logger.info(f"Saving phone number {phone_number} to database for business '{business.name}' (ID: {business.id})")
    db_phone_number = PhoneNumber(
        phone_number=phone_number,
        twilio_sid=twilio_sid,
        area_code=area_code,
        country=country,
        business_id=business.id,
        status=PhoneNumberStatus.ACTIVE
    )
    
    try:
        db.add(db_phone_number)
        db.commit()
        db.refresh(db_phone_number)
        logger.info(f"Successfully saved phone number {phone_number} to database with ID: {db_phone_number.id}")
        logger.info(f"Phone number purchase completed successfully for business '{business.name}' - Number: {phone_number}, SID: {twilio_sid}")
    except Exception as e:
        logger.error(f"Failed to save phone number {phone_number} to database: {str(e)}")
        logger.error(f"Attempting to release number {twilio_sid} from Twilio due to database error")
        # Try to release the number from Twilio since database save failed
        try:
            twilio_service.release_phone_number(twilio_sid)
            logger.info(f"Successfully released phone number {twilio_sid} from Twilio after database error")
        except Exception as release_error:
            logger.error(f"Failed to release phone number {twilio_sid} from Twilio after database error: {str(release_error)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save phone number to database"
        )
    
    return db_phone_number


@router.delete("/phone-numbers/{phone_number_id}")
def release_my_phone_number(
    phone_number_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Release a phone number."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) attempting to release phone number ID: {phone_number_id}")
    
    business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if not business:
        logger.error(f"No business found for user {current_user.email} (ID: {current_user.id}) during phone number release")
        raise HTTPException(
            status_code=404,
            detail="No business found for current user"
        )
    
    logger.info(f"Found business '{business.name}' (ID: {business.id}) for phone number release")
    
    phone_number = db.query(PhoneNumber).filter(
        PhoneNumber.id == phone_number_id,
        PhoneNumber.business_id == business.id
    ).first()
    
    if not phone_number:
        logger.warning(f"Phone number ID {phone_number_id} not found for business '{business.name}' (ID: {business.id})")
        raise HTTPException(
            status_code=404,
            detail="Phone number not found"
        )
    
    logger.info(f"Found phone number {phone_number.phone_number} (SID: {phone_number.twilio_sid}) for release")
    
    # Release from Twilio
    logger.info(f"Releasing phone number {phone_number.phone_number} (SID: {phone_number.twilio_sid}) from Twilio")
    success = twilio_service.release_phone_number(phone_number.twilio_sid)
    if not success:
        logger.error(f"Failed to release phone number {phone_number.phone_number} (SID: {phone_number.twilio_sid}) from Twilio")
        raise HTTPException(
            status_code=400,
            detail="Failed to release phone number from Twilio"
        )
    
    logger.info(f"Successfully released phone number {phone_number.phone_number} (SID: {phone_number.twilio_sid}) from Twilio")
    
    # Update status in database instead of deleting
    try:
        phone_number.status = PhoneNumberStatus.INACTIVE
        db.commit()
        logger.info(f"Successfully updated phone number {phone_number.phone_number} status to INACTIVE in database")
        logger.info(f"Phone number release completed successfully for business '{business.name}' - Number: {phone_number.phone_number}")
    except Exception as e:
        logger.error(f"Failed to update phone number {phone_number.phone_number} status in database: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update phone number status in database"
        )
    
    return {"message": "Phone number released successfully"}


# Dashboard endpoint
@router.get("/dashboard", response_model=DashboardResponse)
def get_my_dashboard(
    business_id: Optional[int] = Query(None, description="Business ID (required for admin users)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dashboard data. Business owners get their own business data, admins specify business_id."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) requesting dashboard data")
    
    business = get_business_for_user(db, current_user, business_id)
    
    # Get call statistics
    total_calls = db.query(Call).filter(Call.business_id == business.id).count()
    human_calls = db.query(Call).filter(
        Call.business_id == business.id,
        Call.call_type == CallType.HUMAN
    ).count()
    ai_calls = db.query(Call).filter(
        Call.business_id == business.id,
        Call.call_type == CallType.AI
    ).count()
    
    # Calculate average duration and total cost
    avg_duration_result = db.query(func.avg(Call.duration_seconds)).filter(
        Call.business_id == business.id,
        Call.duration_seconds.isnot(None)
    ).scalar()
    
    total_cost_result = db.query(func.sum(Call.cost)).filter(
        Call.business_id == business.id,
        Call.cost.isnot(None)
    ).scalar()
    
    from schemas import CallSummary
    call_summary = CallSummary(
        total_calls=total_calls,
        human_calls=human_calls,
        ai_calls=ai_calls,
        average_duration=float(avg_duration_result or 0),
        total_cost=float(total_cost_result or 0)
    )
    
    # Get recent calls (last 10)
    recent_calls = db.query(Call).filter(
        Call.business_id == business.id
    ).order_by(Call.start_time.desc()).limit(10).all()
    
    logger.info(f"Retrieved dashboard data for business '{business.name}' (ID: {business.id})")
    return DashboardResponse(
        call_summary=call_summary,
        recent_calls=recent_calls,
        business=business
    )


# Settings endpoints
@router.get("/settings", response_model=SettingsResponse)
def get_my_settings(
    business_id: Optional[int] = Query(None, description="Business ID (required for admin users)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get business settings. Business owners get their own business settings, admins specify business_id."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) requesting their settings")
    
    business = get_business_for_user(db, current_user, business_id)
    
    settings_obj = db.query(Settings).filter(Settings.business_id == business.id).first()
    
    if not settings_obj:
        logger.info(f"No settings found for business '{business.name}' (ID: {business.id}), creating default settings")
        # Create default settings
        settings_obj = Settings(
            business_id=business.id,
            dashboard_layout="grid",
            theme="light",
            dashboard_refresh_interval=30,
            call_recording_enabled=True,
            call_forwarding_timeout=30,
            ai_takeover_delay=10,
            email_notifications=True,
            sms_notifications=False,
            timezone="UTC"
        )
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
        logger.info(f"Created default settings for business '{business.name}' (ID: {business.id})")
    
    logger.info(f"Retrieved settings for business '{business.name}' (ID: {business.id})")
    return settings_obj


@router.post("/settings", response_model=SettingsResponse)
def create_my_settings(
    settings_data: SettingsCreate,
    business_id: Optional[int] = Query(None, description="Business ID (required for admin users)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create settings for business. Business owners create for their own business, admins specify business_id."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) creating settings")
    
    business = get_business_for_user(db, current_user, business_id)
    
    # Check if settings already exist
    existing_settings = db.query(Settings).filter(Settings.business_id == business.id).first()
    if existing_settings:
        logger.warning(f"Settings already exist for business '{business.name}' (ID: {business.id})")
        raise HTTPException(
            status_code=400,
            detail="Settings already exist for this business"
        )
    
    try:
        settings_obj = Settings(
            business_id=business.id,
            **settings_data.dict()
        )
        
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
        
        logger.info(f"Successfully created settings for business '{business.name}' (ID: {business.id})")
        return settings_obj
        
    except Exception as e:
        logger.error(f"Failed to create settings for business '{business.name}': {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create settings"
        )


@router.put("/settings", response_model=SettingsResponse)
def update_my_settings(
    settings_update: SettingsUpdate,
    business_id: Optional[int] = Query(None, description="Business ID (required for admin users)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update business settings. Business owners update their own business settings, admins specify business_id."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) updating settings")
    
    business = get_business_for_user(db, current_user, business_id)
    
    settings_obj = db.query(Settings).filter(Settings.business_id == business.id).first()
    if not settings_obj:
        logger.error(f"No settings found for business '{business.name}' (ID: {business.id})")
        raise HTTPException(
            status_code=404,
            detail="Settings not found for this business"
        )
    
    try:
        # Update fields
        update_data = settings_update.dict(exclude_unset=True)
        updated_fields = []
        for field, value in update_data.items():
            if hasattr(settings_obj, field) and getattr(settings_obj, field) != value:
                updated_fields.append(f"{field}: {getattr(settings_obj, field)} -> {value}")
                setattr(settings_obj, field, value)
        
        if updated_fields:
            logger.info(f"Settings for business '{business.name}' (ID: {business.id}) fields updated: {', '.join(updated_fields)}")
        else:
            logger.info(f"No changes made to settings for business '{business.name}' (ID: {business.id})")
        
        db.commit()
        db.refresh(settings_obj)
        
        logger.info(f"Successfully updated settings for business '{business.name}' (ID: {business.id})")
        return settings_obj
        
    except Exception as e:
        logger.error(f"Failed to update settings for business '{business.name}': {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update settings"
        ) 