# Secritou Platform API Documentation

## Overview

Complete REST API documentation for the Secritou Platform multi-tenant freelancer marketplace and project management system.

- **Base URL**: `http://localhost:5000/api/v1` (development) or `https://api.secritou.com/api/v1` (production)
- **API Version**: 1.0.0
- **OpenAPI Version**: 3.1.0

## Accessing Documentation

### Swagger UI (Development Only)
- **URL**: http://localhost:5000/api-docs
- **Format**: Interactive Swagger interface
- **Available in**: Development environment only

### OpenAPI JSON (Development Only)
- **URL**: http://localhost:5000/openapi.json
- **Format**: Raw OpenAPI 3.1 JSON specification
- **Available in**: Development environment only

## Authentication

All protected endpoints require JWT bearer token authentication.

### Authentication Header
```
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Getting Tokens

#### Register (New User)
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "role": "CLIENT"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "CLIENT",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

#### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token
```bash
POST /auth/refresh
```

Uses HTTP-only cookie automatically. Returns new `accessToken`.

### Token Storage

- **Access Token**: Short-lived (1 hour), stored in memory
- **Refresh Token**: Long-lived, stored in HTTP-only cookie (secure, httpOnly, sameSite=strict)

## API Endpoints

### 26 Documented Endpoints

#### Authentication (8 endpoints)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `POST /auth/change-password` - Change password (authenticated)

#### Users (7 endpoints)
- `GET /users/me` - Get current user details
- `PATCH /users/me` - Update current user details
- `GET /users` - List users (ADMIN/MANAGER only)
- `GET /users/permissions` - Get current user permissions
- `POST /users` - Invite new user (ADMIN only)
- `PATCH /users/{id}` - Update user (ADMIN only)
- `DELETE /users/{id}` - Delete user (ADMIN only)

#### Freelancers (9 endpoints)
- `GET /freelancers` - List public freelancer profiles
- `GET /freelancers/{id}` - Get freelancer profile details
- `POST /freelancers/me` - Create my freelancer profile (FREELANCER only)
- `PUT /freelancers/me` - Update my freelancer profile (FREELANCER only)
- `DELETE /freelancers/me` - Delete my freelancer profile (FREELANCER only)
- `GET /freelancers/missions` - List missions
- `POST /freelancers/missions` - Create new mission (ADMIN/CLIENT only)
- `PUT /freelancers/missions/{id}` - Update mission (ADMIN/CLIENT only)
- `DELETE /freelancers/missions/{id}` - Delete mission (ADMIN/CLIENT only)

#### Ratings (4 endpoints)
- `GET /ratings/freelancers/{freelancerId}` - List freelancer ratings and reviews
- `GET /ratings/freelancers/{freelancerId}/stats` - Get freelancer rating statistics
- `POST /ratings` - Create rating for freelancer (CLIENT/ADMIN only)
- `PATCH /ratings/{id}` - Update rating
- `DELETE /ratings/{id}` - Delete rating
- `GET /ratings/{id}` - Get rating by ID

#### Health (2 endpoints)
- `GET /health` - Service health check
- `GET /health/ready` - Service readiness check (database, Redis)

## Multi-Tenant Architecture

### Tenant Isolation

All data is automatically isolated by company (`companyId`). Each authenticated user belongs to exactly one company.

### Company Assignment

- **On Registration**: User automatically assigned to default company (or invited company)
- **On API Calls**: All operations automatically scoped to user's `companyId`
- **No Cross-Company Access**: Users cannot access data from other companies

### Company Headers

Some endpoints may include company context:
```
X-Company-ID: <uuid>  (optional, current user's company used if not provided)
```

## Role-Based Access Control (RBAC)

### Roles

- **ADMIN**: Full platform access, can manage all users and companies
- **MANAGER**: Company-level admin, can manage users and resources within company
- **CLIENT**: Can create projects, missions, and manage their account
- **FREELANCER**: Can create profile, apply to missions, and accept work

### Role-Based Endpoints

Protected endpoints enforce role requirements:

| Endpoint | ADMIN | MANAGER | CLIENT | FREELANCER |
|----------|-------|---------|--------|------------|
| GET /users | ✅ | ✅ | ❌ | ❌ |
| POST /users | ✅ | ❌ | ❌ | ❌ |
| PATCH /users/{id} | ✅ | ❌ | ❌ | ❌ |
| POST /freelancers/missions | ✅ | ✅ | ✅ | ❌ |
| POST /ratings | ✅ | ✅ | ✅ | ❌ |
| POST /freelancers/me | ❌ | ❌ | ❌ | ✅ |

## Rate Limiting

### Auth Endpoints
- **Limit**: 5 requests per 15 minutes per IP
- **Applies to**: 
  - POST /auth/login
  - POST /auth/register
  - POST /auth/refresh
  - POST /auth/forgot-password
  - POST /auth/reset-password

**Response** (429 Too Many Requests):
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later"
}
```

### API Endpoints
- **Limit**: 100 requests per 15 minutes per user
- **Applies to**: All authenticated endpoints

## HTTP Status Codes

| Code | Description |
|------|-------------|
| **200** | OK - Request successful, resource returned |
| **201** | Created - Resource created successfully |
| **204** | No Content - Successful deletion or update |
| **400** | Bad Request - Validation error or invalid input |
| **401** | Unauthorized - Missing or invalid authentication |
| **403** | Forbidden - Insufficient permissions for resource |
| **404** | Not Found - Resource does not exist |
| **409** | Conflict - Resource already exists or conflict |
| **422** | Unprocessable Entity - Validation failed |
| **429** | Too Many Requests - Rate limit exceeded |
| **500** | Internal Server Error - Unexpected server error |

## Error Responses

All error responses follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  }
}
```

## Pagination

List endpoints support pagination:

### Query Parameters
- `page` (integer, default: 1) - Page number (1-indexed)
- `pageSize` (integer, default: 10, max: 100) - Items per page

### Response Format
```json
{
  "data": [
    { /* items */ }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 150
  }
}
```

## Sorting

Some endpoints support sorting:

### Query Parameters
- `orderBy` (string) - Field to sort by
- `orderDir` (string, enum: [asc, desc]) - Sort direction

**Example**:
```
GET /freelancers?orderBy=hourlyRate&orderDir=desc
```

## Common Use Cases

### 1. User Registration & Login
```bash
# Register
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "role": "CLIENT"
}

# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

# Get current user
GET /auth/me
Authorization: Bearer <access_token>
```

### 2. Create and Manage Missions
```bash
# Create mission
POST /freelancers/missions
Authorization: Bearer <access_token>
{
  "title": "Build REST API",
  "description": "Full-stack REST API development",
  "budget": 5000
}

# Get open missions (as freelancer)
GET /freelancers/missions
Authorization: Bearer <access_token>

# Apply to mission
POST /freelancers/missions/{missionId}/apply
Authorization: Bearer <access_token>
```

### 3. Rate Freelancer
```bash
# Create rating (after mission completion)
POST /ratings
Authorization: Bearer <access_token>
{
  "freelancerId": "uuid",
  "missionId": "uuid",
  "score": 5,
  "comment": "Excellent work, delivered on time!"
}

# Get freelancer ratings
GET /ratings/freelancers/{freelancerId}

# Get rating statistics
GET /ratings/freelancers/{freelancerId}/stats
```

## API Response Examples

### Successful Login
```json
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000

{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "CLIENT",
      "companyId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "mustChangePassword": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE2NzI1NzYwMDAsImV4cCI6MTY3MjU3OTYwMH0.Y-VvqWO6qPLF0fGPtj3LJPm4Q3vL8B3XYq2P5Z6k2D4"
    }
  }
}
```

### Validation Error
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "statusCode": 400,
  "message": "Validation failed",
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  }
}
```

### Unauthorized
```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Forbidden
```json
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "statusCode": 403,
  "message": "Forbidden"
}
```

## Best Practices

### 1. Token Handling
- Always include `Authorization: Bearer <token>` header for protected endpoints
- Handle 401 responses by refreshing token or redirecting to login
- Store access token in memory only, never in localStorage
- Refresh token is automatically handled via HTTP-only cookie

### 2. Error Handling
- Always check status code and `statusCode` field
- Log detailed error messages for debugging
- Implement retry logic for 5xx errors
- Don't retry on 4xx errors (except 429)

### 3. Pagination
- Always use pagination for list endpoints
- Start with `pageSize=10` and adjust based on needs
- Don't exceed `pageSize=100`
- Implement proper loading states while fetching

### 4. Rate Limiting
- Implement exponential backoff for 429 responses
- Batch requests when possible to reduce API calls
- Cache responses when appropriate

## Building with Swagger

### Install Dependencies
```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-ui-express @types/swagger-jsdoc
```

### Access Documentation
```bash
npm run dev
# Open http://localhost:5000/api-docs
```

### Export OpenAPI JSON
```bash
curl http://localhost:5000/openapi.json > openapi.json
```

## Support

For API issues or questions:
- Email: support@secritou.com
- Documentation: https://docs.secritou.com
- GitHub Issues: https://github.com/secritou/api

---

**Last Updated**: June 2024  
**API Version**: 1.0.0  
**OpenAPI Version**: 3.1.0
