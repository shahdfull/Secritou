import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, type LucideIcon } from "lucide-react";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  isLoading?: boolean;
  /** Icône affichée à côté du bouton de confirmation. */
  icon?: LucideIcon;
  /** Libellé du bouton de confirmation (ex: "Convertir", "Rouvrir"). */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation. */
  cancelLabel?: string;
  /** Variante visuelle du bouton de confirmation. "destructive" pour les suppressions, "default" sinon. */
  variant?: "default" | "destructive";
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Confirmer l'action",
  description = "Êtes-vous sûr de vouloir effectuer cette action ?",
  isLoading = false,
  icon: Icon,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {Icon && <Icon className="h-4 w-4 mr-2" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}