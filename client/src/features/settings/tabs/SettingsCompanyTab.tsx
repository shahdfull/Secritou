import { memo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";

export type CompanyFormState = {
  name: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
};

export const SettingsCompanyTab = memo(function SettingsCompanyTab({
  value,
  onChange,
  onSave,
  isSaving,
}: {
  value: CompanyFormState;
  onChange(next: CompanyFormState): void;
  onSave(): void;
  isSaving: boolean;
}) {
  useEffect(() => {
    if (value.primaryColor) {
      document.documentElement.style.setProperty("--brand-primary", value.primaryColor);
    }
  }, [value.primaryColor]);

  const setField = useCallback(
    (key: keyof CompanyFormState, v: string) => {
      onChange({ ...value, [key]: v });
    },
    [onChange, value]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Settings</CardTitle>
        <CardDescription>Update your company information and branding</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="company-name">Company Name</Label>
            <Input id="company-name" value={value.name} onChange={(e) => setField("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              type="url"
              value={value.website}
              onChange={(e) => setField("website", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company-logo">Logo URL</Label>
            <Input
              id="company-logo"
              type="url"
              value={value.logoUrl}
              onChange={(e) => setField("logoUrl", e.target.value)}
            />
            {value.logoUrl && (
              <div className="mt-2">
                <img
                  src={value.logoUrl}
                  alt="Company Logo"
                  className="h-24 w-24 object-cover rounded-md border"
                  loading="lazy"
                />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="primary-color"
                type="color"
                value={value.primaryColor || "#000000"}
                onChange={(e) => setField("primaryColor", e.target.value)}
                className="h-10 w-20"
              />
              <span className="text-sm text-muted-foreground">{value.primaryColor}</span>
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
});

