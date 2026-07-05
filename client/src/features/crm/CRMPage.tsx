import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { LeadsPage } from "@/features/leads/LeadsPage";
import { ClientsPage } from "@/features/clients/ClientsPage";

export function CRMPage() {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="leads" className="space-y-6">
      <TabsList className="bg-primary-soft/30 border border-primary/10">
        <TabsTrigger value="leads">{t("sidebar.leads")}</TabsTrigger>
        <TabsTrigger value="clients">{t("sidebar.clients")}</TabsTrigger>
      </TabsList>
      <TabsContent value="leads">
        <LeadsPage />
      </TabsContent>
      <TabsContent value="clients">
        <ClientsPage />
      </TabsContent>
    </Tabs>
  );
}
