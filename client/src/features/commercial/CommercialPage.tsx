import { TabErrorBoundary } from "@/components/ui/TabErrorBoundary";
import { ProposalsPage } from "@/features/proposals/ProposalsPage";

export function CommercialPage() {
  return (
    <TabErrorBoundary>
      <ProposalsPage />
    </TabErrorBoundary>
  );
}
