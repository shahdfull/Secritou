import logger from "../utils/logger.js";

export type BriefQuestionType = "boolean" | "textarea" | "multiselect" | "number" | "text";

export interface BriefQuestion {
  key: string;
  label: string;
  type: BriefQuestionType;
  options?: string[];
  required?: boolean;
}

// Keyed by the real pole name (Service.name — see constants/serviceMapping.ts), not by
// Project.serviceType: that field is never populated anywhere in the codebase (it's written
// on Lead/ClientOnboarding records, never on Project), so keying off it here previously meant
// every single project silently fell back to the WEB questionnaire regardless of its actual pole.
// Keys are the 4 canonical FR pole names (REFERENTIEL.md §2 / prisma/seed.ts) — SEC-001:
// these used to be stale pre-migration English names ("Technology Solutions", "Digital
// Growth", "AI & Automation", "Business Performance"), which never matched any real
// Service.name after migration 20260711210000_fix_service_name_locale_drift renamed the
// Service rows to French. getBriefQuestions() silently fell back to the "Technologie"
// questionnaire for every project outside that one pole, with only a log warning.
export const BRIEF_QUESTIONS: Record<"Technologie" | "Croissance digitale" | "IA & Automatisation" | "Management & Performance", BriefQuestion[]> = {
  "Technologie": [
    { key: "hasLogo", label: "Avez-vous un logo ?", type: "boolean", required: true },
    { key: "hasGraphicChart", label: "Avez-vous une charte graphique ?", type: "boolean", required: true },
    {
      key: "desiredPages",
      label: "Pages souhaitées",
      type: "multiselect",
      options: ["Accueil", "À propos", "Services", "Blog", "Contact", "Boutique"],
      required: true,
    },
    { key: "references", label: "Sites de référence (URLs)", type: "textarea" },
    { key: "targetAudience", label: "Décrivez votre cible client", type: "textarea" },
    { key: "additionalInfo", label: "Informations complémentaires", type: "textarea" },
  ],
  "Croissance digitale": [
    {
      key: "existingSocials",
      label: "Réseaux sociaux existants",
      type: "multiselect",
      options: ["Instagram", "Facebook", "LinkedIn", "TikTok", "Twitter/X"],
    },
    { key: "targetAudience", label: "Décrivez votre cible", type: "textarea", required: true },
    { key: "competitors", label: "Vos 3 principaux concurrents", type: "textarea", required: true },
    { key: "monthlyBudget", label: "Budget mensuel (DT)", type: "number" },
    { key: "currentChannels", label: "Canaux actuellement utilisés", type: "textarea" },
    { key: "primaryGoal", label: "Objectif principal (notoriété / conversion / fidélisation)", type: "textarea", required: true },
  ],
  "IA & Automatisation": [
    { key: "processToAutomate", label: "Processus à automatiser", type: "textarea", required: true },
    { key: "currentTools", label: "Outils actuellement utilisés", type: "textarea", required: true },
    { key: "currentProblems", label: "Problèmes actuels", type: "textarea", required: true },
    { key: "expectedGains", label: "Gains attendus", type: "textarea", required: true },
    { key: "dataAvailable", label: "Données disponibles (format, volume)", type: "textarea" },
    { key: "integrationNeeds", label: "Intégrations requises (CRM, ERP, API…)", type: "textarea" },
  ],
  "Management & Performance": [
    { key: "auditScope", label: "Périmètre de l'audit (équipe, processus, département)", type: "textarea", required: true },
    { key: "currentKpis", label: "KPI actuellement suivis (le cas échéant)", type: "textarea" },
    { key: "currentTools", label: "Outils de reporting/pilotage actuels", type: "textarea" },
    { key: "mainPainPoints", label: "Principaux points de friction / problèmes constatés", type: "textarea", required: true },
    { key: "reportingFrequency", label: "Fréquence de reporting souhaitée", type: "multiselect", options: ["Hebdomadaire", "Mensuelle", "Trimestrielle"] },
    { key: "targetObjectives", label: "Objectifs / OKR visés à l'issue de la mission", type: "textarea", required: true },
  ],
};

export type ServiceType = keyof typeof BRIEF_QUESTIONS;

// Resolves the brief questionnaire from the project's real pole name (Service.name),
// not from the unused Project.serviceType column. Falls back to Technologie's
// (web-oriented) questionnaire only when the project has no service assigned at all, or
// when a pole name doesn't match any known key — logged loudly so a future 5th pole (or a
// renamed Service row) doesn't silently regress into this same bug again.
export function getBriefQuestions(serviceName: string | null | undefined): BriefQuestion[] {
  if (!serviceName) return BRIEF_QUESTIONS["Technologie"];
  const questions = BRIEF_QUESTIONS[serviceName as ServiceType];
  if (!questions) {
    logger.warn({ serviceName }, "[getBriefQuestions] Unmapped pole — falling back to Technologie questionnaire. Add this pole to BRIEF_QUESTIONS in briefQuestions.ts.");
    return BRIEF_QUESTIONS["Technologie"];
  }
  return questions;
}
