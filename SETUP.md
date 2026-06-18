# Secritou Platform - Setup & Development

This is a clean monorepo with two independent projects: **client** (React frontend) and **server** (Express backend).

## Quick Start

### Client (Frontend)
```bash
cd client
npm install
cp .env.example .env
npm run dev          # Starts on http://localhost:5173
```

### Server (Backend)
```bash
cd server
npm install
cp .env.example .env
npm run dev          # Starts on http://localhost:5000
```

## Available Commands

### Client
- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm run typecheck` — TypeScript checking
- `npm run lint` — ESLint
- `npm run bundle:check` — Check bundle sizes

### Server
- `npm run dev` — Start development server with hot reload
- `npm run build` — Build TypeScript
- `npm run start` — Run production build
- `npm run prisma:migrate` — Run database migrations
- `npm run prisma:seed` — Seed database
- `npm run typecheck` — TypeScript checking
- `npm run lint` — ESLint
- `npm run test:unit` — Run unit tests

## Project Structure

```
secritou-platform/
├── client/                 # React 19 + Vite frontend
│   ├── src/
│   ├── .env.example
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── server/                 # Express 5 backend
│   ├── src/
│   ├── prisma/
│   ├── .env.example
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── .github/                # GitHub workflows (CI/CD)
├── .gitignore
└── README.md              # Project overview
```

## Environment Setup

### Client `.env`
```
VITE_API_URL=http://localhost:5000/api
```

### Server `.env`
```
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/secritou_db
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

## Docker

Each project has its own Dockerfile and can be built independently:

```bash
# Build client image
docker build -t secritou-client ./client

# Build server image
docker build -t secritou-server ./server
```

## Key Features

- ✅ Fully independent client and server projects
- ✅ No workspace dependencies
- ✅ Can run, build, and deploy separately
- ✅ TypeScript everywhere
- ✅ Docker ready
- ✅ GitHub workflows for CI/CD

For more details, see [client/README.md](client/README.md) and [server/README.md](server/README.md).
