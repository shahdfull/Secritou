import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const SettingsAppearanceTab = memo(function SettingsAppearanceTab({
  theme,
  setTheme,
  lang,
  onLangChange,
}: {
  theme: "light" | "dark";
  setTheme(next: "light" | "dark"): void;
  lang: string;
  onLangChange(next: string): void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize your app's look and feel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="theme" className="text-base font-medium">
              Dark Mode
            </Label>
            <p className="text-sm text-muted-foreground">Switch between light and dark theme</p>
          </div>
          <Switch id="theme" checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
        </div>

        <div>
          <Label htmlFor="language" className="text-base font-medium">
            Language
          </Label>
          <p className="text-sm text-muted-foreground mb-2">Select your preferred language</p>
          <Select value={lang} onValueChange={onLangChange}>
            <SelectTrigger id="language" className="w-[200px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
});
