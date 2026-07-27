import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { LeadsPage } from "@/features/leads/LeadsPage";
import { ClientsPage } from "@/features/clients/ClientsPage";
import { useLeads } from "@/hooks/useLeads";
import { useClients } from "@/hooks/useClients";

export function CRMPage() {
  const { t } = useTranslation();
  // Minimal page size: we only need `.total` for the tab badges, not the rows
  // themselves — LeadsPage/ClientsPage fetch their own full lists separately.
  const { data: leadsResult } = useLeads({ page: 1, pageSize: 1 });
  const { data: clientsResult } = useClients({ page: 1, pageSize: 1 });

  return (
    <Tabs defaultValue="leads" className="space-y-6">
      <TabsList className="bg-primary-soft/30 border border-primary/10">
        <TabsTrigger value="leads" className="gap-1.5">
          {t("sidebar.leads")}
          {leadsResult && (
            <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">
              {leadsResult.total}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="clients" className="gap-1.5">
          {t("sidebar.clients")}
          {clientsResult && (
            <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">
              {clientsResult.total}
            </Badge>
          )}
        </TabsTrigger>
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