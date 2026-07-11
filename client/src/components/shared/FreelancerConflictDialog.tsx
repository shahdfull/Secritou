import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { FreelancerConflict } from "@/types/task";

interface FreelancerConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: FreelancerConflict[];
  onConfirm: () => void;
  isConfirming?: boolean;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

// Shown when checkFreelancerAvailability finds overlapping tasks before an assignment is
// submitted. Double-booking is allowed intentionally (e.g. light part-time work) — this warns
// rather than blocks, requiring an explicit "assign anyway" instead of a silent success.
export function FreelancerConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
  isConfirming = false,
}: FreelancerConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Conflit de disponibilité
          </DialogTitle>
          <DialogDescription>
            Ce freelance a {conflicts.length} engagement{conflicts.length > 1 ? "s" : ""} qui{" "}
            {conflicts.length > 1 ? "chevauchent" : "chevauche"} cette période. Vous pouvez
            assigner quand même si c'est intentionnel (ex. mission à temps partiel).
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {conflicts.map((c) => (
            <li key={c.taskId} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{c.title}</p>
              <p className="text-muted-foreground">
                {c.projectName ?? "Projet"} · {formatDate(c.startDate)} – {formatDate(c.dueDate)}
              </p>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={isConfirming}>
            {isConfirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assigner quand même
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
