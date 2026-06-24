# Secritou : Growth & Digital Transformation Platform

A full-stack SaaS platform for agencies and SMEs: CRM, project management, client portal, freelancer marketplace, and document automation : all in one multi-tenant workspace.

## Features

### Admin & Manager Dashboard
- **CRM** : lead pipeline (kanban + list), client management, contact-to-lead conversion
- **Commercial** : proposals with e-signature flow, acceptance cascade (lead → project → 30% deposit invoice), approvals
- **Projects** : full project lifecycle: planning → production → review → client approval
- **Tasks** : kanban board with assignees, comments, and status tracking
- **Talent** : freelancer profiles, mission marketplace, ratings
- **Invoices** : deposit + balance invoices, payment tracking, credit notes
- **Documents** : auto-generated PDFs (welcome letter, contract, specs, client brief, quote, invoices, roadmap) stored in MinIO/S3
- **Analytics & Reports** : dashboard metrics, Excel/PDF exports
- **AI Assistant** : contextual chat assistant
- **Settings** : company branding, user management, dynamic RBAC for Managers

### Client Portal
- Project timeline (7 interactive steps with 30s polling)
- Document viewer with contract e-signature
- Client brief questionnaire (WEB / MARKETING / AI question sets)
- Invoice history
- Final project approval (triggers COMPLETED status + balance invoice generation)
- Service requests & Q&A

### Business Logic Automations
| Trigger | Cascade |
|---|---|
| Admin accepts a proposal | Lead → WON · Project created · 30% deposit invoice · Client portal invite |
| Proposal accepted | 7 PDFs auto-generated in background (welcome letter, contract, specs, brief, quote, deposit invoice, roadmap) |
| Client submits brief | Brief PDF generated · Manager notified |
| Client signs contract | Timeline step updated |
| Client approves project | Project → COMPLETED · 70% balance invoice · Manager + client emails |

### Permissions (RBAC)
- **ADMIN** : full access, never blocked
- **MANAGER** : dynamic permissions per module (projects, tasks, leads, clients, invoices, documents, etc.) configurable via profiles + individual overrides
- **CLIENT** : scoped to own projects/documents/invoices
- **FREELANCER** : marketplace access only

---

## Tech Stack

### Frontend (`client/`)
| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| UI | shadcn/ui (Radix UI + Tailwind CSS) |
| State | Zustand (auth + permissions) + React Query |
| Forms | React Hook Form + Zod |
| Routing | React Router v7 (lazy + prefetch) |
| i18n | react-i18next (EN / FR) |
| Charts | Recharts |
| Notifications | Sonner (toasts) |

### Backend (`server/`)
| Layer | Choice |
|---|---|
| Framework | Express 5 + TypeScript (ESM) |
| ORM | Prisma + PostgreSQL |
| Cache | Redis (ioredis + BullMQ) |
| Auth | JWT (access token 1h) + HTTP-only refresh cookie (7d) |
| File storage | AWS S3 / MinIO (pdfkit → Buffer → upload) |
| Email | Nodemailer + branded HTML templates |
| Queue | BullMQ (notifications, emails) |
| Observability | Prometheus metrics + Grafana dashboards |
| Docs | Swagger / OpenAPI 3.1 |

### Shared (`shared/`)
- Zod schemas shared between client and server

---

## Project Structure

```
secritou/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── api/             # Typed API clients (axios)
│       ├── components/      # UI, layout, common components
│       ├── features/        # Feature pages (admin + client portal)
│       ├── hooks/           # React Query hooks per domain
│       ├── store/           # Zustand (auth, permissions)
│       ├── types/           # TypeScript interfaces
│       ├── schemas/         # Zod validation schemas
│       └── routes/          # Lazy routes + prefetch
│
├── server/                  # Express API
│   ├── prisma/
│   │   ├── schema.prisma    # Single source of truth for DB schema
│   │   ├── migrations/      # Additive SQL migrations
│   │   └── seed.ts          # Dev seed (company, users, profiles)
│   └── src/
│       ├── config/          # env, prisma client (read/write split)
│       ├── controllers/     # HTTP handlers
│       ├── services/        # Business logic layer
│       ├── repositories/    # Data access layer (Prisma)
│       ├── routes/          # Express routers
│       ├── middlewares/     # auth, RBAC, tenant, validate, rate-limit
│       ├── jobs/            # BullMQ queues + processors
│       ├── cache/           # Redis helpers + cache keys
│       ├── constants/       # Brief questions, etc.
│       └── utils/           # HTTP errors, list query, progress
│
├── shared/                  # Shared Zod schemas (ESM)
│
├── docker-compose.yml       # PostgreSQL + Redis + MinIO
├── observability/           # Prometheus + Grafana + Alertmanager
└── e2e/                     # Playwright tests
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- Docker & Docker Compose

### 1. Start infrastructure

```bash
docker compose up -d
```

| Service | URL | Credentials |
|---|---|---|
| PostgreSQL | `localhost:5432` | `secritou` / `secritou` / db: `secritou_db` |
| Redis | `localhost:6379` | no auth |
| MinIO | API `localhost:9000` · Console `localhost:9001` | `minioadmin` / `minioadmin` |

#### First-time MinIO bucket setup

```bash
./scripts/init-minio.sh
```

Add to `server/.env`:

```env
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=secritou-dev
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_REGION=us-east-1
S3_PUBLIC_URL=http://localhost:9000/secritou-dev
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env with your values
```

Minimum required variables:

```env
DATABASE_URL=postgresql://secritou:secritou@localhost:5432/secritou_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-here
FRONTEND_URL=http://localhost:5173
```

### 4. Run migrations & seed

```bash
npm run prisma:migrate          # apply all migrations
npm run prisma:seed --workspace server   # seed dev data
```

Seed creates:
- Admin: `admin@secritou.tn` / `admin123`
- Manager: `manager@secritou.tn` / `manager123`
- Clients, Freelancers, Projects, Proposals, Invoices, Approvals
- 3 permission profiles: **Opérations**, **Commercial**, **Technique**

### 5. Start development

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- API docs: http://localhost:5000/api-docs

---

## Key API Endpoints

### Authentication
```
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Projects
```
GET    /api/v1/projects
GET    /api/v1/projects/:id
GET    /api/v1/projects/my                    # CLIENT: own projects
GET    /api/v1/projects/:id/timeline-status   # 7-step timeline
GET    /api/v1/projects/:id/brief             # client brief Q&A
POST   /api/v1/projects/:id/brief/submit      # CLIENT submits brief
POST   /api/v1/projects/:id/client-approve    # CLIENT final approval
```

### Documents
```
GET    /api/v1/documents
GET    /api/v1/documents/:id/download         # signed URL
PATCH  /api/v1/documents/:id/sign             # CLIENT e-signature
```

### Proposals
```
GET    /api/v1/proposals
POST   /api/v1/proposals/:id/accept           # cascade: lead+project+invoice+invite
POST   /api/v1/proposals/:id/respond          # CLIENT accept/reject
```

### Permissions (RBAC)
```
GET    /api/v1/permission-profiles            # ADMIN: list profiles
POST   /api/v1/permission-profiles            # ADMIN: create profile
PATCH  /api/v1/permission-profiles/:id        # ADMIN: update profile
DELETE /api/v1/permission-profiles/:id        # ADMIN: delete profile
GET    /api/v1/manager-permissions/me         # MANAGER: own effective permissions
GET    /api/v1/manager-permissions/:userId    # ADMIN: get manager perms
PUT    /api/v1/manager-permissions/:userId    # ADMIN: set manager perms + overrides
```

---

## Scripts

### Root
| Command | Description |
|---|---|
| `npm run dev` | Start client + server concurrently |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run pending migrations |

### Server only
```bash
npm run dev --workspace server
npm run build --workspace server
npm run prisma:seed --workspace server
```

---

## Architecture Notes

### Read/Write Prisma split
`prismaRead` points to a replica (or same DB in dev) for all read queries; `prisma` (write client) is used only for mutations : enabling future read-replica scaling with no code change.

### PDF generation
`documentGenerator.service.ts` generates in-memory PDF buffers via `pdfkit`, uploads them to MinIO via `@aws-sdk/client-s3`, then creates `Document` records in the DB. All 7 PDF types are triggered automatically after proposal acceptance using `Promise.allSettled` : failures never roll back the acceptance.

### Permission resolution
`managerPermissionService.resolvePermissions(userId)`:
1. Check Redis cache (`manager_perms:{userId}`, TTL 5 min)
2. Load `ManagerPermission` with linked `PermissionProfile`
3. `deepMerge(profile.permissions, mp.overrides)` : individual overrides win
4. Cache result and return

---

## Testing

```bash
# Server unit tests (node:test)
npm run test --workspace server

# E2E (Playwright)
npx playwright test
```

---

## Deployment

### Docker

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Environment variables (production)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-secret>
FRONTEND_URL=https://app.secritou.com
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...
S3_ENDPOINT=...
S3_BUCKET=secritou-prod
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

---

## License

MIT
