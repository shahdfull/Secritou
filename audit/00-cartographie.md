# Cartographie complète — Secritou SaaS

> Généré le 2026-07-05. Ne contient aucune correction : audit pur, lecture seule.

---

## 1. Stack exacte

### Frontend (client/)

| Catégorie | Bibliothèque | Version |
|-----------|-------------|---------|
| Framework | React | 19.x |
| Build tool | Vite | 6.x |
| Langage | TypeScript | 5.8 |
| Routing | React Router v7 | 7.x |
| State global | Zustand | 5.x |
| Serveur de données | TanStack Query (React Query) | 5.x |
| Virtualisation | TanStack Virtual | 3.x |
| UI components | shadcn/ui + Radix UI | — |
| Styles | Tailwind CSS | 4.x |
| Formulaires | React Hook Form | 7.x |
| Validation schemas | Zod | 3.x |
| HTTP client | Axios | 1.x |
| i18n | i18next + react-i18next + i18next-browser-languagedetector | — |
| Graphiques | Recharts | 2.x |
| Notifications toast | Sonner | — |
| Dates | date-fns | — |
| Export Excel | ExcelJS | — |
| Export PDF (client) | jsPDF | — |
| Icônes | Lucide React | — |
| Animations | Motion (Framer Motion) | — |
| Monitoring erreurs | @sentry/react | — |
| Analytics | Google Analytics 4 (gtag) | — |
| Export Word | docx | 9.7.1 |

### Backend (server/)

| Catégorie | Bibliothèque | Version |
|-----------|-------------|---------|
| Framework | Express | 5.x |
| Langage | TypeScript | 5.8 |
| ORM | Prisma | 6.x |
| Base de données | PostgreSQL | 15+ |
| Cache / Queue broker | Redis (ioredis) | — |
| File d'attente | BullMQ | — |
| Dashboard queues | @bull-board/express | — |
| Auth | JWT (jsonwebtoken) + bcryptjs | — |
| Upload fichiers | Multer + AWS SDK v3 (S3/MinIO) | — |
| E-mail | Nodemailer | — |
| PDF génération serveur | pdfkit | — |
| Validation | Zod | — |
| Sécurité HTTP | Helmet + cors + express-rate-limit | — |
| Compression | compression | — |
| Monitoring erreurs | @sentry/node | — |
| Métriques | prom-client (Prometheus) | — |
| API docs | Swagger (swagger-ui-express) | — |
| LLM client | `server/src/services/llm.client.ts` (Anthropic / OpenRouter, via env) | — |

### Infrastructure

| Service | Technologie |
|---------|------------|
| Base de données | PostgreSQL 15+ |
| Cache | Redis |
| Stockage fichiers | AWS S3 / MinIO (compatible S3) |
| E-mail | SMTP (Nodemailer) |
| Conteneurs | Docker + docker-compose (postgres, redis, minio) |
| Observabilité | Prometheus + Sentry (client + serveur) |

---

## 2. Arborescence commentée — client/src/

```
client/src/
├── main.tsx                   Point d'entrée React, monte <App>
├── App.tsx                    Racine : QueryProvider + ThemeProvider + AppRoutes
├── styles.css                 Variables CSS globales + Tailwind
│
├── api/                       Couche HTTP — un fichier par domaine métier
│   ├── axios.ts               Client Axios de base : intercepteur token + refresh queue
│   ├── auth.api.ts            login / logout / refresh / forgotPassword / resetPassword
│   ├── clients.api.ts         CRUD clients + invitePortalUser
│   ├── projects.api.ts        CRUD projets + brief + clientApprove + timeline
│   ├── tasks.api.ts           CRUD tâches
│   ├── proposals.api.ts       Cycle de vie devis (CRUD, send, accept/reject, sections)
│   ├── invoices.api.ts        CRUD factures + paiements + rappels + annulation
│   ├── leads.api.ts           CRUD leads + convertToClient + updateStatus + reopen
│   ├── documents.api.ts       CRUD documents + versioning + e-signature + signedUrl
│   ├── users.api.ts           CRUD users + inviteUser + permissions + updateMe
│   ├── upload.api.ts          uploadFile / deleteFile / getSignedUrl (S3)
│   ├── analytics.api.ts       Métriques analytiques
│   ├── dashboard.api.ts       Données dashboard admin
│   ├── notifications.api.ts   Liste + marquer lu
│   ├── managerPermissions.api.ts  Permissions fine-grained manager
│   ├── permissionProfiles.api.ts  Profils de permissions réutilisables
│   ├── approvals.api.ts       Flux de validation client
│   ├── comments.api.ts        Commentaires sur tâches/projets
│   ├── contactRequests.api.ts Formulaire de contact public
│   ├── customQuestions.api.ts FAQ / Q&A client↔admin
│   ├── aiConversations.api.ts Historique conversations IA
│   ├── clientOnboarding.api.ts Onboarding 7 étapes
│   ├── clientSuccess.api.ts   Score de succès client
│   ├── clientProfitability.api.ts Rentabilité par client
│   ├── healthBoard.api.ts     Tableau de bord santé des projets
│   ├── revenueForecast.api.ts Prévisions de revenus
│   ├── timeEntry.api.ts       Saisie de temps (time tracking)
│   ├── freelancers.api.ts     Profils freelancers
│   ├── freelancerApplications.api.ts  Candidatures freelancers
│   ├── ratings.api.ts         Notes freelancers
│   ├── search.api.ts          Recherche globale
│   ├── serviceRequests.api.ts Demandes de service client
│   ├── siteContent.api.ts     CMS landing page (clé/locale/valeur)
│   ├── metrics.api.ts         Métriques executive
│   └── ai.api.ts              Appels directs à l'assistant IA
│
├── store/
│   └── auth.store.ts          Zustand : user, accessToken, status, bootstrapped,
│                              permissions. Persiste user+status dans localStorage.
│                              Méthodes : setSession, logout, fetchMyPermissions, can()
│
├── types/                     Interfaces TypeScript par domaine
│   ├── auth.ts                User, AuthTokens, LoginCredentials, ApiResponse<T>
│   ├── permissions.ts         MODULES[], PermissionsMap, ManagerPermission
│   ├── client.ts              Client, ClientPortalUser
│   ├── project.ts             Project (7 statuts), CreateProjectInput
│   ├── task.ts                Task (re-export depuis @secritou/shared)
│   ├── lead.ts                Lead (6 statuts)
│   ├── pagination.ts          PaginatedResponse<T>, ListQueryParams
│   ├── analytics.ts           AnalyticsData, ExecutiveMetrics
│   ├── freelancer.ts          FreelancerProfile, Application
│   ├── serviceRequest.ts      ServiceRequest (6 statuts)
│   └── comment.ts             Comment
│
├── hooks/                     React Query + logique métier
│   ├── useAuth.ts             useBootstrapSession, useLogin, useLogout, useMe,
│   │                          useRegister, useChangePassword, getRedirectPathForRole
│   ├── usePermission.ts       hook → boolean pour (module, action)
│   ├── useLeads.ts            useLeads, useCreateLead, useUpdateLead...
│   ├── useClients.ts          useClients, useClient, useCreateClient...
│   ├── useProjects.ts         useProjects, useProject, useProjectBrief...
│   ├── useTasks.ts            useTasks, useCreateTask...
│   ├── useProposals.ts        useProposals, useSendProposal...
│   ├── useInvoices.ts         useInvoices, useAddPayment...
│   ├── useApprovals.ts        useApprovals, useUpdateApproval
│   ├── useDocuments.ts        useDocuments, useSignDocument
│   ├── useAnalytics.ts        useAnalytics
│   ├── useDashboard.ts        useAdminDashboard
│   ├── useHealthBoard.ts      useHealthBoard
│   ├── useRevenueForecast.ts  useRevenueForecast
│   ├── useClientProfitability.ts
│   ├── useClientSuccess.ts
│   ├── useClientOnboarding.ts
│   ├── useFreelancers.ts      useFreelancers, useFreelancerProfile
│   ├── useFreelancerApplications.ts
│   ├── useTimeEntries.ts
│   ├── useServiceRequests.ts
│   ├── useCustomQuestions.ts
│   ├── useAiConversations.ts
│   ├── useUsers.ts
│   ├── useSiteContent.ts
│   ├── useUpload.ts
│   ├── useExecutiveMetrics.ts
│   ├── usePageViewTracking.ts  GA4 pageview events
│   ├── useSeoMeta.ts
│   ├── useListParams.ts        URL ↔ filtres pagination
│   ├── use-mobile.tsx          breakpoint mobile
│   └── shared/
│       ├── useCrudDialogState.ts   Gestion état open/close dialog CRUD
│       ├── useDebouncedValue.ts    Debounce générique
│       ├── useEntitySelection.ts   Sélection multiple lignes tableau
│       ├── useListFilters.ts       Filtres liste génériques
│       └── useVirtualTable.ts      Virtualisation TanStack Virtual
│
├── features/                  Modules métier — un dossier par domaine
│   ├── auth/                  LoginPage, ForgotPassword, ResetPassword, ChangePassword
│   ├── dashboard/             DashboardPage, DashboardCharts, HealthBoardTab,
│   │                          RevenueForecastSection, FreelancerDashboardPage
│   ├── crm/                   CRMPage (tabs : leads + clients + freelancers)
│   ├── leads/                 LeadsPage, LeadsKanban, LeadDetailDialog,
│   │                          CreateProposalFromLeadDialog
│   ├── clients/               ClientsPage, ClientDetailPage
│   ├── commercial/            CommercialPage (proposals pipeline)
│   ├── proposals/             ProposalsPage
│   ├── invoices/              InvoicesPage, CreateInvoiceDialog, AddPaymentDialog
│   ├── projects/              ProjectsPage, ProjectDetailPage, TimeTrackingTab
│   ├── tasks/                 TasksPage, TasksKanban, TasksListView,
│   │                          TaskCreateDialog, TaskEditDialog, TaskDetailDrawer
│   │                          hooks/ : useTaskActions, useTaskCommentMutation,
│   │                                   useTasksPageData
│   ├── approvals/             ApprovalsPage
│   ├── documents/             DocumentsPage
│   ├── service-requests/      ServiceRequestsAdminPage
│   ├── client-success/        ClientSuccessPage
│   ├── analytics/             AnalyticsCharts, ClientProfitabilityPage
│   ├── reports/               ReportsPage, exportExcel.ts, exportPdf.ts
│   ├── ai-assistant/          AIAssistantPage
│   ├── questions/             AdminQuestionsPage (FAQ admin)
│   ├── settings/              SettingsPage + tabs :
│   │                          SettingsProfileTab, SettingsUsersTab,
│   │                          SettingsAppearanceTab, SettingsSiteContentTab,
│   │                          SettingsJoinRequestsTab, FreelancerProfileTab
│   ├── talent/                TalentPage (applications + freelancers)
│   ├── freelancers/           FreelancersPage, FreelancerDetailPage
│   ├── applications/          ApplicationsPage (page publique "Rejoindre")
│   ├── admin-onboarding/      AdminOnboardingPage (vue admin onboarding client)
│   ├── client-onboarding/     ClientOnboardingPage (vue admin détail)
│   └── client-portal/         Portail client (route /client/*) :
│                              ClientDashboardPage, ProjectsClientPage,
│                              ProposalsClientPage, ApprovalsClientPage,
│                              InvoicesClientPage, DocumentsClientPage,
│                              ClientBriefPage, OnboardingClientPage,
│                              ServiceRequestsClientPage, QuestionsClientPage,
│                              ClientProfilePage, ProjectTimeline (component)
│
├── components/
│   ├── layout/                AdminLayout, ClientLayout, FreelancerLayout,
│   │                          Header, Footer, AIAssistantFloat
│   ├── common/                DataTablePagination, FileUploadField,
│   │                          GlobalErrorBoundary, GlobalSearch, SEO,
│   │                          SortableTableHead, RouteBoundary
│   ├── shared/crud/           Composants CRUD réutilisables :
│   │                          ConfirmActionDialog, ConfirmDeleteDialog,
│   │                          DetailDrawer, EmptyState, EntityDialog,
│   │                          EntityTable, EntityToolbar, FilterBar,
│   │                          LoadingState, PageHeader, SearchInput, StatusBadge
│   ├── shared/kanban/         KanbanBoard, KanbanCard
│   ├── ui/                    50+ composants shadcn/ui (Radix primitives)
│   ├── ProtectedRoute.tsx     Garde auth + redirect par rôle
│   ├── MustChangePasswordGuard.tsx  Force /change-password si flag actif
│   ├── NotificationBell.tsx   Polling notifications
│   ├── WhatsAppButton.tsx     Bouton flottant WhatsApp (landing)
│   ├── ScrollToTop.tsx        Reset scroll sur navigation
│   └── DateFilter.tsx         Filtre date réutilisable
│
├── routes/
│   ├── AppRoutes.tsx          Définition de toutes les routes (lazy load)
│   └── routePrefetch.ts       Fonctions d'import anticipé des routes
│
├── schemas/                   Zod schemas côté client (validation formulaires)
│   ├── application.schema.ts  Candidature freelancer
│   ├── client.schema.ts       Création/édition client
│   ├── document.schema.ts     Upload document
│   ├── freelancer.schema.ts   Profil freelancer
│   ├── lead.schema.ts         Création/édition lead
│   ├── project.schema.ts      Création/édition projet
│   ├── task.schema.ts         Création/édition tâche
│   └── user.schema.ts         Création/édition utilisateur
│
├── lib/
│   ├── query-keys.ts          Clés TanStack Query centralisées
│   ├── query-invalidations.ts Invalidations de cache après mutations
│   ├── seo.ts                 Helpers Open Graph / meta tags
│   └── utils.ts               cn() + utilitaires Tailwind
│
├── services/
│   ├── queryClient.ts         Configuration QueryClient (staleTime, retry)
│   ├── analytics.service.ts   Wrapper GA4 (pageview, events)
│   └── contact.service.ts     Appel API formulaire contact public
│
├── providers/
│   ├── QueryProvider.tsx      Fournit TanStack QueryClient
│   ├── ThemeProvider.tsx      Thème clair/sombre (localStorage)
│   └── LandingCmsProvider.tsx Charge SiteContent depuis API pour la landing
│
├── observability/
│   └── webVitals.ts           Core Web Vitals → Sentry
│
├── utils/
│   ├── format.ts              Formatage nombres, dates, devises (fr-FR)
│   └── statusColors.ts        Couleurs CSS par statut métier
│
├── i18n/
│   ├── index.ts               Init i18next, fallback "fr", détection localStorage
│   └── locales/
│       ├── en/translation.json  Traductions anglaises (~65 KB)
│       └── fr/translation.json  Traductions françaises
│
└── assets/                    Images, logos, favicon
```

---

## 3. Routes — tableau exhaustif

### 3a. Routes publiques (visiteur anonyme)

| Chemin | Composant | Fichier | Accès |
|--------|-----------|---------|-------|
| `/` | `HomePage` | `features/landing/pages/HomePage.tsx` | Visiteur |
| `/services` | `ServicesPage` | `features/landing/pages/ServicesPage.tsx` | Visiteur |
| `/solutions` | `SolutionsPage` | `features/landing/pages/SolutionsPage.tsx` | Visiteur |
| `/case-studies` | `CaseStudiesPage` | `features/landing/pages/CaseStudiesPage.tsx` | Visiteur |
| `/contact` | `ContactPage` | `features/landing/pages/ContactPage.tsx` | Visiteur |
| `/mentions-legales` | `LegalPage` | `features/landing/pages/LegalPage.tsx` | Visiteur |
| `/confidentialite` | `PrivacyPage` | `features/landing/pages/PrivacyPage.tsx` | Visiteur |
| `/login` | `LoginPage` | `features/auth/LoginPage.tsx` | Visiteur |
| `/rejoindre` | `JoinUsPage` | `features/landing/pages/JoinUsPage.tsx` | Visiteur |
| `/forgot-password` | `ForgotPasswordPage` | `features/auth/ForgotPasswordPage.tsx` | Visiteur |
| `/reset-password` | `ResetPasswordPage` | `features/auth/ResetPasswordPage.tsx` | Visiteur |
| `/change-password` | `ChangePasswordPage` | `features/auth/ChangePasswordPage.tsx` | Authentifié (forcé) |
| `/*` | `NotFoundPage` | `features/landing/pages/NotFoundPage.tsx` | Visiteur |

### 3b. Routes application interne — `/app/*` (admin / manager / freelancer)

| Chemin | Composant | Fichier | Rôle requis |
|--------|-----------|---------|-------------|
| `/app` | `DashboardPage` | `features/dashboard/DashboardPage.tsx` | Admin, Manager |
| `/app/freelancer-dashboard` | `FreelancerDashboardPage` | `features/dashboard/FreelancerDashboardPage.tsx` | Freelancer |
| `/app/crm` | `CRMPage` | `features/crm/CRMPage.tsx` | Admin, Manager |
| `/app/leads` | → redirect `/app/crm` | — | — |
| `/app/clients` | → redirect `/app/crm` | — | — |
| `/app/clients/:id` | `ClientDetailPage` | `features/clients/ClientDetailPage.tsx` | Admin, Manager |
| `/app/talent` | `TalentPage` | `features/talent/TalentPage.tsx` | Admin, Manager |
| `/app/applications` | → redirect `/app/talent` | — | — |
| `/app/freelancers` | → redirect `/app/talent` | — | — |
| `/app/freelancers/:id` | `FreelancerDetailPage` | `features/freelancers/FreelancerDetailPage.tsx` | Admin, Manager |
| `/app/projects` | `ProjectsPage` | `features/projects/ProjectsPage.tsx` | Admin, Manager, Freelancer |
| `/app/projects/:id` | `ProjectDetailPage` | `features/projects/ProjectDetailPage.tsx` | Admin, Manager, Freelancer |
| `/app/tasks` | `TasksPage` | `features/tasks/TasksPage.tsx` | Admin, Manager, Freelancer |
| `/app/analytics` | → redirect `/app` | — | — |
| `/app/analytics/clients` | `ClientProfitabilityPage` | `features/analytics/ClientProfitabilityPage.tsx` | Admin |
| `/app/reports` | `ReportsPage` | `features/reports/ReportsPage.tsx` | Admin, Manager |
| `/app/commercial` | `CommercialPage` | `features/commercial/CommercialPage.tsx` | Admin, Manager |
| `/app/service-requests` | `ServiceRequestsAdminPage` | `features/service-requests/ServiceRequestsAdminPage.tsx` | Admin, Manager |
| `/app/invoices` | `InvoicesPage` | `features/invoices/InvoicesPage.tsx` | Admin, Manager |
| `/app/approvals` | → redirect `/app/projects` | — | — |
| `/app/proposals` | → redirect `/app/commercial` | — | — |
| `/app/documents` | `DocumentsPage` | `features/documents/DocumentsPage.tsx` | Admin, Manager, Freelancer |
| `/app/client-success/:clientId` | `ClientSuccessPage` | `features/client-success/ClientSuccessPage.tsx` | Admin, Manager |
| `/app/client-onboardings` | → redirect `/app/crm` | — | — |
| `/app/client-onboarding/:onboardingId` | `ClientOnboardingPage` | `features/client-onboarding/ClientOnboardingPage.tsx` | Admin, Manager |
| `/app/settings` | `SettingsPage` | `features/settings/SettingsPage.tsx` | Admin, Manager, Freelancer |
| `/app/questions` | `AdminQuestionsPage` | `features/questions/AdminQuestionsPage.tsx` | Admin, Manager |
| `/app/questions/:id` | `AdminQuestionsPage` | `features/questions/AdminQuestionsPage.tsx` | Admin, Manager |
| `/app/ai` | `AIAssistantPage` | `features/ai-assistant/AIAssistantPage.tsx` | Admin, Manager |

**Note** : Les routes Freelancer sont filtrées dans `ProtectedRoute.tsx` (ligne 45) :  
autorisées = `/app/freelancer-dashboard`, `/app/projects`, `/app/tasks`, `/app/documents`, `/app/settings`.

### 3c. Portail client — `/client/*`

| Chemin | Composant | Fichier | Rôle requis |
|--------|-----------|---------|-------------|
| `/client` | `ClientDashboardPage` | `features/client-portal/ClientDashboardPage.tsx` | Client |
| `/client/projects` | `ProjectsClientPage` | `features/client-portal/ProjectsClientPage.tsx` | Client |
| `/client/requests` | `ServiceRequestsClientPage` | `features/client-portal/ServiceRequestsClientPage.tsx` | Client |
| `/client/proposals` | `ProposalsClientPage` | `features/client-portal/ProposalsClientPage.tsx` | Client |
| `/client/proposals/:id` | `ProposalsClientPage` | `features/client-portal/ProposalsClientPage.tsx` | Client |
| `/client/approvals` | `ApprovalsClientPage` | `features/client-portal/ApprovalsClientPage.tsx` | Client |
| `/client/invoices` | `InvoicesClientPage` | `features/client-portal/InvoicesClientPage.tsx` | Client |
| `/client/profile` | `ClientProfilePage` | `features/client-portal/ClientProfilePage.tsx` | Client |
| `/client/questions` | `QuestionsClientPage` | `features/client-portal/QuestionsClientPage.tsx` | Client |
| `/client/questions/:id` | `QuestionsClientPage` | `features/client-portal/QuestionsClientPage.tsx` | Client |
| `/client/documents` | `DocumentsClientPage` | `features/client-portal/DocumentsClientPage.tsx` | Client |
| `/client/brief/:projectId` | `ClientBriefPage` | `features/client-portal/ClientBriefPage.tsx` | Client |
| `/client/onboarding` | `OnboardingClientPage` | `features/client-portal/OnboardingClientPage.tsx` | Client |

---

## 4. Schéma des flux de données

### 4a. Pattern général

```
Composant React
    └─→ hook (useXxx.ts)                    React Query useQuery / useMutation
            └─→ api/xxx.api.ts              Axios → apiClient
                    └─→ axios.ts            Intercepteur : injecte Bearer token
                                             Sur 401 : refresh + retry automatique
                            └─→ Express API  /api/...
                                    └─→ Controller → Service → Repository → Prisma → PostgreSQL
                                    └─→ Cache Redis (TTL 5 min, CACHE_ENABLED=true)
```

Toutes les données passent par l'API REST. **Aucun mock, aucun localStorage de données métier.**

### 4b. Dashboard admin

| Donnée | Source API | Hook | Cache |
|--------|-----------|------|-------|
| KPIs principaux | `GET /api/dashboard` | `useDashboard` | React Query staleTime |
| Santé projets | `GET /api/health-board` | `useHealthBoard` | Redis + RQ |
| Prévisions revenus | `GET /api/revenue-forecast` | `useRevenueForecast` | Redis |
| Métriques exécutives | `GET /api/executive-metrics` | `useExecutiveMetrics` | Redis |

### 4c. CRM (Leads / Clients)

| Donnée | Source API | Hook |
|--------|-----------|------|
| Leads paginés | `GET /api/leads` | `useLeads` |
| Détail lead | `GET /api/leads/:id` | `useLead` |
| Kanban status | `PATCH /api/leads/:id/status` | `useUpdateLeadStatus` |
| Clients | `GET /api/clients` | `useClients` |
| Détail client | `GET /api/clients/:id` | `useClient` |

### 4d. Factures

| Donnée | Source API | Hook |
|--------|-----------|------|
| Liste factures | `GET /api/invoices` | `useInvoices` |
| Ajout paiement | `POST /api/invoices/:id/payment` | `useAddPayment` |
| Génération PDF | Serveur : pdfkit → S3 → URL signée | `getDownloadUrl` |

### 4e. Documents

| Donnée | Source API | Stockage réel |
|--------|-----------|---------------|
| Upload | `POST /api/upload/:context` → multer → S3 | AWS S3 / MinIO |
| Téléchargement | `GET /api/upload/signed-url?key=...` | URL pré-signée S3 (TTL configurable) |
| Métadonnées | `GET /api/documents` | PostgreSQL via Prisma |

### 4f. Assistant IA

| Donnée | Source |
|--------|--------|
| Messages | `POST /api/ai/message` ou `/api/ai-conversations/:id/messages` |
| Historique | `GET /api/ai-conversations` → PostgreSQL (AiMessage) |
| LLM backend | `server/src/services/llm.client.ts` → Anthropic / OpenRouter via env |
| Personas | `server/src/agents/personas.ts` (instructions système) |

### 4g. CMS Landing

| Donnée | Source | Provider |
|--------|--------|---------|
| Contenu pages | `GET /api/site-content` | `LandingCmsProvider` → React Context |
| Édition | `PUT /api/site-content` (admin) | `SettingsSiteContentTab` |

---

## 5. Points d'entrée sensibles

### 5a. Formulaires (validation Zod côté client + Zod côté serveur)

| Formulaire | Fichier composant | Schema Zod client | Validateur serveur |
|-----------|------------------|-------------------|--------------------|
| Login | `features/auth/LoginPage.tsx` | inline | `auth.validator.ts` |
| Mot de passe oublié | `features/auth/ForgotPasswordPage.tsx` | inline | `auth.validator.ts` |
| Reset mot de passe | `features/auth/ResetPasswordPage.tsx` | inline | `auth.validator.ts` |
| Changement de passe | `features/auth/ChangePasswordPage.tsx` | inline | `auth.validator.ts` |
| Création lead | `features/leads/LeadsPage.tsx` | `schemas/lead.schema.ts` | `lead.validator.ts` |
| Création client | `features/clients/ClientsPage.tsx` | `schemas/client.schema.ts` | `client.validator.ts` |
| Création projet | `features/projects/ProjectsPage.tsx` | `schemas/project.schema.ts` | `project.validator.ts` |
| Création tâche | `features/tasks/components/TaskCreateDialog.tsx` | `schemas/task.schema.ts` | `task.validator.ts` |
| Candidature freelancer | `features/landing/pages/JoinUsPage.tsx` | `schemas/application.schema.ts` | `freelancerApplication.validator.ts` |
| Contact public | `features/landing/pages/ContactPage.tsx` | inline | `contact.validator.ts` |
| Brief client | `features/client-portal/ClientBriefPage.tsx` | inline | `project.validator.ts` |
| Questions personnalisées | `features/client-portal/QuestionsClientPage.tsx` | inline | `customQuestion.validator.ts` |
| Upload document | `components/common/FileUploadField.tsx` | `schemas/document.schema.ts` | `upload.validator.ts` |

### 5b. Uploads de fichiers

| Endpoint | Context | Types autorisés (côté serveur) |
|----------|---------|-------------------------------|
| `POST /api/upload/cv` | CV freelancer | PDF, DOC, DOCX |
| `POST /api/upload/portfolio` | Portfolio | Images, PDF |
| `POST /api/upload/document` | Documents métier | PDF, DOC, DOCX, images |
| `POST /api/upload/image` | Images profil / logo | JPEG, PNG, WebP |

Traitement : Multer (mémoire) → validation MIME côté serveur → upload S3/MinIO.  
Accès : URL pré-signée S3 (TTL paramétrable, défaut 3600s).

### 5c. Appels API critiques

| Endpoint | Effet | Middleware de protection |
|----------|-------|--------------------------|
| `POST /api/auth/login` | Émet JWT + cookie HTTP-only | Rate limit |
| `POST /api/auth/refresh` | Renouvelle access token | Cookie HTTP-only (pas de body token) |
| `POST /api/leads/:id/convert` | Lead → Client + user invité | auth + rbac |
| `POST /api/proposals/:id/accept` | Cascade : projet + factures + PDFs + invitation portail | auth + rbac |
| `POST /api/projects/:id/client-approve` | Projet COMPLETED + facture solde 70% | auth + CLIENT role check |
| `POST /api/documents/:id/sign` | E-signature | auth + ownership check |
| `POST /api/ai/message` | Appel LLM externe (coût) | auth + role check |
| `DELETE /api/upload` | Suppression S3 permanente | auth |

### 5d. Variables d'environnement

**Client (VITE_* — exposées dans le bundle)**

| Variable | Usage | Sensibilité |
|----------|-------|-------------|
| `VITE_API_URL` | Base URL API | Faible |
| `VITE_WHATSAPP_NUMBER` | Bouton WhatsApp | Faible |
| `VITE_SENTRY_DSN` | Monitoring erreurs front | Moyenne (DSN public) |
| `VITE_CALCOM_LINK` | Intégration booking | Faible |
| `VITE_GA4_ID` | Google Analytics | Faible |
| `VITE_SITE_URL` | Canonicals SEO | Faible |

**Serveur (jamais exposées)**

| Variable | Usage | Sensibilité |
|----------|-------|-------------|
| `DATABASE_URL` | Connexion PostgreSQL | **Critique** |
| `JWT_SECRET` | Signature access tokens | **Critique** |
| `JWT_REFRESH_SECRET` | Signature refresh tokens | **Critique** |
| `REDIS_URL` | Cache + queues | Haute |
| `AWS_ACCESS_KEY_ID` / `SECRET` | Accès S3/MinIO | **Critique** |
| `SMTP_USER` / `SMTP_PASS` | Envoi e-mails | Haute |
| `SENTRY_DSN` | Monitoring erreurs serveur | Moyenne |
| `INTERNAL_COMPANY_ID` | Seed company ID | Faible |

---

## 6. Dette technique identifiée

### 6a. Redirects fantômes (routes sans page)

| Route déclarée | Redirecte vers | Risque |
|----------------|---------------|--------|
| `/app/leads` | `/app/crm` | Faible — liens internes probablement mis à jour |
| `/app/clients` | `/app/crm` | Faible |
| `/app/analytics` | `/app` | Faible (page analytics supprimée ?) |
| `/app/approvals` | `/app/projects` | Faible |
| `/app/proposals` | `/app/commercial` | Faible |
| `/app/applications` | `/app/talent` | Faible |
| `/app/freelancers` | `/app/talent` | Faible |
| `/app/client-onboardings` | `/app/crm` | Faible |

Ces routes semblent être des anciens chemins conservés pour compatibilité. Elles pourraient être nettoyées.

### 6b. Fichiers supprimés non encore committes (git status)

D'après le git status fourni :

| Fichier | Nature |
|---------|--------|
| `client/src/api/axios.test.ts` | Test supprimé |
| `client/src/components/common/PagePlaceholder.tsx` | Composant supprimé |
| `client/src/components/ui/aspect-ratio.tsx` | Composant shadcn supprimé |
| `client/src/hooks/useSortableTable.ts` | Hook supprimé |
| `server/prisma/migrations/20260615174044_init/migration.sql` | Migration supprimée |
| `server/` (plusieurs fichiers) | Suppressions serveur en cours |

### 6c. Architecture / dette structurelle

| Point | Description | Sévérité |
|-------|-------------|----------|
| Monorepo incomplet | `shared/` workspace déclaré dans `package.json` racine mais non listé ici | Moyenne |
| Multi-tenant résiduel | Modèle `Company` + `Service` + `serviceId` FK sur plusieurs entités alors que l'app est mono-agence | **Haute** (complexité inutile, voir mémoire `architecture_multitenancy_issue.md`) |
| Swagger sans auth | `server/src/swagger.ts` + `swagger-schemas.ts` présents — vérifier si `/api-docs` est public en prod | Haute |
| `INTERNAL_COMPANY_ID` hardcodé en seed | La variable `.env` contient `seed-company-001` — dépendance à un ID de seed en prod | Haute |
| Pas de CSRF protection visible | Cookie HTTP-only utilisé pour refresh, mais pas de double-submit cookie ou header custom visible | Haute |
| Rate limiting partiel | `rateLimit.middleware.ts` présent mais non vérifié sur toutes les routes sensibles (AI, upload) | Moyenne |
| `swagger.ts` / `swagger-schemas.ts` | Fichiers de documentation API présents dans `server/src/` — couplage fort si les schemas divergent des validators Zod réels | Faible |
| `services/llm.client.ts` sans sandbox | Service LLM côté serveur — à isoler dans le module `agent-service` planifié, avec garde de rôle | Haute |
| TODO dans translation.json | Fichiers de 65 KB — risque de clés manquantes/orphelines non détectables statiquement | Faible |

### 6d. Duplication potentielle

| Pattern | Fichiers concernés |
|---------|-------------------|
| `AdminQuestionsPage` monté deux fois (route `/app/questions` et `/app/questions/:id`) | `AppRoutes.tsx` lignes 215-216 — même composant, gestion paramètre `:id` interne |
| `ProposalsClientPage` monté deux fois (`/client/proposals` et `/client/proposals/:id`) | `AppRoutes.tsx` lignes 231-232 — idem |
| Logic de permission répliquée | `ProtectedRoute.tsx` (frontend) + `rbac.middleware.ts` (backend) — cohérence à maintenir manuellement |

---

## Résumé exécutif

Secritou est une application SaaS mono-agence mature (~35 entités Prisma, ~87 routes client, ~47 controllers Express) avec une stack moderne cohérente. Les flux de données sont 100% API REST — aucun mock ni localStorage de données métier. Les trois risques prioritaires avant l'ajout du module `agent-service` :

1. **Architecture multi-tenant résiduelle** — complexifie inutilement les requêtes et le modèle de permissions.
2. **Pas de protection CSRF explicite** — le cookie de refresh HTTP-only est vulnérable en l'absence de validation d'origine.
3. **`llm.client.ts` non gardé** — le service LLM doit impérativement avoir une vérification de rôle et un rate limit dédié avant exposition plus large.
