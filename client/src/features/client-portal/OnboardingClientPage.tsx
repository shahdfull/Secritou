import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.store";
import { useClientOnboardingByClientId } from "@/hooks/useClientOnboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ClipboardList } from "lucide-react";

export function OnboardingClientPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clientId = user?.clientId ?? "";

  const { data: onboarding, isLoading, isError, refetch } = useClientOnboardingByClientId(clientId);

  useEffect(() => {
    if (onboarding) {
      navigate(`/client/onboarding/${onboarding.id}`, { replace: true });
    }
  }, [onboarding, navigate]);

  if (isLoading) {
    return (
      <section className="container-page py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="container-page py-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{t("errors.loadFailed")}</p>
            <Button variant="outline" onClick={() => refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!onboarding) {
    return (
      <section className="container-page py-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t("clientPortal.onboarding.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("clientPortal.onboarding.emptyBody")}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/client/projects">
                  {t("clientPortal.onboarding.viewProjects")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" onClick={() => navigate("/client/requests")}>
                {t("clientPortal.onboarding.viewRequests")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return null;
}
