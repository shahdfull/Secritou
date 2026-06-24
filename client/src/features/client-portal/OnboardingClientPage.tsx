import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.store";
import { useClientOnboardingByClientId } from "@/hooks/useClientOnboarding";

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
      <section className="container-page py-8">
        <p>{t("onboarding.notFound")}</p>
      </section>
    );
  }

  return null;
}
