# Call Assistant Setup Guide

This guide will help you set up the Call Assistant prototype on your local machine.

## Prerequisites

- Python 3.8+ 
- Node.js 16+
- PostgreSQL 12+
- Twilio Account
- OpenAI API Key

## Quick Setup

Run the setup script:
```bash
chmod +x setup.sh
./setup.sh
```

## Manual Setup

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.template .env
# Edit .env with your credentials
```

### 2. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE callassistant;
CREATE USER calluser WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE callassistant TO calluser;
```

Update your `.env` file:
```
DATABASE_URL=postgresql://calluser:password@localhost:5432/callassistant
```

### 3. Twilio Setup

1. Create a Twilio account at https://www.twilio.com
2. Get your Account SID and Auth Token from the console
3. Update your `.env` file:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
```

### 4. OpenAI Setup

1. Get an API key from https://platform.openai.com
2. Update your `.env` file:
```
OPENAI_API_KEY=your_openai_api_key
```

### 5. Frontend Setup

```bash
cd web

# Install dependencies
npm install

# Create .env.local file
cp .env.local.template .env.local
# Edit with your settings
```

## Running the Application

### Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

The API will be available at http://localhost:8000
API documentation at http://localhost:8000/docs

### Start Frontend
```bash
cd web
npm run dev
```

The web app will be available at http://localhost:3000

## Default Admin Account

- Email: admin@callassistant.com
- Password: admin123

**Change this in production!**

## Features Overview

### For Business Owners
1. **Registration**: Sign up and create a business profile
2. **Phone Number**: Purchase a Twilio phone number for your business
3. **OpenAI Configuration**: Add your OpenAI API key and customize AI instructions
4. **Dashboard**: View call analytics and recent calls

### For Admins
1. **Business Management**: View and manage all businesses
2. **User Management**: Create admin users
3. **System Overview**: Monitor system-wide metrics

## Call Flow

1. Customer calls your business number
2. System attempts to connect to business owner
3. If owner unavailable, call routes to AI agent
4. All calls are recorded for analysis
5. Call data is stored for training and analytics

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register business owner
- `POST /api/auth/login-json` - Login
- `GET /api/auth/me` - Get current user

### Business Management
- `POST /api/businesses/` - Create business
- `GET /api/businesses/my` - Get my business
- `GET /api/businesses/my/dashboard` - Get dashboard data

### Phone Numbers
- `GET /api/phone-numbers/search` - Search available numbers
- `POST /api/phone-numbers/purchase` - Purchase number
- `GET /api/phone-numbers/` - List my numbers

### API Configuration
- `POST /api/api-configs/` - Create OpenAI config
- `GET /api/api-configs/my` - Get my config
- `PUT /api/api-configs/my` - Update config

### Webhooks (Twilio)
- `POST /webhooks/twilio/incoming-call` - Handle incoming calls
- `POST /webhooks/twilio/call-status` - Handle call status updates
- `POST /webhooks/twilio/recording-complete` - Handle recording completion

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL in .env
   - Verify database exists and user has permissions

2. **Twilio Webhook Issues**
   - Use ngrok for local development: `ngrok http 8000`
   - Update webhook URLs in Twilio console
   - Check Twilio credentials

3. **OpenAI API Errors**
   - Verify API key is valid
   - Check OpenAI account has credits
   - Ensure agents library is properly installed

4. **Frontend Build Issues**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility

### Logs

Backend logs are available in the console when running with `--reload`
Frontend logs are in the browser console and terminal

## Production Deployment

### Security Checklist
- [ ] Change default admin password
- [ ] Use strong JWT secret
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Use environment-specific database
- [ ] Set up proper logging
- [ ] Configure rate limiting

### Environment Variables
Set these in production:
```
ENVIRONMENT=production
DATABASE_URL=your_production_db_url
JWT_SECRET_KEY=strong_random_secret
CORS_ORIGINS=["https://yourdomain.com"]
```

## Development

### Adding New Features

1. **Backend**: Add routes in `backend/routers/`
2. **Database**: Update models in `backend/models.py`
3. **Frontend**: Add pages in `web/src/app/`
4. **API Client**: Update `web/src/lib/api.ts`

### Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd web
npm test
```

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation at http://localhost:8000/docs
3. Check logs for error details 