from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import UserRole, CallType, CallStatus, PhoneNumberStatus


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str


class UserCreate(UserBase):
    password: str
    role: Optional[UserRole] = None  # Optional, will be set from invitation or default


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Business Schemas
class BusinessBase(BaseModel):
    name: str
    description: Optional[str] = None
    owner_phone: str


class BusinessCreate(BusinessBase):
    pass


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner_phone: Optional[str] = None
    is_active: Optional[bool] = None


class BusinessResponse(BusinessBase):
    id: int
    owner_id: int
    is_active: bool
    created_at: datetime
    owner: UserResponse
    
    class Config:
        from_attributes = True


# Phone Number Schemas
class PhoneNumberBase(BaseModel):
    area_code: str
    country: str


class PhoneNumberCreate(PhoneNumberBase):
    business_id: int


class PhoneNumberResponse(PhoneNumberBase):
    id: int
    phone_number: str
    twilio_sid: str
    business_id: int
    status: PhoneNumberStatus
    monthly_cost: float
    created_at: datetime
    
    class Config:
        from_attributes = True


# API Configuration Schemas
class ApiConfigurationBase(BaseModel):
    openai_api_key: str
    custom_instructions: Optional[str] = None


class ApiConfigurationCreate(ApiConfigurationBase):
    pass  # business_id will be determined from current user


class ApiConfigurationUpdate(BaseModel):
    openai_api_key: Optional[str] = None
    custom_instructions: Optional[str] = None
    is_active: Optional[bool] = None


class ApiConfigurationResponse(ApiConfigurationBase):
    id: int
    business_id: int
    is_active: bool
    created_at: datetime
    # Hide the actual API key in responses
    openai_api_key: str = "***hidden***"
    
    class Config:
        from_attributes = True


# Settings Schemas
class SettingsBase(BaseModel):
    # UI/Display Settings
    dashboard_layout: Optional[str] = "grid"
    theme: Optional[str] = "light"
    dashboard_refresh_interval: Optional[int] = 30
    
    # Call Settings
    call_recording_enabled: Optional[bool] = True
    call_forwarding_timeout: Optional[int] = 30
    ai_takeover_delay: Optional[int] = 10
    
    # Notification Settings
    email_notifications: Optional[bool] = True
    sms_notifications: Optional[bool] = False
    notification_email: Optional[str] = None
    notification_phone: Optional[str] = None
    
    # Business Hours & Timezone
    business_hours: Optional[str] = None  # JSON string
    timezone: Optional[str] = "UTC"
    
    # Advanced Settings
    custom_greeting: Optional[str] = None
    holiday_message: Optional[str] = None
    after_hours_message: Optional[str] = None
    
    # Integration Settings
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None


class SettingsCreate(SettingsBase):
    pass


class SettingsUpdate(BaseModel):
    # UI/Display Settings
    dashboard_layout: Optional[str] = None
    theme: Optional[str] = None
    dashboard_refresh_interval: Optional[int] = None
    
    # Call Settings
    call_recording_enabled: Optional[bool] = None
    call_forwarding_timeout: Optional[int] = None
    ai_takeover_delay: Optional[int] = None
    
    # Notification Settings
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    notification_email: Optional[str] = None
    notification_phone: Optional[str] = None
    
    # Business Hours & Timezone
    business_hours: Optional[str] = None
    timezone: Optional[str] = None
    
    # Advanced Settings
    custom_greeting: Optional[str] = None
    holiday_message: Optional[str] = None
    after_hours_message: Optional[str] = None
    
    # Integration Settings
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    is_active: Optional[bool] = None


class SettingsResponse(SettingsBase):
    id: int
    business_id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Call Schemas
class CallBase(BaseModel):
    caller_number: str


class CallCreate(CallBase):
    twilio_call_sid: str
    business_id: int
    phone_number_id: int
    call_type: CallType
    status: CallStatus


class CallUpdate(BaseModel):
    status: Optional[CallStatus] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    call_summary: Optional[str] = None
    recording_url: Optional[str] = None
    recording_sid: Optional[str] = None
    cost: Optional[float] = None


class CallResponse(CallBase):
    id: int
    twilio_call_sid: str
    business_id: int
    phone_number_id: int
    call_type: CallType
    status: CallStatus
    start_time: datetime
    end_time: Optional[datetime]
    duration_seconds: Optional[int]
    call_summary: Optional[str]
    recording_url: Optional[str]
    cost: Optional[float]
    
    class Config:
        from_attributes = True


# Authentication Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Dashboard Schemas
class CallSummary(BaseModel):
    total_calls: int
    human_calls: int
    ai_calls: int
    average_duration: float
    total_cost: float


class DashboardResponse(BaseModel):
    call_summary: CallSummary
    recent_calls: List[CallResponse]
    business: BusinessResponse 