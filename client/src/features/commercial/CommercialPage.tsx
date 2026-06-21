import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceRequestsAdminPage } from "@/features/service-requests/ServiceRequestsAdminPage";
import { ProposalsPage } from "@/features/proposals/ProposalsPage";
import { ApprovalsPage } from "@/features/approvals/ApprovalsPage";
import { InvoicesPage } from "@/features/invoices/InvoicesPage";
import { TabErrorBoundary } from "@/components/ui/TabErrorBoundary";
import { useTranslation } from "react-i18next";

export function CommercialPage() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="service-requests" className="space-y-6">
      <TabsList>
        <TabsTrigger value="service-requests">{t("commercial.tabs.serviceRequests")}</TabsTrigger>
        <TabsTrigger value="proposals">{t("commercial.tabs.proposals")}</TabsTrigger>
        <TabsTrigger value="approvals">{t("commercial.tabs.approvals")}</TabsTrigger>
        <TabsTrigger value="invoices">{t("commercial.tabs.invoices")}</TabsTrigger>
      </TabsList>

      <TabsContent value="service-requests">
        <TabErrorBoundary>
          <ServiceRequestsAdminPage />
        </TabErrorBoundary>
      </TabsContent>

      <TabsContent value="proposals">
        <TabErrorBoundary>
          <ProposalsPage />
        </TabErrorBoundary>
      </TabsContent>

      <TabsContent value="approvals">
        <TabErrorBoundary>
          <ApprovalsPage />
        </TabErrorBoundary>
      </TabsContent>

      <TabsContent value="invoices">
        <TabErrorBoundary>
          <InvoicesPage />
        </TabErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}
