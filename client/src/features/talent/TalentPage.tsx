import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { ApplicationsPage } from "@/features/applications/ApplicationsPage";
import { FreelancersPage } from "@/features/freelancers/FreelancersPage";

export function TalentPage() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="applications" className="space-y-6">
      <TabsList>
        <TabsTrigger value="applications">{t("sidebar.applications")}</TabsTrigger>
        <TabsTrigger value="freelancers">{t("sidebar.freelancers")}</TabsTrigger>
      </TabsList>
      <TabsContent value="applications">
        <ApplicationsPage />
      </TabsContent>
      <TabsContent value="freelancers">
        <FreelancersPage />
      </TabsContent>
    </Tabs>
  );
}
