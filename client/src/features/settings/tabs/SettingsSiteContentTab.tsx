import { useState, useEffect, useCallback } from "react";
import { siteContentApi, type CmsLocale, type SiteContentItem } from "@/api/siteContent.api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Globe } from "lucide-react";
import { toast } from "sonner";

const SECTION_LABELS: Record<string, string> = {
  HERO: "Hero — Landing page header",
  SERVICES: "Services section",
  ABOUT: "About section",
  CONTACT: "Contact page",
  SEO: "SEO metadata",
  TESTIMONIALS: "Testimonials",
};

const SECTION_ORDER = ["HERO", "SERVICES", "CONTACT", "ABOUT", "SEO", "TESTIMONIALS"];

type GroupedData = Record<string, SiteContentItem[]>;
type EditMap = Record<string, string>; // key → current input value

export function SettingsSiteContentTab() {
  const [locale, setLocale] = useState<CmsLocale>("fr");
  const [grouped, setGrouped] = useState<GroupedData>({});
  const [edits, setEdits] = useState<EditMap>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const loadData = useCallback(async (loc: CmsLocale) => {
    setLoading(true);
    try {
      const data = await siteContentApi.getGrouped(loc);
      setGrouped(data);
      const initial: EditMap = {};
      for (const items of Object.values(data)) {
        for (const item of items) initial[item.key] = item.value;
      }
      setEdits(initial);
    } catch {
      toast.error("Failed to load site content");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(locale);
  }, [locale, loadData]);

  function handleChange(key: string, value: string) {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveSection(section: string) {
    const items = grouped[section] ?? [];
    setSavingSection(section);
    try {
      await Promise.all(
        items.map((item) =>
          siteContentApi.upsertOne(item.key, locale, edits[item.key] ?? item.value)
        )
      );
      toast.success(`${SECTION_LABELS[section] ?? section} (${locale.toUpperCase()}) saved`);
    } catch {
      toast.error("Failed to save. Check your connection and try again.");
    } finally {
      setSavingSection(null);
    }
  }

  const orderedSections = [
    ...SECTION_ORDER.filter((s) => grouped[s]),
    ...Object.keys(grouped).filter((s) => !SECTION_ORDER.includes(s)),
  ];

  return (
    <div className="space-y-6">
      {/* Header + locale toggle */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          Changes appear instantly on the public landing page.
        </div>
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm font-medium">
          <button
            onClick={() => setLocale("fr")}
            className={`px-4 py-1.5 transition-colors ${
              locale === "fr"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            FR
          </button>
          <button
            onClick={() => setLocale("en")}
            className={`px-4 py-1.5 transition-colors ${
              locale === "en"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : orderedSections.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No content found. Run the seed script to populate defaults.
        </div>
      ) : (
        orderedSections.map((section) => {
          const items: SiteContentItem[] = grouped[section] ?? [];
          const isSaving = savingSection === section;
          return (
            <Card key={section}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{SECTION_LABELS[section] ?? section}</CardTitle>
                <CardDescription className="text-xs">
                  {items.length} field{items.length !== 1 ? "s" : ""} · {locale.toUpperCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {items.map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {item.label}
                    </Label>
                    {item.type === "RICHTEXT" ? (
                      <Textarea
                        rows={4}
                        value={edits[item.key] ?? item.value}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        className="text-sm resize-y"
                      />
                    ) : (
                      <Input
                        value={edits[item.key] ?? item.value}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        className="text-sm"
                      />
                    )}
                    <p className="text-[10px] text-muted-foreground/50 font-mono">{item.key}</p>
                  </div>
                ))}

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleSaveSection(section)}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Save className="h-3.5 w-3.5" />
                    }
                    Save {locale.toUpperCase()}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
