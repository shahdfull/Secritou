export const importHomePage = () => import("@/features/landing/pages/HomePage");
export const importServicesPage = () => import("@/features/landing/pages/ServicesPage");
export const importSolutionsPage = () => import("@/features/landing/pages/SolutionsPage");
export const importCaseStudiesPage = () => import("@/features/landing/pages/CaseStudiesPage");
export const importContactPage = () => import("@/features/landing/pages/ContactPage");
export const importLoginPage = () => import("@/features/auth/LoginPage");
export const importJoinUsPage = () => import("@/features/landing/pages/JoinUsPage");
export const importForgotPasswordPage = () => import("@/features/auth/ForgotPasswordPage");
export const importResetPasswordPage = () => import("@/features/auth/ResetPasswordPage");
export const importDashboardPage = () => import("@/features/dashboard/DashboardPage");
export const importLeadsPage = () => import("@/features/leads/LeadsPage");
export const importClientsPage = () => import("@/features/clients/ClientsPage");
export const importClientDetailPage = () => import("@/features/clients/ClientDetailPage");
export const importFreelancersPage = () => import("@/features/freelancers/FreelancersPage");
export const importFreelancerDetailPage = () => import("@/features/freelancers/FreelancerDetailPage");
export const importProjectsPage = () => import("@/features/projects/ProjectsPage");
export const importTasksPage = () => import("@/features/tasks/TasksPage");
export const importSettingsPage = () => import("@/features/settings/SettingsPage");
export const importNotFoundPage = () => import("@/features/landing/pages/NotFoundPage");
export const importClientDashboardPage = () => import("@/features/client-portal/ClientDashboardPage");
export const importProjectsClientPage = () => import("@/features/client-portal/ProjectsClientPage");
export const importServiceRequestsClientPage = () => import("@/features/client-portal/ServiceRequestsClientPage");
export const importClientProfilePage = () => import("@/features/client-portal/ClientProfilePage");
export const importProposalsClientPage = () => import("@/features/client-portal/ProposalsClientPage");
export const importApprovalsClientPage = () => import("@/features/client-portal/ApprovalsClientPage");
export const importInvoicesClientPage = () => import("@/features/client-portal/InvoicesClientPage");
export const importReportsPage = () => import("@/features/reports/ReportsPage");
export const importAIAssistantPage = () => import("@/features/ai-assistant/AIAssistantPage");
export const importApplicationsPage = () => import("@/features/applications/ApplicationsPage");
export const importChangePasswordPage = () => import("@/features/auth/ChangePasswordPage");
export const importClientOnboardingPage = () => import("@/features/client-onboarding/ClientOnboardingPage");
export const importAdminOnboardingPage = () => import("@/features/admin-onboarding/AdminOnboardingPage");
export const importProposalsPage = () => import("@/features/proposals/ProposalsPage");
export const importApprovalsPage = () => import("@/features/approvals/ApprovalsPage");
export const importInvoicesPage = () => import("@/features/invoices/InvoicesPage");
export const importEnhancedDocumentsPage = () => import("@/features/enhanced-documents/EnhancedDocumentsPage");
export const importClientSuccessPage = () => import("@/features/client-success/ClientSuccessPage");
export const importServiceRequestsAdminPage = () => import("@/features/service-requests/ServiceRequestsAdminPage");
export const importCommercialPage = () => import("@/features/commercial/CommercialPage");
export const importCRMPage = () => import("@/features/crm/CRMPage");
export const importTalentPage = () => import("@/features/talent/TalentPage");
export const importQuestionsClientPage = () => import("@/features/client-portal/QuestionsClientPage");
export const importAdminQuestionsPage = () => import("@/features/questions/AdminQuestionsPage");

export const routePrefetch = {
  home: () => void importHomePage(),
  services: () => void importServicesPage(),
  solutions: () => void importSolutionsPage(),
  caseStudies: () => void importCaseStudiesPage(),
  contact: () => void importContactPage(),
  login: () => void importLoginPage(),
  joinUs: () => void importJoinUsPage(),
  forgotPassword: () => void importForgotPasswordPage(),
  resetPassword: () => void importResetPasswordPage(),
  dashboard: () => void importDashboardPage(),
  leads: () => void importLeadsPage(),
  clients: () => void importClientsPage(),
  clientDetail: () => void importClientDetailPage(),
  freelancers: () => void importFreelancersPage(),
  projects: () => void importProjectsPage(),
  tasks: () => void importTasksPage(),
  settings: () => void importSettingsPage(),
  reports: () => void importReportsPage(),
  ai: () => void importAIAssistantPage(),
  clientDashboard: () => void importClientDashboardPage(),
  clientProjects: () => void importProjectsClientPage(),
  clientRequests: () => void importServiceRequestsClientPage(),
  clientProfile: () => void importClientProfilePage(),
  clientProposals: () => void importProposalsClientPage(),
  clientApprovals: () => void importApprovalsClientPage(),
  clientInvoices: () => void importInvoicesClientPage(),
  applications: () => void importApplicationsPage(),
  proposals: () => void importProposalsPage(),
  approvals: () => void importApprovalsPage(),
  invoices: () => void importInvoicesPage(),
  enhancedDocuments: () => void importEnhancedDocumentsPage(),
  clientSuccess: () => void importClientSuccessPage(),
  serviceRequests: () => void importServiceRequestsAdminPage(),
  commercial: () => void importCommercialPage(),
  crm: () => void importCRMPage(),
  talent: () => void importTalentPage(),
  clientQuestions: () => void importQuestionsClientPage(),
  adminQuestions: () => void importAdminQuestionsPage(),
};
