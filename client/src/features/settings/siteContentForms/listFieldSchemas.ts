import type { IconName } from "@/features/landing/cms/iconRegistry";

/**
 * Describes the shape of each known JSON-type SiteContent list, so the admin
 * UI can render a plain form (labeled text fields, an icon picker) instead
 * of a raw JSON textarea. A non-technical admin never sees `{`, `}`, or a
 * field's storage key — only what each field on the card actually is.
 *
 * Keyed by SiteContent.key. If a JSON key isn't listed here, the UI falls
 * back to a generic "one line per field" editor rather than failing.
 *
 * Each item is stored as `{ fr: {...}, en: {...}, _enEdited }` (see
 * translation.service.ts / SettingsSiteContentTab.tsx). A field is either:
 * - bilingual (default): edited separately per language, shown fr/en
 *   side by side with a "translate" action to fill en from fr.
 * - shared (`shared: true`): has no language-specific meaning (an icon
 *   name, a URL, a percentage figure) — edited once, written into both
 *   `fr` and `en` at the same time so they never drift apart.
 */

export type SubFieldSpec =
  | { kind: "text"; key: string; label: string; multiline?: boolean; shared?: boolean }
  | { kind: "icon"; key: string; label: string }
  | { kind: "string-list"; key: string; label: string; itemLabel: string };

export type ListFieldSchema = {
  itemLabel: string; // e.g. "Problème", "Question" — display name for the item
  addLabel: string; // full "Add" button text, e.g. "Ajouter un problème" — avoids guessing gender/article from itemLabel
  fields: SubFieldSpec[];
  emptyItem: Record<string, unknown>;
};

export const LIST_FIELD_SCHEMAS: Record<string, ListFieldSchema> = {
  "problems.items": {
    itemLabel: "Problème",
    addLabel: "Ajouter un problème",
    fields: [
      { kind: "icon", key: "icon", label: "Icône" },
      { kind: "text", key: "title", label: "Titre" },
      { kind: "text", key: "body", label: "Texte", multiline: true },
    ],
    emptyItem: { icon: "sparkles", title: "", body: "" },
  },
  "howItWorks.steps": {
    itemLabel: "Étape",
    addLabel: "Ajouter une étape",
    fields: [
      { kind: "text", key: "title", label: "Titre" },
      { kind: "text", key: "body", label: "Texte", multiline: true },
    ],
    emptyItem: { title: "", body: "" },
  },
  "differentiators.items": {
    itemLabel: "Argument",
    addLabel: "Ajouter un argument",
    fields: [
      { kind: "icon", key: "icon", label: "Icône" },
      { kind: "text", key: "title", label: "Titre" },
      { kind: "text", key: "body", label: "Texte", multiline: true },
    ],
    emptyItem: { icon: "sparkles", title: "", body: "" },
  },
  "businessImpact.items": {
    itemLabel: "Résultat",
    addLabel: "Ajouter un résultat",
    fields: [
      { kind: "icon", key: "icon", label: "Icône" },
      { kind: "text", key: "title", label: "Titre" },
      { kind: "text", key: "description", label: "Description", multiline: true },
      { kind: "text", key: "metric", label: "Chiffre clé (ex : +42%)", shared: true },
      { kind: "text", key: "label", label: "Légende du chiffre" },
    ],
    emptyItem: { icon: "sparkles", title: "", description: "", metric: "", label: "" },
  },
  "faq.items": {
    itemLabel: "Question",
    addLabel: "Ajouter une question",
    fields: [
      { kind: "text", key: "question", label: "Question" },
      { kind: "text", key: "answer", label: "Réponse", multiline: true },
    ],
    emptyItem: { question: "", answer: "" },
  },
  "solutions.items": {
    itemLabel: "Segment",
    addLabel: "Ajouter un segment",
    fields: [
      { kind: "icon", key: "icon", label: "Icône" },
      { kind: "text", key: "tag", label: "Nom du segment (ex : Pour les PME)" },
      { kind: "text", key: "title", label: "Titre" },
      { kind: "string-list", key: "needs", label: "Besoins", itemLabel: "Besoin" },
      { kind: "text", key: "linkHref", label: "Lien du bouton \"Explorer\"", shared: true },
    ],
    emptyItem: { icon: "sparkles", tag: "", title: "", needs: [], linkHref: "/contact" },
  },
  "caseStudies.items": {
    itemLabel: "Étude de cas",
    addLabel: "Ajouter une étude de cas",
    fields: [
      { kind: "text", key: "company", label: "Nom de l'entreprise", shared: true },
      { kind: "text", key: "industry", label: "Secteur" },
      { kind: "text", key: "challenge", label: "Défi", multiline: true },
      { kind: "text", key: "outcome", label: "Résultat", multiline: true },
      { kind: "text", key: "metric", label: "Chiffre clé (ex : +34%)", shared: true },
      { kind: "text", key: "metricLabel", label: "Légende du chiffre" },
    ],
    emptyItem: { company: "", industry: "", challenge: "", outcome: "", metric: "", metricLabel: "" },
  },
  "socialProof.testimonials": {
    itemLabel: "Témoignage",
    addLabel: "Ajouter un témoignage",
    fields: [
      { kind: "text", key: "quote", label: "Citation", multiline: true },
      { kind: "text", key: "author", label: "Nom de la personne", shared: true },
      { kind: "text", key: "role", label: "Fonction" },
    ],
    emptyItem: { quote: "", author: "", role: "" },
  },
};

export const ICON_OPTIONS: { value: IconName; label: string }[] = [
  { value: "bar-chart", label: "Graphique" },
  { value: "rocket", label: "Fusée" },
  { value: "monitor", label: "Écran" },
  { value: "sparkles", label: "Étincelles" },
  { value: "building", label: "Entreprise" },
  { value: "compass", label: "Boussole" },
  { value: "store", label: "Boutique" },
  { value: "eye-off", label: "Visibilité" },
  { value: "workflow", label: "Processus" },
  { value: "globe", label: "Digital" },
  { value: "hourglass", label: "Temps" },
  { value: "line-chart", label: "Courbe" },
  { value: "users", label: "Équipe" },
  { value: "trending-up", label: "Croissance" },
  { value: "zap", label: "Rapidité" },
  { value: "target", label: "Objectif" },
];

// SELECT-type fields (fixed choice, not free text). Keyed by SiteContent.key.
export type SelectOption = { value: string; label: string };

export const SELECT_FIELD_OPTIONS: Record<string, SelectOption[]> = {
  "finalCta.background": [
    { value: "ink", label: "Sombre" },
    { value: "primary", label: "Bleu de marque" },
    { value: "surface-warm", label: "Beige clair" },
    { value: "none", label: "Blanc uni" },
  ],
};

export function iconLabel(value: string): string {
  return ICON_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
