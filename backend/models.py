from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(enum.Enum):
    ADMIN = "admin"
    BUSINESS_OWNER = "business_owner"


class CallType(enum.Enum):
    HUMAN = "human"
    AI = "ai"


class CallStatus(enum.Enum):
    RINGING = "ringing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    NO_ANSWER = "no_answer"


class PhoneNumberStatus(enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class InviteStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    businesses = relationship("Business", back_populates="owner")


class Invite(Base):
    __tablename__ = "invites"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(Enum(UserRole), default=UserRole.BUSINESS_OWNER, nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(Enum(InviteStatus), default=InviteStatus.PENDING, nullable=False)
    invited_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    invited_by = relationship("User", foreign_keys=[invited_by_id])


class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    
    # UI/Display Settings
    dashboard_layout = Column(String(20), default="grid")  # "grid", "list", "compact"
    theme = Column(String(20), default="light")  # "light", "dark", "auto"
    dashboard_refresh_interval = Column(Integer, default=30)  # seconds
    
    # Call Settings
    call_recording_enabled = Column(Boolean, default=True)
    call_forwarding_timeout = Column(Integer, default=30)  # seconds
    ai_takeover_delay = Column(Integer, default=10)  # seconds before AI takes over
    
    # Notification Settings
    email_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=False)
    notification_email = Column(String(255))
    notification_phone = Column(String(20))
    
    # Business Hours (JSON format for flexibility)
    business_hours = Column(Text)  # JSON: {"mon": {"open": "09:00", "close": "17:00"}, ...}
    timezone = Column(String(50), default="UTC")
    
    # Advanced Settings
    custom_greeting = Column(Text)
    holiday_message = Column(Text)
    after_hours_message = Column(Text)
    
    # Integration Settings
    webhook_url = Column(String(500))
    webhook_secret = Column(String(255))
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    business = relationship("Business", back_populates="settings")


class Business(Base):
    __tablename__ = "businesses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner_phone = Column(String(20), nullable=False)  # Business owner's phone number
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="businesses")
    phone_numbers = relationship("PhoneNumber", back_populates="business")
    api_configs = relationship("ApiConfiguration", back_populates="business")
    settings = relationship("Settings", back_populates="business", uselist=False)
    calls = relationship("Call", back_populates="business")


class PhoneNumber(Base):
    __tablename__ = "phone_numbers"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), unique=True, nullable=False)
    twilio_sid = Column(String(255), unique=True, nullable=False)
    area_code = Column(String(10), nullable=False)
    country = Column(String(2), nullable=False)  # US or CA
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    status = Column(Enum(PhoneNumberStatus), default=PhoneNumberStatus.ACTIVE)
    monthly_cost = Column(Float, default=1.00)  # USD
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    business = relationship("Business", back_populates="phone_numbers")
    calls = relationship("Call", back_populates="phone_number")


class ApiConfiguration(Base):
    __tablename__ = "api_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    openai_api_key = Column(String(255), nullable=False)
    custom_instructions = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    business = relationship("Business", back_populates="api_configs")


class Call(Base):
    __tablename__ = "calls"
    
    id = Column(Integer, primary_key=True, index=True)
    twilio_call_sid = Column(String(255), unique=True, nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    phone_number_id = Column(Integer, ForeignKey("phone_numbers.id"), nullable=False)
    caller_number = Column(String(20), nullable=False)
    call_type = Column(Enum(CallType), nullable=False)
    status = Column(Enum(CallStatus), nullable=False)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    call_summary = Column(Text)
    recording_url = Column(String(500))
    recording_sid = Column(String(255))
    cost = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    business = relationship("Business", back_populates="calls")
    phone_number = relationship("PhoneNumber", back_populates="calls")


class CallEvent(Base):
    __tablename__ = "call_events"
    
    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # answered, forwarded, ai_takeover, etc.
    event_data = Column(Text)  # JSON data
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    call = relationship("Call") 