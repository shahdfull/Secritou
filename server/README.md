# Secritou Platform API

Multi-tenant freelancer marketplace and project management platform backend.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Task Queue**: BullMQ
- **Documentation**: Swagger/OpenAPI 3.1

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
npm install
```

### Environment Setup

Create `.env` file in the server directory:

```bash
cp .env.example .env
```

Configure your database and Redis connections.

### Development

```bash
npm run dev
```

Server runs on `http://localhost:5000`

### Building

```bash
npm run build
```

### Production

```bash
npm start
```

## API Documentation

### Swagger UI (Development Only)

Access interactive API documentation at:
```
http://localhost:5000/api-docs
```

### OpenAPI JSON (Development Only)

Get raw OpenAPI specification at:
```
http://localhost:5000/openapi.json
```

### API Documentation File

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for:
- Complete endpoint reference
- Authentication guide
- Multi-tenant architecture
- RBAC system
- Rate limiting
- Error handling
- Common use cases
- Best practices

## Project Structure

```
server/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── index.ts               # Server entry point
│   ├── swagger.ts             # OpenAPI configuration
│   ├── swagger-schemas.ts     # Reusable OpenAPI schemas
│   │
│   ├── config/
│   │   ├── env.ts             # Environment variables
│   │   └── prisma.ts          # Database client
│   │
│   ├── controllers/           # HTTP request handlers (68 endpoints)
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── freelancer.controller.ts
│   │   ├── rating.controller.ts
│   │   ├── invoice.controller.ts
│   │   ├── project.controller.ts
│   │   ├── task.controller.ts
│   │   ├── client.controller.ts
│   │   ├── lead.controller.ts
│   │   └── ... (more controllers)
│   │
│   ├── routes/                # API route definitions (26 documented paths)
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── freelancer.routes.ts
│   │   ├── rating.routes.ts
│   │   ├── index.ts           # Route aggregation
│   │   └── ... (more routes)
│   │
│   ├── services/              # Business logic
│   │   ├── auth.service.ts
│   │   ├── mission.service.ts
│   │   ├── rating.service.ts
│   │   └── ... (more services)
│   │
│   ├── repositories/          # Data access layer
│   │   ├── user.repository.ts
│   │   ├── freelancer.repository.ts
│   │   ├── rating.repository.ts
│   │   └── ... (more repositories)
│   │
│   ├── validators/            # Request validation (Zod schemas)
│   │   ├── auth.validator.ts
│   │   ├── freelancer.validator.ts
│   │   ├── rating.validator.ts
│   │   └── ... (more validators)
│   │
│   ├── middlewares/           # Express middleware
│   │   ├── auth.middleware.ts          # JWT authentication
│   │   ├── rbac.middleware.ts          # Role-based access control
│   │   ├── rateLimit.middleware.ts     # API rate limiting
│   │   ├── validate.middleware.ts      # Request validation
│   │   ├── tenant.middleware.ts        # Multi-tenancy
│   │   ├── error.middleware.ts         # Error handling
│   │   └── ... (more middleware)
│   │
│   ├── types/                 # TypeScript types
│   │   ├── entities.ts        # DTO types
│   │   └── ... (more types)
│   │
│   └── ... (config, utils, jobs, etc)
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Database migrations
│   └── seed.ts                # Database seeding
│
├── test/                      # Test files
│   ├── rating.service.test.ts
│   └── ... (more tests)
│
├── .env.example               # Environment template
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── README.md                  # This file
```

## API Endpoints (26 Documented)

### Authentication (8)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `POST /auth/change-password` - Change password

### Users (7)
- `GET /users/me` - Get current user details
- `PATCH /users/me` - Update current user
- `GET /users` - List users (ADMIN/MANAGER)
- `GET /users/permissions` - Get user permissions
- `POST /users` - Invite user (ADMIN)
- `PATCH /users/{id}` - Update user (ADMIN)
- `DELETE /users/{id}` - Delete user (ADMIN)

### Freelancers (9)
- `GET /freelancers` - List freelancer profiles
- `GET /freelancers/{id}` - Get freelancer details
- `POST /freelancers/me` - Create my profile
- `PUT /freelancers/me` - Update my profile
- `DELETE /freelancers/me` - Delete my profile
- `GET /freelancers/missions` - List missions
- `POST /freelancers/missions` - Create mission
- `PUT /freelancers/missions/{id}` - Update mission
- `DELETE /freelancers/missions/{id}` - Delete mission

### Ratings (6)
- `GET /ratings/freelancers/{id}` - Get freelancer ratings
- `GET /ratings/freelancers/{id}/stats` - Get rating stats
- `POST /ratings` - Create rating
- `PATCH /ratings/{id}` - Update rating
- `DELETE /ratings/{id}` - Delete rating
- `GET /ratings/{id}` - Get rating details

### Health (2)
- `GET /health` - Liveness check
- `GET /health/ready` - Readiness check

## Authentication

All protected endpoints require JWT bearer token:

```bash
Authorization: Bearer <access_token>
```

### Tokens
- **Access Token**: 1-hour lifetime, stored in memory
- **Refresh Token**: 30-day lifetime, stored in HTTP-only cookie

## Multi-Tenancy

All data is automatically isolated by company. Each user belongs to exactly one company, and all API calls are scoped to the user's company.

## Role-Based Access Control (RBAC)

- **ADMIN**: Full platform access
- **MANAGER**: Company-level admin
- **CLIENT**: Create projects/missions
- **FREELANCER**: Apply for missions

## Rate Limiting

- **Auth endpoints**: 5 requests per 15 minutes per IP
- **API endpoints**: 100 requests per 15 minutes per user

## Database

### Migrations

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Deploy migration
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset
```

### Seed Database

```bash
npx prisma db seed
```

## Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Linting & Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## Performance

- Request logging and metrics via Prometheus
- Database query optimization with indexes
- Redis caching for frequently accessed data
- BullMQ for async job processing
- Connection pooling for database

## Security

- JWT-based authentication with refresh tokens
- HTTP-only cookies for refresh tokens
- RBAC with row-level security
- Rate limiting on auth endpoints
- Request validation with Zod
- SQL injection protection via Prisma
- CORS configuration
- Helmet.js for security headers

## Monitoring

### Health Checks

```bash
# Liveness check
curl http://localhost:5000/api/v1/health

# Readiness check
curl http://localhost:5000/api/v1/health/ready
```

### Prometheus Metrics

```bash
curl http://localhost:5000/metrics
```

## Deployment

### Docker

```bash
docker build -t secritou-api .
docker run -p 5000:5000 --env-file .env secritou-api
```

### Environment Variables

See `.env.example` for complete configuration:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/secritou

# Redis
REDIS_URL=redis://localhost:6379

# Server
NODE_ENV=development
PORT=5000

# JWT
JWT_SECRET=your-secret-key

# Client
CLIENT_ORIGIN=http://localhost:3000
```

## Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes and test: `npm run test`
3. Run linter: `npm run lint`
4. Commit: `git commit -m "feat: description"`
5. Push: `git push origin feature/name`
6. Create Pull Request

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL is running: `psql -U postgres -c "SELECT 1"`
- Ensure Redis is running: `redis-cli ping`
- Check DATABASE_URL and REDIS_URL in .env

### Migration Errors
- Reset database: `npx prisma migrate reset` (dev only)
- Verify schema: `npx prisma generate`

### Rate Limit Issues
- Check `rateLimit.middleware.ts` configuration
- Verify Redis connection for distributed rate limiting

## Support

- Documentation: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Issues: GitHub Issues
- Email: contact@secritou.tn

## License

MIT

---

**OpenAPI Documentation**: http://localhost:5000/api-docs (dev only)  
**OpenAPI JSON**: http://localhost:5000/openapi.json (dev only)  
**API Version**: 1.0.0
