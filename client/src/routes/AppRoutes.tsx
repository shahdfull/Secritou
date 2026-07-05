import { lazy, memo } from "react";
import { Loader2 } from "lucide-react";
import { Outlet, Route, Routes, Navigate } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LandingCmsProvider } from "@/providers/LandingCmsProvider";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { FreelancerLayout } from "@/components/layout/FreelancerLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import { WhatsAppButton } from "@/components/WhatsAppButton";

const LegalPage = lazy(() => import("@/features/landing/pages/LegalPage").then((m) => ({ default: m.LegalPage })));
const PrivacyPage = lazy(() => import("@/features/landing/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
import { RouteBoundary } from "@/components/common/RouteBoundary";
import { MustChangePasswordGuard } from "@/components/MustChangePasswordGuard";
import { useAuthStore } from "@/store/auth.store";
import {
  importClientDashboardPage,
  importClientDetailPage,
  importClientProfilePage,
  importClientsPage,
  importCaseStudiesPage,
  importContactPage,
  importDashboardPage,
  importForgotPasswordPage,
  importFreelancersPage,
  importFreelancerDetailPage,
  importHomePage,
  importLeadsPage,
  importLoginPage,
  importNotFoundPage,
  importJoinUsPage,
  importProjectsClientPage,
  importProjectsPage,
  importProjectDetailPage,
  importReportsPage,
  importResetPasswordPage,
  importServiceRequestsClientPage,
  importServicesPage,
  importSettingsPage,
  importSolutionsPage,
  importApplicationsPage,
  importChangePasswordPage,
  importClientOnboardingPage,
  importAdminOnboardingPage,
  importProposalsPage,
  importApprovalsPage,
  importInvoicesPage,
  importDocumentsPage,
  importClientSuccessPage,
  importServiceRequestsAdminPage,
  importCommercialPage,
  importCRMPage,
  importAIAssistantPage,
  importTalentPage,
  importProposalsClientPage,
  importApprovalsClientPage,
  importInvoicesClientPage,
  importQuestionsClientPage,
  importAdminQuestionsPage,
  importDocumentsClientPage,
  importClientBriefPage,
  importOnboardingClientPage,
  importFreelancerDashboardPage,
} from "./routePrefetch";

// Lazy load route components for code splitting (handle named exports)
const HomePage = lazy(() => importHomePage().then((m) => ({ default: m.HomePage })));
const ServicesPage = lazy(() => importServicesPage().then((m) => ({ default: m.ServicesPage })));
const SolutionsPage = lazy(() => importSolutionsPage().then((m) => ({ default: m.SolutionsPage })));
const CaseStudiesPage = lazy(() => importCaseStudiesPage().then((m) => ({ default: m.CaseStudiesPage })));
const ContactPage = lazy(() => importContactPage().then((m) => ({ default: m.ContactPage })));
const LoginPage = lazy(() => importLoginPage().then((m) => ({ default: m.LoginPage })));
const JoinUsPage = lazy(() => importJoinUsPage().then((m) => ({ default: m.JoinUsPage })));
const ForgotPasswordPage = lazy(() => importForgotPasswordPage().then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => importResetPasswordPage().then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => importDashboardPage().then((m) => ({ default: m.DashboardPage })));
const LeadsPage = lazy(() => importLeadsPage().then((m) => ({ default: m.LeadsPage })));
const ClientsPage = lazy(() => importClientsPage().then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => importClientDetailPage().then((m) => ({ default: m.ClientDetailPage })));
const FreelancersPage = lazy(() => importFreelancersPage().then((m) => ({ default: m.FreelancersPage })));
const FreelancerDetailPage = lazy(() => importFreelancerDetailPage().then((m) => ({ default: m.FreelancerDetailPage })));
const ProjectsPage = lazy(() => importProjectsPage().then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => importProjectDetailPage().then((m) => ({ default: m.ProjectDetailPage })));
const SettingsPage = lazy(() => importSettingsPage().then((m) => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => importNotFoundPage().then((m) => ({ default: m.NotFoundPage })));
const ClientDashboardPage = lazy(() => importClientDashboardPage().then((m) => ({ default: m.ClientDashboardPage })));
const ProjectsClientPage = lazy(() => importProjectsClientPage().then((m) => ({ default: m.ProjectsClientPage })));
const ServiceRequestsClientPage = lazy(() => importServiceRequestsClientPage().then((m) => ({ default: m.ServiceRequestsClientPage })));
const ClientProfilePage = lazy(() => importClientProfilePage().then((m) => ({ default: m.ClientProfilePage })));
const ReportsPage = lazy(() => importReportsPage().then((m) => ({ default: m.ReportsPage })));
const ApplicationsPage = lazy(() => importApplicationsPage().then((m) => ({ default: m.ApplicationsPage })));
const ChangePasswordPage = lazy(() => importChangePasswordPage().then((m) => ({ default: m.ChangePasswordPage })));
const ClientOnboardingPage = lazy(() => importClientOnboardingPage().then((m) => ({ default: m.ClientOnboardingPage })));
const AdminOnboardingPage = lazy(() => importAdminOnboardingPage().then((m) => ({ default: m.AdminOnboardingPage })));
const ProposalsPage = lazy(() => importProposalsPage().then((m) => ({ default: m.ProposalsPage })));
const ApprovalsPage = lazy(() => importApprovalsPage().then((m) => ({ default: m.ApprovalsPage })));
const InvoicesPage = lazy(() => importInvoicesPage().then((m) => ({ default: m.InvoicesPage })));
const DocumentsPage = lazy(() => importDocumentsPage().then((m) => ({ default: m.DocumentsPage })));
const ClientSuccessPage = lazy(() => importClientSuccessPage().then((m) => ({ default: m.ClientSuccessPage })));
const ServiceRequestsAdminPage = lazy(() =>
  importServiceRequestsAdminPage().then((m) => ({ default: m.ServiceRequestsAdminPage }))
);
const CommercialPage = lazy(() =>
  importCommercialPage().then((m) => ({ default: m.CommercialPage }))
);
const CRMPage = lazy(() => importCRMPage().then((m) => ({ default: m.CRMPage })));
const AIAssistantPage = lazy(() => importAIAssistantPage().then((m) => ({ default: m.AIAssistantPage })));
const TalentPage = lazy(() => importTalentPage().then((m) => ({ default: m.TalentPage })));
const ProposalsClientPage = lazy(() => importProposalsClientPage().then((m) => ({ default: m.ProposalsClientPage })));
const ApprovalsClientPage = lazy(() => importApprovalsClientPage().then((m) => ({ default: m.ApprovalsClientPage })));
const InvoicesClientPage = lazy(() => importInvoicesClientPage().then((m) => ({ default: m.InvoicesClientPage })));
const QuestionsClientPage = lazy(() => importQuestionsClientPage().then((m) => ({ default: m.QuestionsClientPage })));
const AdminQuestionsPage = lazy(() => importAdminQuestionsPage().then((m) => ({ default: m.AdminQuestionsPage })));
const DocumentsClientPage = lazy(() => importDocumentsClientPage().then((m) => ({ default: m.DocumentsClientPage })));
const ClientBriefPage = lazy(() => importClientBriefPage().then((m) => ({ default: m.ClientBriefPage })));
const OnboardingClientPage = lazy(() => importOnboardingClientPage().then((m) => ({ default: m.OnboardingClientPage })));
const FreelancerDashboardPage = lazy(() => importFreelancerDashboardPage().then((m) => ({ default: m.FreelancerDashboardPage })));
const TasksPage = lazy(() => import("@/features/tasks/TasksPage").then((m) => ({ default: m.TasksPage })));
const ClientProfitabilityPage = lazy(() =>
  import("@/features/analytics/ClientProfitabilityPage").then((m) => ({ default: m.ClientProfitabilityPage }))
);

function AppLayout() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "FREELANCER" ? <FreelancerLayout /> : <AdminLayout />;
}

function PageLoader() {
  return (
    <div className="container-page py-20 flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const MarketingLayout = memo(function MarketingLayout() {
  return (
    <LandingCmsProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </LandingCmsProvider>
  );
});

function withBoundary(element: React.ReactNode) {
  return <RouteBoundary suspenseFallback={<PageLoader />}>{element}</RouteBoundary>;
}

export function AppRoutes() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={withBoundary(<HomePage />)} />
        <Route path="services" element={withBoundary(<ServicesPage />)} />
        <Route path="solutions" element={withBoundary(<SolutionsPage />)} />
        <Route path="case-studies" element={withBoundary(<CaseStudiesPage />)} />
        <Route path="contact" element={withBoundary(<ContactPage />)} />
        <Route path="mentions-legales" element={withBoundary(<LegalPage />)} />
        <Route path="confidentialite" element={withBoundary(<PrivacyPage />)} />
        <Route path="login" element={withBoundary(<LoginPage />)} />
        <Route path="rejoindre" element={withBoundary(<JoinUsPage />)} />
        <Route path="forgot-password" element={withBoundary(<ForgotPasswordPage />)} />
        <Route path="reset-password" element={withBoundary(<ResetPasswordPage />)} />
      </Route>

      <Route path="change-password" element={withBoundary(<ChangePasswordPage />)} />

      <Route element={<MustChangePasswordGuard />}>
        <Route
          path="app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="freelancer-dashboard" element={withBoundary(<FreelancerDashboardPage />)} />
          <Route index element={withBoundary(<DashboardPage />)} />
          <Route path="crm" element={withBoundary(<CRMPage />)} />
          <Route path="ai" element={withBoundary(<AIAssistantPage />)} />
          <Route path="leads" element={<Navigate to="/app/crm" replace />} />
          <Route path="clients" element={<Navigate to="/app/crm" replace />} />
          <Route path="clients/:id" element={withBoundary(<ClientDetailPage />)} />
          <Route path="talent" element={withBoundary(<TalentPage />)} />
          <Route path="applications" element={<Navigate to="/app/talent" replace />} />
          <Route path="freelancers" element={<Navigate to="/app/talent" replace />} />
          <Route path="freelancers/:id" element={withBoundary(<FreelancerDetailPage />)} />
          <Route path="projects" element={withBoundary(<ProjectsPage />)} />
          <Route path="projects/:id" element={withBoundary(<ProjectDetailPage />)} />
          <Route path="tasks" element={withBoundary(<TasksPage />)} />
              <Route path="analytics" element={<Navigate to="/app" replace />} />
              <Route path="analytics/clients" element={withBoundary(<ClientProfitabilityPage />)} />
              <Route path="reports" element={withBoundary(<ReportsPage />)} />
              <Route path="commercial" element={withBoundary(<CommercialPage />)} />
              <Route path="service-requests" element={withBoundary(<ServiceRequestsAdminPage />)} />
              <Route path="invoices" element={withBoundary(<InvoicesPage />)} />
              <Route path="approvals" element={<Navigate to="/app/projects" replace />} />
              <Route path="proposals" element={<Navigate to="/app/commercial" replace />} />
              <Route path="documents" element={withBoundary(<DocumentsPage />)} />
              <Route path="client-success/:clientId" element={withBoundary(<ClientSuccessPage />)} />
              <Route path="client-onboardings" element={<Navigate to="/app/crm" replace />} />
              <Route path="client-onboarding/:onboardingId" element={withBoundary(<ClientOnboardingPage />)} />
              <Route path="settings" element={withBoundary(<SettingsPage />)} />
              <Route path="questions" element={withBoundary(<AdminQuestionsPage />)} />
              <Route path="questions/:id" element={withBoundary(<AdminQuestionsPage />)} />
        </Route>

        <Route
          path="client"
          element={
            <ProtectedRoute>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={withBoundary(<ClientDashboardPage />)} />
          <Route path="projects" element={withBoundary(<ProjectsClientPage />)} />
          <Route path="requests" element={withBoundary(<ServiceRequestsClientPage />)} />
          <Route path="proposals" element={withBoundary(<ProposalsClientPage />)} />
          <Route path="proposals/:id" element={withBoundary(<ProposalsClientPage />)} />
          <Route path="approvals" element={withBoundary(<ApprovalsClientPage />)} />
          <Route path="invoices" element={withBoundary(<InvoicesClientPage />)} />
          <Route path="profile" element={withBoundary(<ClientProfilePage />)} />
          <Route path="questions" element={withBoundary(<QuestionsClientPage />)} />
          <Route path="questions/:id" element={withBoundary(<QuestionsClientPage />)} />
          <Route path="documents" element={withBoundary(<DocumentsClientPage />)} />
          <Route path="brief/:projectId" element={withBoundary(<ClientBriefPage />)} />
          <Route path="onboarding" element={withBoundary(<OnboardingClientPage />)} />
        </Route>
      </Route>

      <Route path="*" element={withBoundary(<NotFoundPage />)} />
    </Routes>
    </>
  );
}