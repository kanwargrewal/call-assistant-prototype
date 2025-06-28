#!/bin/bash

echo "🚀 Setting up Call Assistant Prototype..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

# Setup Backend
echo "📦 Setting up backend..."
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
if [ ! -f .env ]; then
    echo "📝 Creating backend .env file..."
    cat > .env << EOL
DATABASE_URL=postgresql://user:password@localhost:5432/callassistant
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET_KEY=your_super_secret_jwt_key_here_change_this_in_production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REDIS_URL=redis://localhost:6379
ENVIRONMENT=development
EOL
    echo "⚠️  Please update the .env file with your actual credentials!"
fi

cd ..

# Setup Frontend
echo "📦 Setting up frontend..."
cd web

# Install dependencies
npm install

# Create environment file
if [ ! -f .env.local ]; then
    echo "📝 Creating frontend .env.local file..."
    cat > .env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your_nextauth_secret_here_change_this_in_production
NEXTAUTH_URL=http://localhost:3000
EOL
fi

cd ..

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update backend/.env with your Twilio and OpenAI credentials"
echo "2. Set up PostgreSQL database"
echo "3. Start the backend: cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo "4. Start the frontend: cd web && npm run dev"
echo ""
echo "🌐 Access the application at http://localhost:3000"
echo "📚 API documentation at http://localhost:8000/docs" 