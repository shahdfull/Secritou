# Secritou - Growth & Digital Transformation Platform

A comprehensive SaaS platform for SMEs, entrepreneurs, and creators, featuring a client portal, project management, lead tracking, and a freelancer marketplace.

## Features

### Landing Page & Marketing
- Responsive landing page with sections for services, solutions, case studies
- Contact form for inquiries
- Multi-language support (English & French)

### Authentication & Authorization
- Role-based access control (RBAC): Admin, Client, Freelancer
- Secure JWT-based authentication with refresh tokens
- Login & registration pages

### Admin Dashboard
- Analytics dashboard with key metrics (leads, clients, projects, tasks)
- Lead management pipeline
- Client management
- Project management with tasks
- Task management
- Freelancer marketplace with missions
- Reporting & analytics

### Client Portal
- Client-specific dashboard
- Project overview with progress tracking
- Service request management

### Freelancer Marketplace
- Mission listing & application
- Freelancer profiles with skills

### Other Features
- Internationalization (i18n) support for English & French
- Responsive UI with Tailwind CSS
- Dark/light mode (UI ready)

## Tech Stack

### Client (Frontend)
- **Framework**: React 19 + TypeScript + Vite
- **UI Library**: Radix UI (shadcn/ui)
- **State Management**: Zustand (auth) + React Query (data fetching)
- **Form Handling**: React Hook Form + Zod (validation)
- **Styling**: Tailwind CSS
- **Animations**: Motion (Framer Motion)
- **Charts**: Recharts
- **i18n**: react-i18next
- **Icons**: Lucide React
- **Analytics**: Custom tracking service

### Server (Backend)
- **Framework**: Express 5 + TypeScript
- **Database ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: bcryptjs (password hashing) + jsonwebtoken (JWT)
- **Validation**: Zod
- **Security**: Helmet, CORS
- **Email**: Nodemailer
- **Logging**: Morgan
- **Architecture**: Repository-Service-Controller pattern

### Shared
- Zod schemas for validation (shared between client & server)

## Project Structure

```
secritou-platform/
├── client/              # React frontend
│   ├── src/
│   │   ├── api/         # API clients
│   │   ├── components/  # React components (UI, layout, common)
│   │   ├── features/    # Feature pages
│   │   ├── hooks/       # Custom React hooks
│   │   ├── i18n/        # Internationalization files
│   │   ├── providers/   # Context providers
│   │   ├── services/    # Client-side services
│   │   ├── store/       # Zustand stores
│   │   └── types/       # TypeScript types
│   └── package.json
├── server/              # Express backend
│   ├── prisma/          # Prisma schema & migrations
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/      # Environment, Prisma setup
│   │   ├── controllers/ # API controllers
│   │   ├── middlewares/ # Express middlewares
│   │   ├── repositories/# Database access layer
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic layer
│   │   ├── types/       # TypeScript types
│   │   └── validators/  # Zod validators
│   └── package.json
├── shared/              # Shared code (client & server)
│   └── package.json
└── package.json         # Root package.json
```

## Getting Started

### Prerequisites
- Node.js >= 20
- PostgreSQL 16
- npm (comes with Node.js) or yarn/pnpm

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd secritou-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env` in root, client, and server directories
   - Fill in the necessary environment variables

4. **Set up the database**
   ```bash
   npm run prisma:migrate
   npm run prisma:seed --workspace server
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

The client will run on `http://localhost:5173`, and the server on `http://localhost:5000`.

### Running with Docker

1. Build & start all containers
   ```bash
   docker-compose up -d --build
   ```

2. Stop containers
   ```bash
   docker-compose down
   ```

## Scripts

### Root
- `npm run dev`: Start client & server in development mode
- `npm run build`: Build shared, client, and server
- `npm run typecheck`: Run type checking for all workspaces
- `npm run lint`: Run linting for all workspaces
- `npm run prisma:generate`: Generate Prisma Client
- `npm run prisma:migrate`: Run Prisma migrations

### Client
- `npm run dev`: Start Vite dev server
- `npm run build`: Build for production
- `npm run preview`: Preview production build

### Server
- `npm run dev`: Start server with tsx watch
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run prisma:seed`: Seed the database with test data

## License
This project is licensed under the MIT License.
