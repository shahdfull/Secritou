import { useState, useEffect, useCallback } from "react";
import { siteContentApi, type SiteContentItem } from "@/api/siteContent.api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Globe } from "lucide-react";
import { toast } from "sonner";
import { ListFieldEditor } from "../siteContentForms/ListFieldEditor";
import { BilingualTextField } from "../siteContentForms/BilingualTextField";
import { LIST_FIELD_SCHEMAS, SELECT_FIELD_OPTIONS } from "../siteContentForms/listFieldSchemas";

// Section keys are technical (Prisma enum values) — never shown to the admin.
// Everything they see is this French, non-technical label instead.
const SECTION_LABELS: Record<string, string> = {
  HERO: "Bannière d'accueil",
  SERVICES: "Services et offres",
  ABOUT: "À propos",
  CONTACT: "Page contact",
  SEO: "Référencement (SEO)",
  TESTIMONIALS: "Témoignages",
  PROBLEMS: "Problèmes résolus",
  HOW_IT_WORKS: "Comment ça marche",
  DIFFERENTIATORS: "Ce qui nous différencie",
  BUSINESS_IMPACT: "Résultats et impact",
  FAQ: "Questions fréquentes",
  SOLUTIONS: "Solutions par profil",
  CASE_STUDIES: "Études de cas",
  FINAL_CTA: "Bandeau d'appel à l'action",
  SOCIAL_PROOF: "Avis clients",
};

const SECTION_ORDER = [
  "HERO",
  "PROBLEMS",
  "SERVICES",
  "SOLUTIONS",
  "HOW_IT_WORKS",
  "DIFFERENTIATORS",
  "BUSINESS_IMPACT",
  "CASE_STUDIES",
  "FAQ",
  "SOCIAL_PROOF",
  "FINAL_CTA",
  "CONTACT",
  "ABOUT",
  "SEO",
  "TESTIMONIALS",
];

// A JSON-type SiteContent row stores [{ fr: {...}, en: {...}, _enEdited }, ...]
// (see server/src/services/siteContent.service.ts) — this is that shape plus
// a stable `_id` for list editing, so the admin never edits raw JSON text.
type BilingualListItem = { _id: string; fr: Record<string, unknown>; en: Record<string, unknown>; _enEdited: boolean };

// A plain TEXT/RICHTEXT field's edit state: the fr/en values (one row each
// in the database) shown together, plus a session-only "has this admin
// touched English by hand" flag — not persisted (there's no _enEdited slot
// on a plain row), just enough to stop this session's translate-all from
// clobbering a correction made a moment ago in the same sitting.
type SimpleFieldEdit = { fr: string; en: string; enEdited: boolean };

type EditValue = SimpleFieldEdit | BilingualListItem[];
type EditMap = Record<string, EditValue>;

// One merged row per key: the admin never picks "which language am I
// editing" — every field (simple or list) always shows fr+en together.
type MergedItem = {
  key: string;
  section: string;
  label: string;
  type: SiteContentItem["type"];
  frRow?: SiteContentItem;
  enRow?: SiteContentItem;
};

function parseListValue(raw: string): BilingualListItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, i) => ({
      _id: `existing-${i}-${Math.random().toString(36).slice(2, 6)}`,
      fr: item.fr ?? {},
      en: item.en ?? {},
      _enEdited: Boolean(item._enEdited),
    }));
  } catch {
    return [];
  }
}

function stripIds(items: BilingualListItem[]): Record<string, unknown>[] {
  return items.map(({ _id: _drop, ...rest }) => rest);
}

export function SettingsSiteContentTab() {
  const [merged, setMerged] = useState<MergedItem[]>([]);
  const [edits, setEdits] = useState<EditMap>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [frGrouped, enGrouped] = await Promise.all([
        siteContentApi.getGrouped("fr"),
        siteContentApi.getGrouped("en"),
      ]);

      const bySection = new Map<string, MergedItem[]>();
      const initial: EditMap = {};

      // JSON-type rows are stored once (locale "all") and appear identically
      // in both getGrouped("fr") and getGrouped("en") responses — dedupe by key.
      const seenKeys = new Set<string>();

      for (const [section, frItems] of Object.entries(frGrouped)) {
        const enItems = enGrouped[section] ?? [];
        const enByKey = new Map(enItems.map((r) => [r.key, r]));

        for (const frRow of frItems) {
          if (seenKeys.has(frRow.key)) continue;
          seenKeys.add(frRow.key);
          const enRow = enByKey.get(frRow.key);

          bySection.set(section, [
            ...(bySection.get(section) ?? []),
            { key: frRow.key, section, label: frRow.label, type: frRow.type, frRow, enRow },
          ]);

          if (frRow.type === "JSON") {
            initial[frRow.key] = parseListValue(frRow.value);
          } else if (frRow.type !== "SELECT") {
            initial[frRow.key] = { fr: frRow.value, en: enRow?.value ?? "", enEdited: Boolean(enRow?.value) };
          }
        }
      }

      setMerged(Array.from(bySection.entries()).flatMap(([, items]) => items));
      setEdits(initial);
    } catch {
      toast.error("Le contenu n'a pas pu être chargé");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleChange(key: string, value: EditValue) {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveSection(section: string) {
    const items = merged.filter((m) => m.section === section);
    setSavingSection(section);
    try {
      await Promise.all(
        items.flatMap((item) => {
          const edited = edits[item.key];

          if (item.type === "SELECT") {
            const value = typeof edited === "object" && "fr" in edited ? edited.fr : (item.frRow?.value ?? "");
            return [siteContentApi.upsertOne(item.key, "fr", value)];
          }

          if (Array.isArray(edited)) {
            const serialized = JSON.stringify(stripIds(edited));
            return [siteContentApi.upsertOne(item.key, "fr", serialized)];
          }

          if (edited && "fr" in edited) {
            return [
              siteContentApi.upsertOne(item.key, "fr", edited.fr),
              siteContentApi.upsertOne(item.key, "en", edited.en),
            ];
          }

          return [];
        })
      );
      toast.success(`${SECTION_LABELS[section] ?? section} enregistré`);
    } catch {
      toast.error("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.");
    } finally {
      setSavingSection(null);
    }
  }

  const sectionsPresent = Array.from(new Set(merged.map((m) => m.section)));
  const orderedSections = [
    ...SECTION_ORDER.filter((s) => sectionsPresent.includes(s)),
    ...sectionsPresent.filter((s) => !SECTION_ORDER.includes(s)),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="h-4 w-4" />
        Les changements apparaissent immédiatement sur le site. Le français et l'anglais s'éditent ensemble.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : orderedSections.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          Aucun contenu trouvé.
        </div>
      ) : (
        orderedSections.map((section) => {
          const items = merged.filter((m) => m.section === section);
          const isSaving = savingSection === section;
          return (
            <Card key={section}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{SECTION_LABELS[section] ?? section}</CardTitle>
                <CardDescription className="text-xs">Français et anglais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {items.map((item) => {
                  const schema = LIST_FIELD_SCHEMAS[item.key];
                  const selectOptions = SELECT_FIELD_OPTIONS[item.key];

                  if (item.type === "JSON" && schema) {
                    const value = edits[item.key];
                    const listValue = Array.isArray(value) ? value : [];
                    return (
                      <ListFieldEditor
                        key={item.key}
                        label={item.label}
                        schema={schema}
                        items={listValue}
                        onChange={(next) => handleChange(item.key, next)}
                      />
                    );
                  }

                  if (item.type === "SELECT" && selectOptions) {
                    const edited = edits[item.key];
                    const value = edited && "fr" in edited ? edited.fr : (item.frRow?.value ?? "");
                    return (
                      <div key={item.key} className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {item.label}
                        </Label>
                        <Select
                          value={value}
                          onValueChange={(v) => handleChange(item.key, { fr: v, en: v, enEdited: true })}
                        >
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {selectOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }

                  // Plain TEXT/RICHTEXT field — fr/en shown together, same as list items.
                  const edited = edits[item.key];
                  const simple: SimpleFieldEdit = edited && "fr" in edited && !Array.isArray(edited)
                    ? edited
                    : { fr: item.frRow?.value ?? "", en: item.enRow?.value ?? "", enEdited: Boolean(item.enRow?.value) };

                  return (
                    <BilingualTextField
                      key={item.key}
                      label={item.label}
                      multiline={item.type === "RICHTEXT"}
                      frValue={simple.fr}
                      enValue={simple.en}
                      enEdited={simple.enEdited}
                      onFrChange={(v) => handleChange(item.key, { ...simple, fr: v })}
                      onEnChange={(v, markEdited) =>
                        handleChange(item.key, { ...simple, en: v, enEdited: markEdited || simple.enEdited })
                      }
                    />
                  );
                })}

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
                    Enregistrer
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
