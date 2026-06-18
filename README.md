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

```
SaaS
├─ .dockerignore
├─ 00_README_FIRST.txt
├─ client
│  ├─ components.json
│  ├─ Dockerfile
│  ├─ eslint.config.js
│  ├─ index.html
│  ├─ nginx.conf
│  ├─ package.json
│  ├─ public
│  │  ├─ robots.txt
│  │  ├─ secritou-logo.png
│  │  └─ sitemap.xml
│  ├─ src
│  │  ├─ api
│  │  │  ├─ ai.api.ts
│  │  │  ├─ analytics.api.ts
│  │  │  ├─ approvals.api.ts
│  │  │  ├─ auth.api.ts
│  │  │  ├─ axios.ts
│  │  │  ├─ clientOnboarding.api.ts
│  │  │  ├─ clients.api.ts
│  │  │  ├─ clientSuccess.api.ts
│  │  │  ├─ comments.api.ts
│  │  │  ├─ company.api.ts
│  │  │  ├─ contactRequests.api.ts
│  │  │  ├─ dashboard.api.ts
│  │  │  ├─ documents.api.ts
│  │  │  ├─ enhancedDocuments.api.ts
│  │  │  ├─ freelancerApplications.api.ts
│  │  │  ├─ freelancers.api.ts
│  │  │  ├─ invoices.api.ts
│  │  │  ├─ leads.api.ts
│  │  │  ├─ metrics.api.ts
│  │  │  ├─ missions.api.ts
│  │  │  ├─ notifications.api.ts
│  │  │  ├─ projects.api.ts
│  │  │  ├─ proposals.api.ts
│  │  │  ├─ ratings.api.ts
│  │  │  ├─ search.api.ts
│  │  │  ├─ serviceRequests.api.ts
│  │  │  ├─ tasks.api.ts
│  │  │  ├─ upload.api.ts
│  │  │  └─ users.api.ts
│  │  ├─ App.tsx
│  │  ├─ assets
│  │  │  └─ secritou-logo.png
│  │  ├─ AUTH_ARCHITECTURE.md
│  │  ├─ AUTH_FLOW_DIAGRAMS.md
│  │  ├─ components
│  │  │  ├─ common
│  │  │  │  ├─ DataTablePagination.tsx
│  │  │  │  ├─ FileUploadField.tsx
│  │  │  │  ├─ GlobalErrorBoundary.tsx
│  │  │  │  ├─ GlobalSearch.tsx
│  │  │  │  ├─ PagePlaceholder.tsx
│  │  │  │  ├─ RouteBoundary.tsx
│  │  │  │  ├─ SEO.tsx
│  │  │  │  └─ SortableTableHead.tsx
│  │  │  ├─ dashboard
│  │  │  │  ├─ HeroDashboard.tsx
│  │  │  │  └─ ProductDashboard.tsx
│  │  │  ├─ DateFilter.tsx
│  │  │  ├─ layout
│  │  │  │  ├─ AdminLayout.tsx
│  │  │  │  ├─ ClientLayout.tsx
│  │  │  │  ├─ Footer.tsx
│  │  │  │  └─ Header.tsx
│  │  │  ├─ MustChangePasswordGuard.tsx
│  │  │  ├─ NotificationBell.tsx
│  │  │  ├─ ProtectedRoute.tsx
│  │  │  ├─ ratings
│  │  │  │  ├─ FreelancerRatingSection.tsx
│  │  │  │  ├─ RatingForm.tsx
│  │  │  │  ├─ RatingStats.tsx
│  │  │  │  ├─ ReviewList.tsx
│  │  │  │  └─ StarRating.tsx
│  │  │  ├─ shared
│  │  │  │  ├─ crud
│  │  │  │  │  ├─ ConfirmDeleteDialog.tsx
│  │  │  │  │  ├─ DetailDrawer.tsx
│  │  │  │  │  ├─ EmptyState.tsx
│  │  │  │  │  ├─ EntityDialog.tsx
│  │  │  │  │  ├─ EntityTable.tsx
│  │  │  │  │  ├─ EntityToolbar.tsx
│  │  │  │  │  ├─ FilterBar.tsx
│  │  │  │  │  ├─ LoadingState.tsx
│  │  │  │  │  ├─ PageHeader.tsx
│  │  │  │  │  ├─ SearchInput.tsx
│  │  │  │  │  └─ StatusBadge.tsx
│  │  │  │  └─ kanban
│  │  │  │     ├─ KanbanBoard.tsx
│  │  │  │     └─ KanbanCard.tsx
│  │  │  └─ ui
│  │  │     ├─ accordion.tsx
│  │  │     ├─ alert-dialog.tsx
│  │  │     ├─ alert.tsx
│  │  │     ├─ aspect-ratio.tsx
│  │  │     ├─ avatar.tsx
│  │  │     ├─ badge.tsx
│  │  │     ├─ breadcrumb.tsx
│  │  │     ├─ button.tsx
│  │  │     ├─ calendar.tsx
│  │  │     ├─ card.tsx
│  │  │     ├─ checkbox.tsx
│  │  │     ├─ collapsible.tsx
│  │  │     ├─ command.tsx
│  │  │     ├─ context-menu.tsx
│  │  │     ├─ dialog.tsx
│  │  │     ├─ dropdown-menu.tsx
│  │  │     ├─ Field.tsx
│  │  │     ├─ form.tsx
│  │  │     ├─ hover-card.tsx
│  │  │     ├─ input.tsx
│  │  │     ├─ label.tsx
│  │  │     ├─ menubar.tsx
│  │  │     ├─ navigation-menu.tsx
│  │  │     ├─ pagination.tsx
│  │  │     ├─ popover.tsx
│  │  │     ├─ progress.module.css
│  │  │     ├─ progress.tsx
│  │  │     ├─ radio-group.tsx
│  │  │     ├─ resizable.tsx
│  │  │     ├─ scroll-area.tsx
│  │  │     ├─ select.tsx
│  │  │     ├─ separator.tsx
│  │  │     ├─ sheet.tsx
│  │  │     ├─ sidebar.tsx
│  │  │     ├─ skeleton.tsx
│  │  │     ├─ slider.tsx
│  │  │     ├─ sonner.tsx
│  │  │     ├─ switch.tsx
│  │  │     ├─ table.tsx
│  │  │     ├─ tabs.tsx
│  │  │     ├─ textarea.tsx
│  │  │     ├─ toggle-group.tsx
│  │  │     ├─ toggle.tsx
│  │  │     └─ tooltip.tsx
│  │  ├─ data
│  │  │  └─ mockData.ts
│  │  ├─ features
│  │  │  ├─ admin-onboarding
│  │  │  │  └─ AdminOnboardingPage.tsx
│  │  │  ├─ ai-assistant
│  │  │  │  └─ AIAssistantPage.tsx
│  │  │  ├─ analytics
│  │  │  │  ├─ AnalyticsCharts.tsx
│  │  │  │  └─ AnalyticsPage.tsx
│  │  │  ├─ applications
│  │  │  │  └─ ApplicationsPage.tsx
│  │  │  ├─ approvals
│  │  │  │  └─ ApprovalsPage.tsx
│  │  │  ├─ auth
│  │  │  │  ├─ ChangePasswordPage.tsx
│  │  │  │  ├─ ForgotPasswordPage.tsx
│  │  │  │  ├─ LoginPage.tsx
│  │  │  │  └─ ResetPasswordPage.tsx
│  │  │  ├─ client-onboarding
│  │  │  │  └─ ClientOnboardingPage.tsx
│  │  │  ├─ client-portal
│  │  │  │  ├─ ClientDashboardPage.tsx
│  │  │  │  ├─ ClientProfilePage.tsx
│  │  │  │  ├─ ProjectsClientPage.tsx
│  │  │  │  └─ ServiceRequestsClientPage.tsx
│  │  │  ├─ client-success
│  │  │  │  └─ ClientSuccessPage.tsx
│  │  │  ├─ clients
│  │  │  │  ├─ ClientDetailPage.tsx
│  │  │  │  └─ ClientsPage.tsx
│  │  │  ├─ dashboard
│  │  │  │  ├─ DashboardCharts.tsx
│  │  │  │  └─ DashboardPage.tsx
│  │  │  ├─ enhanced-documents
│  │  │  │  └─ EnhancedDocumentsPage.tsx
│  │  │  ├─ freelancers
│  │  │  │  ├─ FreelancerDetailPage.tsx
│  │  │  │  └─ FreelancersPage.tsx
│  │  │  ├─ invoices
│  │  │  │  └─ InvoicesPage.tsx
│  │  │  ├─ landing
│  │  │  │  ├─ components
│  │  │  │  │  ├─ BusinessImpact.tsx
│  │  │  │  │  ├─ CaseStudies.tsx
│  │  │  │  │  ├─ Differentiators.tsx
│  │  │  │  │  ├─ FAQ.tsx
│  │  │  │  │  ├─ FinalCTA.tsx
│  │  │  │  │  ├─ FutureProduct.tsx
│  │  │  │  │  ├─ Hero.tsx
│  │  │  │  │  ├─ HowItWorks.tsx
│  │  │  │  │  ├─ Problems.tsx
│  │  │  │  │  ├─ Services.tsx
│  │  │  │  │  ├─ SocialProof.tsx
│  │  │  │  │  └─ SolutionsTeaser.tsx
│  │  │  │  └─ pages
│  │  │  │     ├─ CaseStudiesPage.tsx
│  │  │  │     ├─ ContactPage.tsx
│  │  │  │     ├─ HomePage.tsx
│  │  │  │     ├─ JoinUsPage.tsx
│  │  │  │     ├─ NotFoundPage.tsx
│  │  │  │     ├─ ServicesPage.tsx
│  │  │  │     └─ SolutionsPage.tsx
│  │  │  ├─ leads
│  │  │  │  ├─ LeadsKanban.tsx
│  │  │  │  └─ LeadsPage.tsx
│  │  │  ├─ missions
│  │  │  │  └─ MissionsPage.tsx
│  │  │  ├─ projects
│  │  │  │  └─ ProjectsPage.tsx
│  │  │  ├─ proposals
│  │  │  │  └─ ProposalsPage.tsx
│  │  │  ├─ reports
│  │  │  │  ├─ exportExcel.ts
│  │  │  │  ├─ exportPdf.ts
│  │  │  │  └─ ReportsPage.tsx
│  │  │  ├─ service-requests
│  │  │  │  └─ ServiceRequestsAdminPage.tsx
│  │  │  ├─ settings
│  │  │  │  ├─ SettingsPage.tsx
│  │  │  │  └─ tabs
│  │  │  │     ├─ SettingsAppearanceTab.tsx
│  │  │  │     ├─ SettingsCompanyTab.tsx
│  │  │  │     ├─ SettingsJoinRequestsTab.tsx
│  │  │  │     ├─ SettingsProfileTab.tsx
│  │  │  │     └─ SettingsUsersTab.tsx
│  │  │  └─ tasks
│  │  │     ├─ components
│  │  │     │  ├─ CommentsSection.tsx
│  │  │     │  ├─ TaskCommentForm.tsx
│  │  │     │  ├─ TaskDetailSheet.tsx
│  │  │     │  └─ TaskForm.tsx
│  │  │     ├─ TasksKanban.tsx
│  │  │     └─ TasksPage.tsx
│  │  ├─ hooks
│  │  │  ├─ shared
│  │  │  │  ├─ useCrudDialogState.ts
│  │  │  │  ├─ useDebouncedValue.ts
│  │  │  │  ├─ useEntitySelection.ts
│  │  │  │  ├─ useListFilters.ts
│  │  │  │  └─ useVirtualTable.ts
│  │  │  ├─ use-mobile.tsx
│  │  │  ├─ useAnalytics.ts
│  │  │  ├─ useApprovals.ts
│  │  │  ├─ useAuth.ts
│  │  │  ├─ useClientOnboarding.ts
│  │  │  ├─ useClients.ts
│  │  │  ├─ useClientSuccess.ts
│  │  │  ├─ useCompany.ts
│  │  │  ├─ useDashboard.ts
│  │  │  ├─ useEnhancedDocuments.ts
│  │  │  ├─ useFreelancerApplications.ts
│  │  │  ├─ useFreelancers.ts
│  │  │  ├─ useInvoices.ts
│  │  │  ├─ useLeads.ts
│  │  │  ├─ useListParams.ts
│  │  │  ├─ useMissions.ts
│  │  │  ├─ usePageViewTracking.ts
│  │  │  ├─ useProjects.ts
│  │  │  ├─ useProposals.ts
│  │  │  ├─ useRatings.ts
│  │  │  ├─ useSeoMeta.ts
│  │  │  ├─ useServiceRequests.ts
│  │  │  ├─ useSortableTable.ts
│  │  │  ├─ useTasks.ts
│  │  │  ├─ useUpload.ts
│  │  │  └─ useUsers.ts
│  │  ├─ i18n
│  │  │  ├─ index.ts
│  │  │  └─ locales
│  │  │     ├─ en
│  │  │     │  ├─ test.json
│  │  │     │  ├─ translation.json
│  │  │     │  └─ translation_backup.json
│  │  │     └─ fr
│  │  │        └─ translation.json
│  │  ├─ lib
│  │  │  ├─ api
│  │  │  ├─ query-invalidations.ts
│  │  │  ├─ query-keys.ts
│  │  │  ├─ seo.ts
│  │  │  └─ utils.ts
│  │  ├─ main.tsx
│  │  ├─ observability
│  │  │  └─ webVitals.ts
│  │  ├─ providers
│  │  │  ├─ QueryProvider.tsx
│  │  │  └─ ThemeProvider.tsx
│  │  ├─ routes
│  │  │  ├─ AppRoutes.tsx
│  │  │  └─ routePrefetch.ts
│  │  ├─ schemas
│  │  │  ├─ application.schema.ts
│  │  │  ├─ client.schema.ts
│  │  │  ├─ document.schema.ts
│  │  │  ├─ freelancer.schema.ts
│  │  │  ├─ lead.schema.ts
│  │  │  ├─ mission.schema.ts
│  │  │  ├─ project.schema.ts
│  │  │  ├─ task.schema.ts
│  │  │  └─ user.schema.ts
│  │  ├─ services
│  │  │  ├─ analytics.service.ts
│  │  │  ├─ apiClient.ts
│  │  │  ├─ contact.service.ts
│  │  │  └─ queryClient.ts
│  │  ├─ store
│  │  │  └─ auth.store.ts
│  │  ├─ styles.css
│  │  └─ types
│  │     ├─ analytics.ts
│  │     ├─ analyticsData.ts
│  │     ├─ auth.ts
│  │     ├─ client.ts
│  │     ├─ comment.ts
│  │     ├─ company.ts
│  │     ├─ database.ts
│  │     ├─ freelancer.ts
│  │     ├─ lead.ts
│  │     ├─ pagination.ts
│  │     ├─ project.ts
│  │     ├─ rating.ts
│  │     ├─ serviceRequest.ts
│  │     └─ task.ts
│  ├─ tsconfig.json
│  └─ vite.config.ts
├─ DEPLOYMENT_CHECKLIST.md
├─ DIFFS_QUICK.txt
├─ docker-compose.yml
├─ docs
│  ├─ architecture.md
│  ├─ migration-plan.md
│  └─ postgres-enterprise-scale-plan.md
├─ e2e
│  ├─ auth.spec.ts
│  └─ tenant-isolation.spec.ts
├─ EXECUTIVE_SUMMARY.txt
├─ IMPACT_SUMMARY.txt
├─ observability
│  ├─ alertmanager
│  │  └─ alertmanager.yml
│  ├─ grafana
│  │  ├─ dashboards
│  │  │  ├─ backend.json
│  │  │  ├─ frontend.json
│  │  │  └─ infrastructure.json
│  │  └─ provisioning
│  │     ├─ dashboards
│  │     │  └─ dashboards.yml
│  │     └─ datasources
│  │        └─ prometheus.yml
│  ├─ prometheus
│  │  ├─ alerts
│  │  │  ├─ api.yml
│  │  │  ├─ frontend.yml
│  │  │  └─ infrastructure.yml
│  │  └─ prometheus.yml
│  └─ scripts
│     └─ pg-backup.sh
├─ package-lock.json
├─ package.json
├─ playwright.config.ts
├─ README.md
├─ scripts
│  ├─ check-bundle-budgets.ts
│  └─ check-i18n-keys.ts
├─ SECRITOU_VITRINE_FIXES.md
├─ server
│  ├─ API_DOCUMENTATION.md
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ prisma
│  │  ├─ migrations
│  │  │  ├─ 20260615174044_init
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260616123717_add_reset_token
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260616130554_add_comment_model
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260616131826_add_applications_portfolio_ratings
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260616134201_add_notifications_and_documents
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260616141314_add_manager_role_and_company_branding
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260616160000_performance_indexes
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260617120000_enterprise_constraints
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260617150000_enterprise_scale_plan
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260618115900_catchup_missing_schema
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260618120000_add_file_keys
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260618130000_service_request_admin
│  │  │  │  └─ migration.sql
│  │  │  ├─ 20260618140000_add_freelancer_rating
│  │  │  │  └─ migration.sql
│  │  │  └─ migration_lock.toml
│  │  ├─ schema.prisma
│  │  └─ seed.ts
│  ├─ README.md
│  ├─ Secritou-MVP-API.postman_collection.json
│  ├─ src
│  │  ├─ app.ts
│  │  ├─ cache
│  │  │  ├─ cacheKeys.ts
│  │  │  ├─ cacheService.ts
│  │  │  └─ redis.ts
│  │  ├─ config
│  │  │  ├─ db.ts
│  │  │  ├─ env.ts
│  │  │  └─ prisma.ts
│  │  ├─ controllers
│  │  │  ├─ ai.controller.ts
│  │  │  ├─ analytics.controller.ts
│  │  │  ├─ approval.controller.ts
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ client.controller.ts
│  │  │  ├─ clientOnboarding.controller.ts
│  │  │  ├─ clientSuccess.controller.ts
│  │  │  ├─ comment.controller.ts
│  │  │  ├─ company.controller.ts
│  │  │  ├─ contact.controller.ts
│  │  │  ├─ dashboard.controller.ts
│  │  │  ├─ document.controller.ts
│  │  │  ├─ enhancedDocument.controller.ts
│  │  │  ├─ freelancer.controller.ts
│  │  │  ├─ freelancerApplication.controller.ts
│  │  │  ├─ invoice.controller.ts
│  │  │  ├─ lead.controller.ts
│  │  │  ├─ notification.controller.ts
│  │  │  ├─ project.controller.ts
│  │  │  ├─ proposal.controller.ts
│  │  │  ├─ rating.controller.ts
│  │  │  ├─ search.controller.ts
│  │  │  ├─ serviceRequest.controller.ts
│  │  │  ├─ summary.controller.ts
│  │  │  ├─ task.controller.ts
│  │  │  ├─ upload.controller.ts
│  │  │  └─ user.controller.ts
│  │  ├─ index.ts
│  │  ├─ jobs
│  │  │  ├─ index.ts
│  │  │  ├─ jobNames.ts
│  │  │  ├─ processors
│  │  │  │  ├─ communication.processor.ts
│  │  │  │  └─ maintenance.processor.ts
│  │  │  ├─ queues.ts
│  │  │  └─ redisConnection.ts
│  │  ├─ middlewares
│  │  │  ├─ auth.middleware.ts
│  │  │  ├─ cache.middleware.ts
│  │  │  ├─ error.middleware.ts
│  │  │  ├─ logging.middleware.ts
│  │  │  ├─ metricsAuth.middleware.ts
│  │  │  ├─ rateLimit.middleware.ts
│  │  │  ├─ rbac.middleware.ts
│  │  │  ├─ tenant.middleware.ts
│  │  │  ├─ upload.middleware.ts
│  │  │  └─ validate.middleware.ts
│  │  ├─ observability
│  │  │  ├─ businessMetrics.ts
│  │  │  ├─ collectors.ts
│  │  │  ├─ metrics.ts
│  │  │  ├─ middleware.ts
│  │  │  ├─ prisma.extension.ts
│  │  │  └─ routes.ts
│  │  ├─ repositories
│  │  │  ├─ analytics.repository.ts
│  │  │  ├─ approval.repository.ts
│  │  │  ├─ auth.repository.ts
│  │  │  ├─ client.repository.ts
│  │  │  ├─ clientOnboarding.repository.ts
│  │  │  ├─ clientSuccess.repository.ts
│  │  │  ├─ comment.repository.ts
│  │  │  ├─ company.repository.ts
│  │  │  ├─ document.repository.ts
│  │  │  ├─ enhancedDocument.repository.ts
│  │  │  ├─ freelancer.repository.ts
│  │  │  ├─ freelancerApplication.repository.ts
│  │  │  ├─ invoice.repository.ts
│  │  │  ├─ lead.repository.ts
│  │  │  ├─ mission.repository.ts
│  │  │  ├─ missionApplication.repository.ts
│  │  │  ├─ notification.repository.ts
│  │  │  ├─ project.repository.ts
│  │  │  ├─ proposal.repository.ts
│  │  │  ├─ rating.repository.ts
│  │  │  ├─ search.repository.ts
│  │  │  ├─ serviceRequest.repository.ts
│  │  │  ├─ summary.repository.ts
│  │  │  ├─ task.repository.ts
│  │  │  └─ user.repository.ts
│  │  ├─ routes
│  │  │  ├─ ai.routes.ts
│  │  │  ├─ analytics.routes.ts
│  │  │  ├─ approval.routes.ts
│  │  │  ├─ auth.routes.ts
│  │  │  ├─ client.routes.ts
│  │  │  ├─ clientOnboarding.routes.ts
│  │  │  ├─ clientSuccess.routes.ts
│  │  │  ├─ company.routes.ts
│  │  │  ├─ contact.routes.ts
│  │  │  ├─ dashboard.routes.ts
│  │  │  ├─ document.routes.ts
│  │  │  ├─ enhancedDocument.routes.ts
│  │  │  ├─ freelancer.routes.ts
│  │  │  ├─ freelancerApplication.routes.ts
│  │  │  ├─ index.ts
│  │  │  ├─ invoice.routes.ts
│  │  │  ├─ lead.routes.ts
│  │  │  ├─ notification.routes.ts
│  │  │  ├─ project.routes.ts
│  │  │  ├─ proposal.routes.ts
│  │  │  ├─ rating.routes.ts
│  │  │  ├─ search.routes.ts
│  │  │  ├─ serviceRequest.routes.ts
│  │  │  ├─ summary.routes.ts
│  │  │  ├─ task.routes.ts
│  │  │  ├─ upload.routes.ts
│  │  │  └─ user.routes.ts
│  │  ├─ services
│  │  │  ├─ analytics.service.ts
│  │  │  ├─ approval.service.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ client.service.ts
│  │  │  ├─ clientOnboarding.service.ts
│  │  │  ├─ clientSuccess.service.ts
│  │  │  ├─ comment.service.ts
│  │  │  ├─ company.service.ts
│  │  │  ├─ contact.service.ts
│  │  │  ├─ dashboard.service.ts
│  │  │  ├─ document.service.ts
│  │  │  ├─ email.service.ts
│  │  │  ├─ emailTemplates
│  │  │  │  ├─ base.ts
│  │  │  │  └─ index.ts
│  │  │  ├─ enhancedDocument.service.ts
│  │  │  ├─ freelancer.service.ts
│  │  │  ├─ freelancerApplication.service.ts
│  │  │  ├─ invoice.service.ts
│  │  │  ├─ lead.service.ts
│  │  │  ├─ mission.service.ts
│  │  │  ├─ notification.service.ts
│  │  │  ├─ project.service.ts
│  │  │  ├─ proposal.service.ts
│  │  │  ├─ rating.service.ts
│  │  │  ├─ search.service.ts
│  │  │  ├─ serviceRequest.service.ts
│  │  │  ├─ summary.service.ts
│  │  │  ├─ task.service.ts
│  │  │  ├─ tenantValidation.service.ts
│  │  │  ├─ upload.service.ts
│  │  │  └─ user.service.ts
│  │  ├─ swagger-schemas.ts
│  │  ├─ swagger.ts
│  │  ├─ types
│  │  │  ├─ auth.ts
│  │  │  ├─ entities.ts
│  │  │  └─ express.d.ts
│  │  ├─ utils
│  │  │  ├─ authCookies.ts
│  │  │  ├─ httpError.ts
│  │  │  ├─ listQuery.ts
│  │  │  ├─ parseDuration.ts
│  │  │  ├─ prismaSelects.ts
│  │  │  ├─ projectProgress.ts
│  │  │  └─ sqlHelpers.ts
│  │  └─ validators
│  │     ├─ auth.validator.ts
│  │     ├─ client.validator.ts
│  │     ├─ clientOnboarding.validator.ts
│  │     ├─ company.validator.ts
│  │     ├─ contact.validator.ts
│  │     ├─ freelancer.validator.ts
│  │     ├─ freelancerApplication.validator.ts
│  │     ├─ lead.validator.ts
│  │     ├─ project.validator.ts
│  │     ├─ rating.validator.ts
│  │     ├─ serviceRequest.validator.ts
│  │     ├─ task.validator.ts
│  │     └─ user.validator.ts
│  ├─ test
│  │  ├─ auth.middleware.test.ts
│  │  ├─ listQuery.test.ts
│  │  ├─ rateLimit.test.ts
│  │  ├─ rating.service.test.ts
│  │  ├─ rbac.test.ts
│  │  └─ run-all.test.ts
│  └─ tsconfig.json
├─ shared
│  ├─ package.json
│  ├─ src
│  │  └─ index.ts
│  └─ tsconfig.json
└─ VISUAL_CHANGES.md

```