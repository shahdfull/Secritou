import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, type LucideIcon } from "lucide-react";

// RG-026 : composant unique pour les 3 niveaux de confirmation UX (voir REFERENTIEL.md §5).
// Niveau 1 (simple) = les usages existants de ConfirmDeleteDialog/ConfirmActionDialog restent
// valables tels quels — ce composant sert Niveau 2 (renforcé), qui exige une action volontaire
// distincte du simple clic "Confirmer" (case à cocher obligatoire), en plus du rappel nommé de
// l'entité concernée et de l'explicitation du caractère irréversible.
interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  /** Doit nommer explicitement l'entité concernée (montant, client, créneau...) et son caractère irréversible. */
  description: React.ReactNode;
  /** Libellé de la case à cocher obligatoire — doit reformuler l'engagement pris, pas un simple "je confirme". */
  checkboxLabel: React.ReactNode;
  isLoading?: boolean;
  icon?: LucideIcon;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  checkboxLabel,
  isLoading = false,
  icon: Icon,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
}: ConfirmationDialogProps) {
  const [checked, setChecked] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return;
    if (!next) setChecked(false);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 py-2">
          <Checkbox id="confirmation-dialog-checkbox" checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
          <label htmlFor="confirmation-dialog-checkbox" className="text-sm leading-snug cursor-pointer">
            {checkboxLabel}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={!checked || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {Icon && <Icon className="h-4 w-4 mr-2" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
