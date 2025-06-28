from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
from database import get_db
from models import User, PhoneNumber, UserRole
from auth import get_current_active_user
from services.twilio_service import twilio_service
from config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/phone-numbers", tags=["phone numbers"])


@router.get("/search")
def search_available_numbers(
    area_code: str,
    country: str = "US",
    current_user: User = Depends(get_current_active_user)
) -> List[Dict]:
    """Search for available phone numbers in a specific area code."""
    logger.info(f"User {current_user.email} (ID: {current_user.id}) searching for phone numbers")
    logger.info(f"Search parameters - Area code: {area_code}, Country: {country}")
    
    if country not in ["US", "CA"]:
        logger.warning(f"Invalid country '{country}' provided by user {current_user.email}")
        raise HTTPException(
            status_code=400,
            detail="Country must be 'US' or 'CA'"
        )
    
    if len(area_code) != 3 or not area_code.isdigit():
        logger.warning(f"Invalid area code '{area_code}' provided by user {current_user.email}")
        raise HTTPException(
            status_code=400,
            detail="Area code must be 3 digits"
        )
    
    logger.info(f"Searching Twilio for available numbers in area code {area_code}, country {country}")
    available_numbers = twilio_service.search_available_numbers(area_code, country)
    
    if not available_numbers:
        logger.warning(f"No available numbers found for area code {area_code} in {country}")
        raise HTTPException(
            status_code=404,
            detail=f"No available numbers found for area code {area_code} in {country}"
        )
    
    logger.info(f"Found {len(available_numbers)} available phone numbers for area code {area_code} in {country}")
    logger.debug(f"Available numbers: {[num['phone_number'] for num in available_numbers]}")
    
    return available_numbers


@router.get("/debug/twilio-numbers")
def debug_twilio_numbers(
    current_user: User = Depends(get_current_active_user)
):
    """Debug endpoint to list all Twilio phone numbers (admin only)."""
    logger.info(f"Admin user {current_user.email} (ID: {current_user.id}) accessing debug endpoint for Twilio numbers")
    
    if current_user.role != UserRole.ADMIN:
        logger.warning(f"Non-admin user {current_user.email} (ID: {current_user.id}) attempted to access debug endpoint")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access debug endpoints"
        )
    
    logger.info("Fetching all Twilio phone numbers for debug")
    result = {
        "twilio_numbers": twilio_service.list_twilio_phone_numbers(),
        "webhook_base_url": settings.webhook_base_url
    }
    
    logger.info(f"Debug endpoint returned {len(result['twilio_numbers'])} Twilio phone numbers")
    
    return result 