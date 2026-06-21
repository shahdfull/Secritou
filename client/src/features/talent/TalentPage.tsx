import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { ApplicationsPage } from "@/features/applications/ApplicationsPage";
import { FreelancersPage } from "@/features/freelancers/FreelancersPage";
import { MissionsPage } from "@/features/missions/MissionsPage";
import { FreelancerPaymentsPage } from "./FreelancerPaymentsPage";

export function TalentPage() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="applications" className="space-y-6">
      <TabsList>
        <TabsTrigger value="applications">{t("sidebar.applications")}</TabsTrigger>
        <TabsTrigger value="freelancers">{t("sidebar.freelancers")}</TabsTrigger>
        <TabsTrigger value="missions">{t("sidebar.missions")}</TabsTrigger>
        <TabsTrigger value="payments">{t("payments.tab", "Paiements")}</TabsTrigger>
      </TabsList>
      <TabsContent value="applications">
        <ApplicationsPage />
      </TabsContent>
      <TabsContent value="freelancers">
        <FreelancersPage />
      </TabsContent>
      <TabsContent value="missions">
        <MissionsPage />
      </TabsContent>
      <TabsContent value="payments">
        <FreelancerPaymentsPage />
      </TabsContent>
    </Tabs>
  );
}
