# Call Assistant Prototype

A comprehensive call routing system that connects customer calls to business owners and falls back to OpenAI voice agents when unavailable.

## Features

- **Call Routing**: Automatically route calls to business owners
- **AI Fallback**: OpenAI voice agent handles calls when owner unavailable
- **Call Recording**: All calls are recorded for training and analysis
- **Admin Dashboard**: Manage businesses and view analytics
- **Business Portal**: Self-service registration and configuration
- **Twilio Integration**: Purchase phone numbers from US/Canada
- **OpenAI Integration**: Advanced voice AI capabilities

## Project Structure

```
├── web/                 # NextJS Frontend
├── backend/             # FastAPI Backend
├── shared/              # Shared utilities and types
└── docs/                # Documentation
```

## Quick Start

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd web
npm install
npm run dev
```

## Environment Variables

Create `.env` files in both `backend/` and `web/` directories:

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost/callassistant
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
OPENAI_API_KEY=your_openai_key
JWT_SECRET_KEY=your_jwt_secret
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your_nextauth_secret
```

## Database Schema

The system uses PostgreSQL with the following main entities:
- Users (admin, business owners)
- Businesses
- Phone Numbers
- Calls (with AI/Human differentiation)
- Call Recordings
- API Configurations

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation. 
