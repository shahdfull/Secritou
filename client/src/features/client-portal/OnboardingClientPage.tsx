import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.store";
import { useClientOnboardingByClientId } from "@/hooks/useClientOnboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardList } from "lucide-react";

export function OnboardingClientPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clientId = user?.clientId ?? "";

  const { data: onboarding, isLoading } = useClientOnboardingByClientId(clientId);

  useEffect(() => {
    if (onboarding) {
      navigate(`/app/client-onboarding/${onboarding.id}`, { replace: true });
    }
  }, [onboarding, navigate]);

  if (isLoading) {
    return (
      <section className="container-page py-8">
        <p>{t("common.loading")}</p>
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
              <p className="text-lg font-semibold">Aucun onboarding trouvé</p>
              <p className="text-sm text-muted-foreground">
                L'onboarding apparaît lorsque votre projet est prêt à suivre les étapes de cadrage, de contrat et de production.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/client/projects">
                  Voir mes projets
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" onClick={() => navigate("/client/requests")}>
                Voir mes demandes
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return null;
}
