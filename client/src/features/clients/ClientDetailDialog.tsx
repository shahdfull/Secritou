import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Client } from "@/types/client";

interface ClientDetailDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailDialog({ client, open, onOpenChange }: ClientDetailDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{client?.name}</DialogTitle>
          <DialogDescription>{t("clientsPage.detailDesc")}</DialogDescription>
        </DialogHeader>

        {client && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("clientsPage.emailLabel")}</span>
              <span className="font-medium">{client.email || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("clientsPage.phoneLabel")}</span>
              <span className="font-medium">{client.phone || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("clientsPage.detail.clientSince")}</span>
              <span className="font-medium">{formatDate(client.createdAt)}</span>
            </div>
            {client.creditBalance != null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("clientsPage.creditBalanceLabel")}</span>
                <span className="font-medium">{client.creditBalance} TND</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
