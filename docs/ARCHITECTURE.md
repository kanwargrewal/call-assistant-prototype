# Call Assistant Architecture

## Overview

The Call Assistant is a comprehensive call routing system that intelligently routes customer calls to business owners and falls back to OpenAI voice agents when unavailable. The system is designed for scalability and future feature expansion.

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Customer      │    │   Business      │    │   Admin         │
│   (Caller)      │    │   Owner         │    │   Dashboard     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (NextJS)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Login/    │  │  Business   │  │      Admin              │ │
│  │  Register   │  │  Dashboard  │  │    Dashboard            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/REST API
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │    Auth     │  │  Business   │  │     Phone Numbers       │ │
│  │   Routes    │  │   Routes    │  │       Routes            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Twilio    │  │   OpenAI    │  │      Database           │ │
│  │  Webhooks   │  │ Voice Agent │  │      Models             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Database (PostgreSQL)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │    Users    │  │ Businesses  │  │     Phone Numbers       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │    Calls    │  │    API      │  │      Call Events        │ │
│  │             │  │   Configs   │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                      ▲
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                External Services                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Twilio    │  │   OpenAI    │  │       Redis             │ │
│  │   (Voice)   │  │   (AI)      │  │     (Caching)           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Call Flow Architecture

```
Customer Call
     │
     ▼
┌─────────────────┐
│ Twilio Webhook  │
│ /incoming-call  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Find Business   │
│ & Phone Number  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Create Call     │
│ Record in DB    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    Yes    ┌─────────────────┐
│ Business Owner  │ ────────▶ │ Route to Owner  │
│ Available?      │           │ (Human Call)    │
└─────────┬───────┘           └─────────────────┘
          │ No
          ▼
┌─────────────────┐
│ Route to AI     │
│ Agent (AI Call) │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Record Call     │
│ & Generate      │
│ Summary         │
└─────────────────┘
```

## Database Schema

### Core Entities

#### Users
- `id` (Primary Key)
- `email` (Unique)
- `hashed_password`
- `first_name`, `last_name`
- `role` (admin, business_owner)
- `is_active`
- `created_at`, `updated_at`

#### Businesses
- `id` (Primary Key)
- `name`
- `description`
- `owner_id` (Foreign Key → Users)
- `owner_phone`
- `is_active`
- `created_at`, `updated_at`

#### Phone Numbers
- `id` (Primary Key)
- `phone_number` (Unique)
- `twilio_sid` (Unique)
- `area_code`, `country`
- `business_id` (Foreign Key → Businesses)
- `status` (active, inactive, suspended)
- `monthly_cost`
- `created_at`, `updated_at`

#### API Configurations
- `id` (Primary Key)
- `business_id` (Foreign Key → Businesses)
- `openai_api_key`
- `openai_model`
- `agent_instructions`
- `is_active`
- `created_at`, `updated_at`

#### Calls
- `id` (Primary Key)
- `twilio_call_sid` (Unique)
- `business_id` (Foreign Key → Businesses)
- `phone_number_id` (Foreign Key → Phone Numbers)
- `caller_number`
- `call_type` (human, ai)
- `status` (ringing, in_progress, completed, failed, no_answer)
- `start_time`, `end_time`
- `duration_seconds`
- `call_summary`
- `recording_url`, `recording_sid`
- `cost`
- `created_at`, `updated_at`

#### Call Events
- `id` (Primary Key)
- `call_id` (Foreign Key → Calls)
- `event_type` (answered, forwarded, ai_takeover, etc.)
- `event_data` (JSON)
- `timestamp`

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **Voice Processing**: OpenAI Agents library
- **Telephony**: Twilio API
- **Caching**: Redis (optional)
- **Task Queue**: Celery (for future async processing)

### Frontend
- **Framework**: Next.js 14 (React)
- **Styling**: Tailwind CSS
- **State Management**: React Query + Context API
- **HTTP Client**: Axios
- **UI Components**: Headless UI
- **Notifications**: React Hot Toast

### External Services
- **Twilio**: Phone number management, call routing, recording
- **OpenAI**: Voice AI agents and conversation processing
- **PostgreSQL**: Primary data storage
- **Redis**: Caching and session storage

## Security Architecture

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Business Owner)
- Password hashing with bcrypt
- Token expiration and refresh

### API Security
- CORS configuration
- Request rate limiting
- Input validation with Pydantic
- SQL injection prevention with ORM

### Data Protection
- Sensitive data encryption (API keys)
- Call recording access control
- PII data handling compliance
- Secure webhook endpoints

## Scalability Considerations

### Database Scaling
- Read replicas for analytics queries
- Partitioning for call data by date
- Indexing on frequently queried fields
- Connection pooling

### Application Scaling
- Horizontal scaling with load balancers
- Stateless API design
- Caching frequently accessed data
- Async processing for heavy operations

### Voice Processing Scaling
- Queue-based AI processing
- Multiple OpenAI API keys for rate limiting
- Regional deployment for latency
- Fallback mechanisms for service outages

## Monitoring & Observability

### Logging
- Structured logging with correlation IDs
- Call flow tracking
- Error tracking and alerting
- Performance metrics

### Metrics
- Call volume and success rates
- AI vs Human call ratios
- Response times and latency
- Cost tracking per business

### Health Checks
- Database connectivity
- External service availability
- Queue health monitoring
- Resource utilization tracking

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: Call sentiment analysis, conversation insights
2. **Multi-language Support**: International business support
3. **CRM Integration**: Salesforce, HubSpot connectors
4. **Advanced Routing**: Time-based, skill-based routing
5. **Mobile App**: Native iOS/Android applications
6. **API Marketplace**: Third-party integrations

### Technical Improvements
1. **Microservices**: Split into domain-specific services
2. **Event Sourcing**: Audit trail and replay capabilities
3. **GraphQL**: More efficient data fetching
4. **Real-time Updates**: WebSocket connections
5. **Machine Learning**: Predictive routing and insights

## Development Guidelines

### Code Organization
- Domain-driven design principles
- Separation of concerns
- Dependency injection
- Test-driven development

### API Design
- RESTful conventions
- Consistent error handling
- Comprehensive documentation
- Versioning strategy

### Database Design
- Normalized schema design
- Proper foreign key constraints
- Audit trails for critical data
- Migration strategy

This architecture provides a solid foundation for the Call Assistant system while maintaining flexibility for future growth and feature additions. 