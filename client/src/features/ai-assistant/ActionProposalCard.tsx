// SEC-059 follow-up: renders a confirmation card for an AI action proposal — non-negotiable design
// rule (explicit product decision): the model never writes directly, this card is the ONLY path
// from a proposal to a real write, and it goes through the exact same REST mutations/hooks every
// other part of the app already uses (useCreateTask/useUpdateTask/useUpdateLeadStatus) — no new
// API surface, no bypass of the validation/scoping those hooks' endpoints already enforce.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { useUpdateLeadStatus } from "@/hooks/useLeads";
import type { AiActionProposal } from "./actionProposal";

// A decision made this session is never persisted server-side (see aiConversation.service.ts's
// own doctrine: AiMessage/AiConversation carry chat history, not a proposal-decision log) — a page
// reload re-renders the card in its original actionable state even after a real decision was made
// earlier. This is an accepted trade-off (explicit product decision), not an oversight: the
// created Task / updated Lead/Task status is itself the durable record of what happened; a stale
// card reappearing after reload can, at worst, be clicked again — the confirm handlers below all
// call idempotent-enough real endpoints (a second identical status update is a no-op write, a
// second create makes a duplicate task, which the user sees immediately in the confirmation and
// can delete like any other task).
type Decision = "pending" | "confirmed" | "cancelled" | "error";

function useProposalDecision() {
  const [decision, setDecision] = useState<Decision>("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  return { decision, setDecision, errorMessage, setErrorMessage };
}

function ProposalActions({
  isPending,
  decision,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  isPending: boolean;
  decision: Decision;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  if (decision === "confirmed") {
    return (
      <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        {t("aiAssistant.proposal.confirmed", "Action effectuée")}
      </div>
    );
  }
  if (decision === "cancelled") {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <XCircle className="h-4 w-4" />
        {t("aiAssistant.proposal.cancelled", "Proposition annulée")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {decision === "error" && errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={isPending} className="gap-1.5">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("aiAssistant.proposal.confirm", "Confirmer")}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isPending}>
          {t("aiAssistant.proposal.cancel", "Annuler")}
        </Button>
      </div>
    </div>
  );
}

function CreateTaskProposalCard({ proposal }: { proposal: Extract<AiActionProposal, { type: "createTask"; valid: true }> }) {
  const { t } = useTranslation();
  const { decision, setDecision, errorMessage, setErrorMessage } = useProposalDecision();
  const createMutation = useCreateTask();

  const handleConfirm = () => {
    createMutation.mutate(
      { title: proposal.title, description: proposal.description, projectId: proposal.projectId, assigneeId: proposal.assigneeId },
      {
        onSuccess: () => setDecision("confirmed"),
        onError: (err) => {
          setErrorMessage(err.message);
          setDecision("error");
        },
      }
    );
  };

  return (
    <Card className="mt-2 border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-3">
        <p className="mb-2 text-sm">
          {t("aiAssistant.proposal.createTask", "Créer la tâche « {{title}} » sur le projet « {{project}} » ?", {
            title: proposal.title,
            project: proposal.projectName,
          })}
        </p>
        <ProposalActions
          isPending={createMutation.isPending}
          decision={decision}
          errorMessage={errorMessage}
          onConfirm={handleConfirm}
          onCancel={() => setDecision("cancelled")}
        />
      </CardContent>
    </Card>
  );
}

function UpdateLeadStatusProposalCard({ proposal }: { proposal: Extract<AiActionProposal, { type: "updateLeadStatus"; valid: true }> }) {
  const { t } = useTranslation();
  const { decision, setDecision, errorMessage, setErrorMessage } = useProposalDecision();
  const updateMutation = useUpdateLeadStatus();

  const handleConfirm = () => {
    updateMutation.mutate(
      { id: proposal.leadId, status: proposal.toStatus },
      {
        onSuccess: () => setDecision("confirmed"),
        onError: (err) => {
          setErrorMessage(err.message);
          setDecision("error");
        },
      }
    );
  };

  return (
    <Card className="mt-2 border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-3">
        <p className="mb-2 text-sm">
          {t(
            "aiAssistant.proposal.updateLeadStatus",
            "Passer le lead « {{name}} » de {{from}} à {{to}} ?",
            { name: proposal.leadName, from: proposal.fromStatus, to: proposal.toStatus }
          )}
        </p>
        <ProposalActions
          isPending={updateMutation.isPending}
          decision={decision}
          errorMessage={errorMessage}
          onConfirm={handleConfirm}
          onCancel={() => setDecision("cancelled")}
        />
      </CardContent>
    </Card>
  );
}

function UpdateTaskStatusProposalCard({ proposal }: { proposal: Extract<AiActionProposal, { type: "updateTaskStatus"; valid: true }> }) {
  const { t } = useTranslation();
  const { decision, setDecision, errorMessage, setErrorMessage } = useProposalDecision();
  const updateMutation = useUpdateTask();

  const handleConfirm = () => {
    updateMutation.mutate(
      { id: proposal.taskId, data: { status: proposal.toStatus } },
      {
        onSuccess: () => setDecision("confirmed"),
        onError: (err) => {
          setErrorMessage(err.message);
          setDecision("error");
        },
      }
    );
  };

  return (
    <Card className="mt-2 border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-3">
        <p className="mb-2 text-sm">
          {t(
            "aiAssistant.proposal.updateTaskStatus",
            "Passer la tâche « {{title}} » de {{from}} à {{to}} ?",
            { title: proposal.taskTitle, from: proposal.fromStatus, to: proposal.toStatus }
          )}
        </p>
        <ProposalActions
          isPending={updateMutation.isPending}
          decision={decision}
          errorMessage={errorMessage}
          onConfirm={handleConfirm}
          onCancel={() => setDecision("cancelled")}
        />
      </CardContent>
    </Card>
  );
}

// An invalid proposal (valid: false — e.g. an out-of-scope project, an illegal status transition)
// is rendered read-only: the model already explained the reason in its visible text per
// SYSTEM_PROMPT's instruction, this card just makes the "why" visually explicit rather than
// silently dropping the proposal envelope.
function InvalidProposalCard({ reason }: { reason: string }) {
  return (
    <Card className="mt-2 border-destructive/30 bg-destructive/[0.03]">
      <CardContent className="flex items-center gap-1.5 p-3 text-sm text-destructive">
        <XCircle className="h-4 w-4 shrink-0" />
        {reason}
      </CardContent>
    </Card>
  );
}

export function ActionProposalCard({ proposal }: { proposal: AiActionProposal }) {
  if (!proposal.valid) return <InvalidProposalCard reason={proposal.reason} />;
  switch (proposal.type) {
    case "createTask":
      return <CreateTaskProposalCard proposal={proposal} />;
    case "updateLeadStatus":
      return <UpdateLeadStatusProposalCard proposal={proposal} />;
    case "updateTaskStatus":
      return <UpdateTaskStatusProposalCard proposal={proposal} />;
  }
}
