import { Suspense, lazy } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Lazy load route components for code splitting (handle named exports)
const HomePage = lazy(() => import("@/features/landing/pages/HomePage").then(m => ({ default: m.HomePage })));
const ServicesPage = lazy(() => import("@/features/landing/pages/ServicesPage").then(m => ({ default: m.ServicesPage })));
const SolutionsPage = lazy(() => import("@/features/landing/pages/SolutionsPage").then(m => ({ default: m.SolutionsPage })));
const CaseStudiesPage = lazy(() => import("@/features/landing/pages/CaseStudiesPage").then(m => ({ default: m.CaseStudiesPage })));
const ContactPage = lazy(() => import("@/features/landing/pages/ContactPage").then(m => ({ default: m.ContactPage })));
const LoginPage = lazy(() => import("@/features/auth/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage").then(m => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const LeadsPage = lazy(() => import("@/features/leads/LeadsPage").then(m => ({ default: m.LeadsPage })));
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
const ClientsPage = lazy(() => import("@/features/clients/ClientsPage").then(m => ({ default: m.ClientsPage })));
const FreelancersPage = lazy(() => import("@/features/freelancers/FreelancersPage").then(m => ({ default: m.FreelancersPage })));
const MissionsPage = lazy(() => import("@/features/missions/MissionsPage").then(m => ({ default: m.MissionsPage })));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const TasksPage = lazy(() => import("@/features/tasks/TasksPage").then(m => ({ default: m.TasksPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import("@/features/landing/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));
const ClientDashboardPage = lazy(() => import("@/features/client-portal/ClientDashboardPage").then(m => ({ default: m.ClientDashboardPage })));
const ProjectsClientPage = lazy(() => import("@/features/client-portal/ProjectsClientPage").then(m => ({ default: m.ProjectsClientPage })));
const ServiceRequestsClientPage = lazy(() => import("@/features/client-portal/ServiceRequestsClientPage").then(m => ({ default: m.ServiceRequestsClientPage })));

function PageLoader() {
  return (
    <div className="container-page py-20 flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="solutions" element={<SolutionsPage />} />
          <Route path="case-studies" element={<CaseStudiesPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        <Route
          path="app"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="freelancers" element={<FreelancersPage />} />
          <Route path="missions" element={<MissionsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="client"
          element={
            <ProtectedRoute>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientDashboardPage />} />
          <Route path="projects" element={<ProjectsClientPage />} />
          <Route path="requests" element={<ServiceRequestsClientPage />} />
          <Route path="profile" element={<div>Profil (à venir)</div>} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
