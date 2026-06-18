import { memo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

export const SettingsAppearanceTab = memo(function SettingsAppearanceTab({
  theme,
  setTheme,
  lang,
  onLangChange,
  primaryColor,
  onPrimaryColorChange,
  onSavePrimaryColor,
  isSavingPrimaryColor,
}: {
  theme: "light" | "dark";
  setTheme(next: "light" | "dark"): void;
  lang: string;
  onLangChange(next: string): void;
  primaryColor: string;
  onPrimaryColorChange(next: string): void;
  onSavePrimaryColor(color: string): void;
  isSavingPrimaryColor: boolean;
}) {
  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty("--brand-primary", primaryColor);
    }
  }, [primaryColor]);

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

        <div>
          <Label htmlFor="platform-color" className="text-base font-medium">
            Platform color
          </Label>
          <p className="text-sm text-muted-foreground mb-2">Customize the platform's primary brand color</p>
          <div className="flex gap-2 items-center">
            <Input
              id="platform-color"
              type="color"
              value={primaryColor || "#000000"}
              onChange={(e) => onPrimaryColorChange(e.target.value)}
              className="h-10 w-20"
            />
            <span className="text-sm text-muted-foreground">{primaryColor}</span>
            <Button
              type="button"
              onClick={() => onSavePrimaryColor(primaryColor)}
              disabled={isSavingPrimaryColor}
            >
              {isSavingPrimaryColor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
