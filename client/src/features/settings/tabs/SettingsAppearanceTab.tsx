import { memo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export const SettingsAppearanceTab = memo(function SettingsAppearanceTab({
  theme,
  setTheme,
  lang,
  onLangChange,
  onSavePrimaryColor,
}: {
  theme: "light" | "dark";
  setTheme(next: "light" | "dark"): void;
  lang: string;
  onLangChange(next: string): void;
  onSavePrimaryColor(color: string): void;
}) {
  const { t } = useTranslation();
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem("companyColor") || "#000000");

  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty("--brand-primary", primaryColor);
    }
  }, [primaryColor]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.appearance.title")}</CardTitle>
        <CardDescription>{t("settings.appearance.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="theme" className="text-base font-medium">
              {t("settings.appearance.darkMode")}
            </Label>
            <p className="text-sm text-muted-foreground">{t("settings.appearance.darkModeDesc")}</p>
          </div>
          <Switch id="theme" checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
        </div>

        <div>
          <Label htmlFor="language" className="text-base font-medium">
            {t("settings.appearance.language")}
          </Label>
          <p className="text-sm text-muted-foreground mb-2">{t("settings.appearance.languageDesc")}</p>
          <Select value={lang} onValueChange={onLangChange}>
            <SelectTrigger id="language" className="w-[200px]">
              <SelectValue placeholder={t("settings.appearance.languagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">{t("settings.appearance.languages.fr")}</SelectItem>
              <SelectItem value="en">{t("settings.appearance.languages.en")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="platform-color" className="text-base font-medium">
            {t("settings.appearance.platformColor")}
          </Label>
          <p className="text-sm text-muted-foreground mb-2">{t("settings.appearance.platformColorDesc")}</p>
          <div className="flex gap-2 items-center">
            <Input
              id="platform-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-20"
            />
            <span className="text-sm text-muted-foreground">{primaryColor}</span>
            <Button type="button" onClick={() => onSavePrimaryColor(primaryColor)}>
              <Save className="h-4 w-4 mr-2" />
              {t("common.save")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
