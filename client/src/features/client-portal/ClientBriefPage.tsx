import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/utils/format";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { projectsApi, BriefQuestion } from "@/api/projects.api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECTION_SIZE = 3; // questions per "step page"
const BRIEF_DRAFT_PREFIX = "client-brief-draft";

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function getDraftStorageKey(projectId: string) {
  return `${BRIEF_DRAFT_PREFIX}:${projectId}`;
}

// ---------------------------------------------------------------------------
// Question renderers
// ---------------------------------------------------------------------------

function BooleanQuestion({
  question,
  value,
  onChange,
}: {
  question: BriefQuestion;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id={question.key}
        checked={value ?? false}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <label htmlFor={question.key} className="text-sm cursor-pointer">
        Oui
      </label>
    </div>
  );
}

function MultiSelectQuestion({
  question,
  value,
  onChange,
}: {
  question: BriefQuestion;
  value: string[] | undefined;
  onChange: (v: string[]) => void;
}) {
  const current = value ?? [];
  const toggle = (opt: string) => {
    onChange(current.includes(opt) ? current.filter((x) => x !== opt) : [...current, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {(question.options ?? []).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={[
            "rounded-full border px-3 py-1 text-sm transition-colors",
            current.includes(opt)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:border-primary/50",
          ].join(" ")}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  readOnly,
}: {
  question: BriefQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly: boolean;
}) {
  if (readOnly) {
    const display =
      Array.isArray(value)
        ? value.join(", ")
        : value === true
        ? "Oui"
        : value === false
        ? "Non"
        : value != null
        ? String(value)
        : ":";
    return <p className="text-sm text-muted-foreground">{display}</p>;
  }

  if (question.type === "boolean") {
    return (
      <BooleanQuestion
        question={question}
        value={value as boolean | undefined}
        onChange={onChange}
      />
    );
  }
  if (question.type === "multiselect") {
    return (
      <MultiSelectQuestion
        question={question}
        value={value as string[] | undefined}
        onChange={onChange}
      />
    );
  }
  if (question.type === "textarea") {
    return (
      <Textarea
        rows={3}
        placeholder="Votre réponse…"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="resize-none"
      />
    );
  }
  if (question.type === "number") {
    return (
      <Input
        type="number"
        placeholder="0"
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    );
  }
  return (
    <Input
      placeholder="Votre réponse…"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ClientBriefPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const draftKey = useMemo(() => getDraftStorageKey(projectId), [projectId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-brief", projectId],
    queryFn: () => projectsApi.getBrief(projectId),
    staleTime: 30_000,
  });

  const submitMutation = useMutation({
    mutationFn: (briefData: Record<string, unknown>) =>
      projectsApi.submitBrief(projectId, briefData),
    onSuccess: () => {
      window.localStorage.removeItem(draftKey);
      qc.invalidateQueries({ queryKey: ["client-brief", projectId] });
      qc.invalidateQueries({ queryKey: ["project-timeline", projectId] });
      toast.success("Votre brief a été envoyé. Merci !");
    },
    onError: () => {
      toast.error("La soumission a échoué. Veuillez réessayer.");
    },
  });

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (!projectId || !data || data.project.briefCompleted || draftRestored) return;

    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { answers?: Record<string, unknown>; step?: number };
      if (parsed.answers && typeof parsed.answers === "object") {
        setAnswers(parsed.answers);
      }
      if (typeof parsed.step === "number" && parsed.step >= 0) {
        setStep(parsed.step);
      }
      setDraftRestored(true);
      toast.info("Votre brouillon du brief a été restauré.");
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [data, draftKey, draftRestored, projectId]);

  useEffect(() => {
    if (!projectId || !data || data.project.briefCompleted) return;
    if (Object.keys(answers).length === 0 && step === 0) return;

    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          answers,
          step,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Best effort only.
    }
  }, [answers, data, draftKey, projectId, step]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-muted-foreground text-center py-20">
        Impossible de charger le questionnaire.
      </p>
    );
  }

  const { project, questions } = data;
  const readOnly = project.briefCompleted;
  const savedAnswers = (project.briefData ?? {}) as Record<string, unknown>;
  const displayAnswers = readOnly ? savedAnswers : answers;

  const sections = chunk(questions, SECTION_SIZE);
  const totalSteps = sections.length;
  const currentSection = sections[step] ?? [];
  const isLastStep = step === totalSteps - 1;

  const currentSectionValid = currentSection.every((q) => {
    if (!q.required) return true;
    const val = displayAnswers[q.key];
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });

  const handleChange = (key: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    submitMutation.mutate({ ...answers });
  };

  if (readOnly) {
    return (
      <section className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/client/projects")} aria-label="Retour aux projets">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Brief client</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
        </div>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Brief soumis</p>
              {project.briefCompletedAt && (
                <p className="text-xs text-green-600">
                  Le {formatDate(project.briefCompletedAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vos réponses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {questions.map((q) => (
              <div key={q.key} className="space-y-1">
                <p className="text-sm font-medium">{q.label}</p>
                <QuestionField
                  question={q}
                  value={savedAnswers[q.key]}
                  onChange={() => {}}
                  readOnly
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/client/projects")} aria-label="Retour aux projets">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Brief client</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {!readOnly && (Object.keys(answers).length > 0 || draftRestored) && (
        <p className="text-xs text-muted-foreground">
          Brouillon enregistré automatiquement sur cet appareil.
        </p>
      )}

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Étape {step + 1} sur {totalSteps}</span>
          <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Questions {step * SECTION_SIZE + 1}–{Math.min((step + 1) * SECTION_SIZE, questions.length)}</span>
            <Badge variant="outline">{project.serviceType ?? "WEB"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentSection.map((q) => (
            <div key={q.key} className="space-y-2">
              <label className="text-sm font-medium">
                {q.label}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </label>
              <QuestionField
                question={q}
                value={answers[q.key]}
                onChange={(v) => handleChange(q.key, v)}
                readOnly={false}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>

        {isLastStep ? (
          <Button
            onClick={handleSubmit}
            disabled={!currentSectionValid || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Envoi en cours…</>
            ) : (
              "Soumettre le brief"
            )}
          </Button>
        ) : (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!currentSectionValid}
          >
            Suivant
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </section>
  );
}
