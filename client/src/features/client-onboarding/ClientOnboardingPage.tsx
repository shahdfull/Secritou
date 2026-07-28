import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useParams, Link } from "react-router-dom";
import { formatDateTime } from "@/utils/format";
import {
  useClientOnboarding,
  useUpdateOnboardingStep,
  useUpdateContract,
  useUpdateQuestionnaire,
} from "@/hooks/useClientOnboarding";
import type { OnboardingStep } from "@secritou/shared";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/crud/ConfirmationDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/utils/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getOnboardingStatusBadgeClass } from "@/utils/statusColors";
import {
  CheckCircle2,
  Circle,
  FileText,
  CreditCard,
  FileQuestion,
  Briefcase,
  Calendar,
  LineChart,
  Download,
} from "lucide-react";
import { toast } from "sonner";

const QUESTIONNAIRE_DRAFT_PREFIX = "client-onboarding-questionnaire-draft";

function getQuestionnaireDraftKey(questionnaireId: string) {
  return `${QUESTIONNAIRE_DRAFT_PREFIX}:${questionnaireId}`;
}

export function QuestionnaireStep({
  step,
  updateQuestionnaire,
  t,
}: {
  step: OnboardingStep;
  updateQuestionnaire: ReturnType<typeof useUpdateQuestionnaire>;
  t: TFunction;
}) {
  const questionnaireId = step.questionnaire?.id;
  const draftKey = questionnaireId ? getQuestionnaireDraftKey(questionnaireId) : null;

  const [serviceType, setServiceType] = useState(step.questionnaire?.serviceType || "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);

  // Same pattern as ClientBriefPage.tsx: best-effort localStorage autosave, restored
  // transparently on return — a multi-field questionnaire (up to 4 dynamic fields per
  // service type, on top of the type selector) can be lost to a tab close or network blip
  // between explicit "Save Draft" clicks.
  useEffect(() => {
    if (!draftKey || !step.questionnaire?.isDraft || draftRestored) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { serviceType?: string; fields?: Record<string, string> };
      if (typeof parsed.serviceType === "string") setServiceType(parsed.serviceType);
      if (parsed.fields && typeof parsed.fields === "object") setFields(parsed.fields);
      setDraftRestored(true);
      toast.info(t("onboarding.questionnaire.draftRestored"));
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, draftRestored, step.questionnaire?.isDraft, t]);

  useEffect(() => {
    if (!draftKey || !step.questionnaire?.isDraft) return;
    if (!serviceType && Object.keys(fields).length === 0) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ serviceType, fields }));
    } catch {
      // Best effort only.
    }
  }, [draftKey, fields, serviceType, step.questionnaire?.isDraft]);

  const handleSave = (isDraft: boolean) => {
    // step.questionnaire is guaranteed non-null here: this form only renders past the
    // `!step.questionnaire` early return below.
    // SEC-051 fix: `fields` (the dynamic per-serviceType answers — companyName/colors/
    // references/pages, etc.) must be nested under `data` — that's the only key the server
    // persists (clientOnboarding.repository.ts#updateQuestionnaire writes serviceType/isDraft/
    // data.data). Spreading `fields` at the top level silently discarded every answer.
    updateQuestionnaire.mutate(
      {
        questionnaireId: step.questionnaire!.id,
        data: { serviceType, data: fields, isDraft },
      },
      {
        onSuccess: () => {
          if (!isDraft && draftKey) window.localStorage.removeItem(draftKey);
        },
      }
    );
  };

  if (!step.questionnaire) return <p className="text-muted-foreground">{t("onboarding.questionnaire.notReady")}</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold">{t("onboarding.questionnaire.title")}</h3>
      <p className="text-muted-foreground">{t("onboarding.questionnaire.subtitle")}</p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">{t("onboarding.questionnaire.serviceType")}</label>
          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={t("onboarding.questionnaire.serviceType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="website">{t("onboarding.questionnaire.services.website")}</SelectItem>
              <SelectItem value="marketing">{t("onboarding.questionnaire.services.marketing")}</SelectItem>
              <SelectItem value="analytics">{t("onboarding.questionnaire.services.analytics")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {serviceType === "website" && (
          <div className="space-y-3">
            {(["companyName", "colors", "references", "pages"] as const).map((key) => (
              <div key={key}>
                <label className="text-sm font-medium">{t(`onboarding.questionnaire.website.${key}`)}</label>
                <Input
                  className="mt-1"
                  value={fields[key] || ""}
                  onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {serviceType === "marketing" && (
          <div className="space-y-3">
            {(["budget", "competitors", "objectives"] as const).map((key) => (
              <div key={key}>
                <label className="text-sm font-medium">{t(`onboarding.questionnaire.marketing.${key}`)}</label>
                <Textarea
                  className="mt-1"
                  value={fields[key] || ""}
                  onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {serviceType === "analytics" && (
          <div className="space-y-3">
            {(["kpis", "tools", "dataSources"] as const).map((key) => (
              <div key={key}>
                <label className="text-sm font-medium">{t(`onboarding.questionnaire.analytics.${key}`)}</label>
                <Input
                  className="mt-1"
                  value={fields[key] || ""}
                  onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        {step.questionnaire.isDraft && (
          <Button variant="outline" onClick={() => handleSave(true)} disabled={updateQuestionnaire.isPending}>
            {t("onboarding.questionnaire.saveDraft")}
          </Button>
        )}
        <Button onClick={() => handleSave(false)} disabled={!serviceType || updateQuestionnaire.isPending}>
          {t("onboarding.questionnaire.submit")}
        </Button>
      </div>
    </div>
  );
}

export function ClientOnboardingPage() {
  const { t } = useTranslation();
  const { onboardingId } = useParams<{ onboardingId: string }>();
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [contractTarget, setContractTarget] = useState<{ contractId: string } | null>(null);

  const { data: onboarding, isLoading } = useClientOnboarding(
    onboardingId || ""
  );
  const updateStep = useUpdateOnboardingStep();
  const updateContract = useUpdateContract();
  const updateQuestionnaire = useUpdateQuestionnaire();

  useEffect(() => {
    if (onboarding && onboarding.steps.length > 0) {
      const firstIncomplete = onboarding.steps.find(
        (s) => s.status !== "COMPLETED"
      );
      setActiveStep(firstIncomplete?.stepType || null);
    }
  }, [onboarding]);

  const renderStepIcon = (type: string, status: string) => {
    const color =
      status === "COMPLETED" ? "text-green-500" :
      status === "IN_PROGRESS" ? "text-blue-500" :
      status === "REJECTED" ? "text-red-500" :
      "text-gray-300";

    switch (type) {
      case "welcome":
        return <CheckCircle2 className={`h-6 w-6 ${color}`} />;
      case "contract":
        return <FileText className={`h-6 w-6 ${color}`} />;
      case "payment":
        return <CreditCard className={`h-6 w-6 ${color}`} />;
      case "questionnaire":
        return <FileQuestion className={`h-6 w-6 ${color}`} />;
      case "specifications":
        return <Briefcase className={`h-6 w-6 ${color}`} />;
      case "kickoff":
        return <Calendar className={`h-6 w-6 ${color}`} />;
      case "production":
        return <LineChart className={`h-6 w-6 ${color}`} />;
      case "delivery":
        return <Download className={`h-6 w-6 ${color}`} />;
      default:
        return <Circle className="h-6 w-6 text-gray-300" />;
    }
  };

  // Maps the raw OnboardingStepStatus enum to the existing camelCase i18n keys
  // under onboarding.timeline.statuses (same convention as AdminOnboardingPage).
  const stepStatusI18nKey = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "onboarding.timeline.statuses.completed";
      case "REJECTED":
        return "onboarding.timeline.statuses.rejected";
      case "IN_PROGRESS":
        return "onboarding.timeline.statuses.inProgress";
      default:
        return "onboarding.timeline.statuses.pending";
    }
  };

  const getStepLabel = (type: string) => {
    switch (type) {
      case "welcome":
        return t("onboarding.timeline.stepConfirmed");
      case "contract":
        return t("onboarding.timeline.stepContract");
      case "payment":
        return t("onboarding.timeline.stepPayment");
      case "questionnaire":
        return t("onboarding.timeline.stepQuestionnaire");
      case "specifications":
        return t("onboarding.timeline.stepSpecifications");
      case "kickoff":
        return t("onboarding.timeline.stepKickoff");
      case "production":
        return t("onboarding.timeline.stepProduction");
      case "delivery":
        return t("onboarding.timeline.stepDelivery");
      default:
        return "";
    }
  };

  const renderStepContent = (step: OnboardingStep) => {
    switch (step.stepType) {
      case "welcome":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.welcome.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.welcome.subtitle")}</p>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("onboarding.welcome.projectSummary")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{onboarding?.project?.name ?? "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("onboarding.welcome.assignedTo")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg">{onboarding?.assignedUser?.name || "-"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("onboarding.welcome.responseTime")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg">24h</p>
                </CardContent>
              </Card>
            </div>

            {activeStep === "welcome" && step.status !== "COMPLETED" && (
              <Button
                className="mt-4"
                onClick={() => {
                  updateStep.mutate({
                    stepId: step.id,
                    data: { status: "COMPLETED" },
                  });
                }}
                disabled={updateStep.isPending}
              >
                {t("onboarding.welcome.startOnboarding")}
              </Button>
            )}
          </div>
        );

      case "contract": {
        const contract = step.contract;
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.contract.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.contract.subtitle")}</p>

            {contract ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.contract.status")}: </strong>
                  <Badge className={getOnboardingStatusBadgeClass(contract.status)}>
                    {t(`onboarding.contract.statuses.${contract.status}`, contract.status)}
                  </Badge>
                </p>
                {contract.contractUrl && (
                  <Link
                    to={contract.contractUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {t("onboarding.contract.viewContract")}
                  </Link>
                )}

                {contract.status !== "SIGNED" && (
                  <Button
                    onClick={() => setContractTarget({ contractId: contract.id })}
                    disabled={updateContract.isPending}
                  >
                    {t("onboarding.contract.signContract")}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">{t("onboarding.contract.notReady")}</p>
            )}
          </div>
        );
      }

      case "payment":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.payment.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.payment.subtitle")}</p>

            {step.payment ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.payment.amount")}: </strong>
                  {step.payment.amount ? formatCurrency(step.payment.amount, "TND") : "-"}
                </p>
                <p>
                  <strong>{t("onboarding.payment.amountPaid")}: </strong>
                  {step.payment.amountPaid ? formatCurrency(step.payment.amountPaid, "TND") : "-"}
                </p>
                <p>
                  <strong>{t("onboarding.payment.status")}: </strong>
                  <Badge className={getOnboardingStatusBadgeClass(step.payment.status)}>
                    {t(`onboarding.payment.statuses.${step.payment.status}`, step.payment.status)}
                  </Badge>
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">{t("onboarding.payment.notReady")}</p>
            )}
          </div>
        );

      case "questionnaire":
        return (
          <QuestionnaireStep
            step={step}
            updateQuestionnaire={updateQuestionnaire}
            t={t}
          />
        );

      case "specifications":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.specifications.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.specifications.subtitle")}</p>

            {step.specifications ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.specifications.requirements")}: </strong>
                  {step.specifications.requirements || "-"}
                </p>
                <p>
                  <strong>{t("onboarding.specifications.objectives")}: </strong>
                  {step.specifications.objectives || "-"}
                </p>
                <p>
                  <strong>{t("onboarding.specifications.status")}: </strong>
                  <Badge className={getOnboardingStatusBadgeClass(step.specifications.approvalStatus)}>
                    {t(`onboarding.specifications.statuses.${step.specifications.approvalStatus}`, step.specifications.approvalStatus)}
                  </Badge>
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">{t("onboarding.specifications.notReady")}</p>
            )}
          </div>
        );

      case "kickoff":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.kickoff.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.kickoff.subtitle")}</p>

            {step.kickoff ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.kickoff.meetingDate")}: </strong>
                  {step.kickoff.meetingDate ? formatDateTime(step.kickoff.meetingDate) : "-"}
                </p>
                {step.kickoff.meetingLink && (
                  <Button asChild>
                    <a
                      href={step.kickoff.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("onboarding.kickoff.joinMeeting")}
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">{t("onboarding.kickoff.notReady")}</p>
            )}
          </div>
        );

      case "production":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.production.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.production.subtitle")}</p>

            {step.production ? (
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("onboarding.production.analysis")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{step.production.analysis}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("onboarding.production.design")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{step.production.design}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("onboarding.production.development")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{step.production.development}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("onboarding.production.testing")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{step.production.testing}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("onboarding.production.deployment")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{step.production.deployment}%</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-muted-foreground">{t("onboarding.production.notReady")}</p>
            )}
          </div>
        );

      case "delivery":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.delivery.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.delivery.subtitle")}</p>

            {step.delivery ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.delivery.deliverables")}: </strong>
                  {step.delivery.deliverables || "-"}
                </p>
                {step.delivery.documentation && (
                  <Link
                    to={step.delivery.documentation}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {t("onboarding.delivery.documentation")}
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">{t("onboarding.delivery.notReady")}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <section className="container-page py-8">
        <p>{t("common.loading")}</p>
      </section>
    );
  }

  if (!onboarding) {
    return (
      <section className="container-page py-8">
        <p>{t("onboarding.notFound")}</p>
      </section>
    );
  }

  return (
    <section className="container-page py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Timeline sidebar */}
        <div className="md:w-1/3 space-y-4">
          <h2 className="text-xl font-bold">{t("onboarding.timeline.title")}</h2>
          <div className="relative">
            <div className="absolute left-3 top-3 h-[calc(100%-24px)] w-px bg-gray-200" />
            {onboarding.steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  activeStep === step.stepType
                    ? "bg-primary/10"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setActiveStep(step.stepType)}
              >
                <div className="relative z-10">
                  {renderStepIcon(step.stepType, step.status)}
                </div>
                <div>
                  <p className="font-medium">{getStepLabel(step.stepType)}</p>
                  <Badge className={`${getOnboardingStatusBadgeClass(step.status)} mt-0.5`}>
                    {t(stepStatusI18nKey(step.status))}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="md:w-2/3">
          <Card className="p-6">
            {onboarding.steps
              .filter((s) => s.stepType === activeStep)
              .map((step) => (
                <div key={step.id}>{renderStepContent(step)}</div>
              ))}
          </Card>
        </div>
      </div>

      <ConfirmationDialog
        open={!!contractTarget}
        onOpenChange={(open) => !open && setContractTarget(null)}
        onConfirm={() => {
          if (!contractTarget) return;
          updateContract.mutate(
            { contractId: contractTarget.contractId, data: { status: "SIGNED" } },
            { onSuccess: () => setContractTarget(null) }
          );
        }}
        isLoading={updateContract.isPending}
        title={t("onboarding.contract.confirmSignTitle", "Confirmer la signature du contrat ?")}
        description={t(
          "onboarding.contract.confirmSignDesc",
          "Cette signature valide l'accord de départ et engage contractuellement les prochaines étapes. Vérifiez le contrat avant de confirmer."
        )}
        checkboxLabel={t(
          "onboarding.contract.confirmSignCheckbox",
          "Je confirme avoir lu et accepté les termes du contrat, et je le signe en connaissance de cause."
        )}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
      />
    </section>
  );
}