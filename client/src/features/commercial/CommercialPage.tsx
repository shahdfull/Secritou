import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceRequestsAdminPage } from "@/features/service-requests/ServiceRequestsAdminPage";
import { ProposalsPage } from "@/features/proposals/ProposalsPage";

export function CommercialPage() {
  const [activeTab, setActiveTab] = useState("service-requests");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <TabsList className="rounded-none border-b bg-background p-0 h-auto w-full justify-start px-6">
        <TabsTrigger
          value="service-requests"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
        >
          Demandes de service
        </TabsTrigger>
        <TabsTrigger
          value="proposals"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
        >
          Propositions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="service-requests" className="flex-1 overflow-hidden m-0">
        <ServiceRequestsAdminPage />
      </TabsContent>

      <TabsContent value="proposals" className="flex-1 overflow-hidden m-0">
        <ProposalsPage />
      </TabsContent>
    </Tabs>
  );
}
