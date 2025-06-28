# Proposed API Naming Improvements

## Current Issues
- `/api/api-configs/my` - redundant "api" prefix, unclear resource path
- `/api/businesses/my` - mixing resource and ownership concepts
- Inconsistent patterns for user-specific resources

## Proposed Structure

### User/Me Resources
```
GET    /api/me                    # Get current user info
PUT    /api/me                    # Update current user

GET    /api/me/business           # Get my business
PUT    /api/me/business           # Update my business
POST   /api/me/business           # Create my business (if none exists)

GET    /api/me/config             # Get my API configuration
PUT    /api/me/config             # Update my API configuration
POST   /api/me/config             # Create my API configuration

GET    /api/me/phone-numbers      # Get my phone numbers
POST   /api/me/phone-numbers      # Purchase a phone number

GET    /api/me/calls              # Get my call history
GET    /api/me/dashboard          # Get my dashboard data
```

### Admin Resources
```
GET    /api/admin/businesses      # List all businesses
GET    /api/admin/users           # List all users
POST   /api/admin/invites         # Send invitations
GET    /api/admin/invites         # List invitations
GET    /api/admin/statistics      # Admin dashboard stats
```

### Public Resources
```
POST   /api/auth/login           # Login
POST   /api/auth/register        # Register
POST   /api/auth/logout          # Logout
GET    /api/auth/me              # Get current user (or use /api/me)

POST   /api/webhooks/twilio/...  # Twilio webhooks
```

### Phone Number Operations
```
GET    /api/phone-numbers/search?area_code=604&country=CA
POST   /api/me/phone-numbers     # Purchase for current user
DELETE /api/me/phone-numbers/{id} # Release phone number
```

## Benefits
1. **Clearer ownership**: `/api/me/*` clearly indicates user-specific resources
2. **Consistent patterns**: All user resources follow same pattern
3. **Better REST compliance**: Resources are nouns, actions are HTTP verbs
4. **Easier to understand**: Self-documenting URLs
5. **Scalable**: Easy to add new user-specific resources

## Implementation Plan
1. Create new `/api/me/*` endpoints
2. Keep old endpoints for backward compatibility (with deprecation warnings)
3. Update frontend to use new endpoints
4. Remove old endpoints in next major version 