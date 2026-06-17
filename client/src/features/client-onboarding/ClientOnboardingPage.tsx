import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import {
  useClientOnboardingByProjectId,
  useUpdateOnboardingStep,
  useUpdateContract,
  useUpdatePayment,
  useUpdateQuestionnaire,
  useUpdateSpecifications,
  useUpdateKickoff,
  useUpdateProduction,
  useUpdateDelivery,
} from "@/hooks/useClientOnboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  FileText,
  CreditCard,
  FileQuestion,
  Briefcase,
  Calendar,
  LineChart,
  Download,
} from "lucide-react";

export function ClientOnboardingPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const { data: onboarding, isLoading } = useClientOnboardingByProjectId(
    projectId || ""
  );
  const updateStep = useUpdateOnboardingStep();
  const updateContract = useUpdateContract();
  const updatePayment = useUpdatePayment();
  const updateQuestionnaire = useUpdateQuestionnaire();
  const updateSpecifications = useUpdateSpecifications();
  const updateKickoff = useUpdateKickoff();
  const updateProduction = useUpdateProduction();
  const updateDelivery = useUpdateDelivery();

  useEffect(() => {
    if (onboarding && onboarding.steps.length > 0) {
      const firstIncomplete = onboarding.steps.find(
        (s) => s.status !== "COMPLETED"
      );
      setActiveStep(firstIncomplete?.stepType || null);
    }
  }, [onboarding]);

  const renderStepIcon = (type: string, status: string) => {
    const isCompleted = status === "COMPLETED";

    switch (type) {
      case "welcome":
        return <CheckCircle2 className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      case "contract":
        return <FileText className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      case "payment":
        return <CreditCard className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      case "questionnaire":
        return <FileQuestion className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      case "specifications":
        return <Briefcase className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      case "kickoff":
        return <Calendar className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      case "production":
        return <LineChart className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      case "delivery":
        return <Download className={`h-6 w-6 ${isCompleted ? "text-green-500" : "text-gray-300"}`} />;
      default:
        return <Circle className="h-6 w-6 text-gray-300" />;
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

  const renderStepContent = (step: any) => {
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
                  <p className="text-2xl font-bold">{onboarding?.project.name}</p>
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

      case "contract":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.contract.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.contract.subtitle")}</p>

            {step.contract ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.contract.status")}: </strong>
                  {step.contract.status}
                </p>
                {step.contract.contractUrl && (
                  <Link
                    to={step.contract.contractUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {t("onboarding.contract.viewContract")}
                  </Link>
                )}

                {step.contract.status !== "SIGNED" && (
                  <Button
                    onClick={() => {
                      updateContract.mutate({
                        contractId: step.contract.id,
                        data: { status: "SIGNED" },
                      });
                    }}
                    disabled={updateContract.isPending}
                  >
                    {t("onboarding.contract.signContract")}
                  </Button>
                )}
              </div>
            ) : (
              <p>{t("onboarding.admin.createOnboarding")}</p>
            )}
          </div>
        );

      case "payment":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.payment.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.payment.subtitle")}</p>

            {step.payment ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.payment.amount")}: </strong>
                  {step.payment.amount ? `$${step.payment.amount}` : "-"}
                </p>
                <p>
                  <strong>{t("onboarding.payment.amountPaid")}: </strong>
                  {step.payment.amountPaid ? `$${step.payment.amountPaid}` : "-"}
                </p>
                <p>
                  <strong>{t("onboarding.payment.status")}: </strong>
                  {step.payment.status}
                </p>
              </div>
            ) : (
              <p>{t("onboarding.admin.createOnboarding")}</p>
            )}
          </div>
        );

      case "questionnaire":
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{t("onboarding.questionnaire.title")}</h3>
            <p className="text-muted-foreground">{t("onboarding.questionnaire.subtitle")}</p>

            {step.questionnaire ? (
              <div className="space-y-2">
                <p>
                  <strong>{t("onboarding.questionnaire.serviceType")}: </strong>
                  {step.questionnaire.serviceType || "-"}
                </p>
                {step.questionnaire.isDraft && (
                  <Button>{t("onboarding.questionnaire.saveDraft")}</Button>
                )}
              </div>
            ) : (
              <p>{t("onboarding.admin.createOnboarding")}</p>
            )}
          </div>
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
                  {step.specifications.approvalStatus}
                </p>
              </div>
            ) : (
              <p>{t("onboarding.admin.createOnboarding")}</p>
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
                  {step.kickoff.meetingDate ? new Date(step.kickoff.meetingDate).toLocaleString() : "-"}
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
              <p>{t("onboarding.admin.createOnboarding")}</p>
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
              <p>{t("onboarding.admin.createOnboarding")}</p>
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
              <p>{t("onboarding.admin.createOnboarding")}</p>
            )}
          </div>
        );

      default:
        return <p>Coming soon</p>;
    }
  };

  if (isLoading) {
    return (
      <section className="container-page py-8">
        <p>Loading...</p>
      </section>
    );
  }

  if (!onboarding) {
    return (
      <section className="container-page py-8">
        <p>No onboarding found</p>
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
            {onboarding.steps.map((step, index) => (
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
                  <p className="text-xs text-muted-foreground">
                    {step.status}
                  </p>
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
    </section>
  );
}
