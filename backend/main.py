from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from database import engine, Base
from config import settings
from routers import auth, businesses, phone_numbers, webhooks
from models import User, UserRole
from auth import get_password_hash
from database import SessionLocal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting Call Assistant API...")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    
    # Create default admin user if it doesn't exist
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin_user:
            logger.info("Creating default admin user...")
            admin_user = User(
                email="admin@callassistant.com",
                hashed_password=get_password_hash("admin123"),
                first_name="Admin",
                last_name="User",
                role=UserRole.ADMIN
            )
            db.add(admin_user)
            db.commit()
            logger.info("Default admin user created: admin@callassistant.com / admin123")
    finally:
        db.close()
    
    yield
    
    # Shutdown
    logger.info("Shutting down Call Assistant API...")


# Create FastAPI app
app = FastAPI(
    title="Call Assistant API",
    description="API for managing business call routing and AI voice agents",
    version="1.0.0",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure this properly in production
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(businesses.router, prefix="/api")
app.include_router(phone_numbers.router, prefix="/api")
app.include_router(webhooks.router)

# Import admin router
from routers import admin
app.include_router(admin.router)

# Import new me router
from routers import me
app.include_router(me.router, prefix="/api")

# Root endpoint
@app.get("/")
def read_root():
    """Root endpoint with API information."""
    return {
        "message": "Call Assistant API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "environment": settings.environment}


# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Resource not found"}
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )


# Lambda handler using mangum
try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    # mangum not available in development
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development"
    )