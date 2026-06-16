import { PagePlaceholder } from "@/components/common/PagePlaceholder";
import { useTranslation } from "react-i18next";

export function SettingsPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t("settingsPage.title")} description={t("settingsPage.description")} />;
}
