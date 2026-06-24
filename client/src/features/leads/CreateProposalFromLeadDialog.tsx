import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useCreateProposal } from "@/hooks/useProposals";
import type { Lead } from "@/types/lead";

interface CreateProposalFromLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

// Creates a Proposal pre-filled from a Lead. The proposal still requires a real Client (the
// data model snapshots clientName/email but persists a clientId), so the user picks the target
// client. The lead's name/email are shown read-only and sent as the contact snapshot; sending
// leadId links the two and advances the lead to PROPOSAL server-side.
export function CreateProposalFromLeadDialog({
  lead,
  open,
  onOpenChange,
  onCreated,
}: CreateProposalFromLeadDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [clientId, setClientId] = useState("");

  const { data: clientsResult, isLoading: clientsLoading } = useClients({ pageSize: 200 });
  const clients = useMemo(() => clientsResult?.data ?? [], [clientsResult?.data]);
  const createProposal = useCreateProposal();

  // Reset the form whenever the dialog opens for a (possibly different) lead.
  useEffect(() => {
    if (open && lead) {
      setTitle(t("proposals.fromLead.defaultTitle", { name: lead.name }));
      setAmount("");
      setClientId("");
    }
  }, [open, lead, t]);

  const handleSubmit = () => {
    if (!lead || !clientId || !title.trim()) return;
    const parsedAmount = amount.trim() === "" ? undefined : Number(amount);
    createProposal.mutate(
      {
        title: title.trim(),
        clientId,
        clientName: lead.name,
        email: lead.email,
        leadId: lead.id,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onCreated?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("proposals.fromLead.title")}</DialogTitle>
          <DialogDescription>
            {t("proposals.fromLead.description", { name: lead?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read-only contact snapshot carried from the lead */}
          <div className="grid grid-cols-2 gap-4 rounded-md border p-3 bg-muted/40 text-sm">
            <div>
              <p className="text-muted-foreground">{t("common.name")}</p>
              <p className="font-medium">{lead?.name ?? ":"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("common.email")}</p>
              <p className="font-medium">{lead?.email ?? ":"}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("proposals.proposalTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("proposals.fromLead.targetClient")}</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={clientsLoading}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    clientsLoading
                      ? t("common.loading")
                      : t("proposals.fromLead.selectClient")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("proposals.amount")}</Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createProposal.isPending || !clientId || !title.trim()}
          >
            {createProposal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("proposals.fromLead.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
