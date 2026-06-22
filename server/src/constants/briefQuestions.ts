export type BriefQuestionType = "boolean" | "textarea" | "multiselect" | "number" | "text";

export interface BriefQuestion {
  key: string;
  label: string;
  type: BriefQuestionType;
  options?: string[];
  required?: boolean;
}

export const BRIEF_QUESTIONS: Record<"WEB" | "MARKETING" | "AI", BriefQuestion[]> = {
  WEB: [
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
  MARKETING: [
    {
      key: "existingSocials",
      label: "Réseaux sociaux existants",
      type: "multiselect",
      options: ["Instagram", "Facebook", "LinkedIn", "TikTok", "Twitter/X"],
    },
    { key: "targetAudience", label: "Décrivez votre cible", type: "textarea", required: true },
    { key: "competitors", label: "Vos 3 principaux concurrents", type: "textarea", required: true },
    { key: "monthlyBudget", label: "Budget mensuel (€)", type: "number" },
    { key: "currentChannels", label: "Canaux actuellement utilisés", type: "textarea" },
    { key: "primaryGoal", label: "Objectif principal (notoriété / conversion / fidélisation)", type: "textarea", required: true },
  ],
  AI: [
    { key: "processToAutomate", label: "Processus à automatiser", type: "textarea", required: true },
    { key: "currentTools", label: "Outils actuellement utilisés", type: "textarea", required: true },
    { key: "currentProblems", label: "Problèmes actuels", type: "textarea", required: true },
    { key: "expectedGains", label: "Gains attendus", type: "textarea", required: true },
    { key: "dataAvailable", label: "Données disponibles (format, volume)", type: "textarea" },
    { key: "integrationNeeds", label: "Intégrations requises (CRM, ERP, API…)", type: "textarea" },
  ],
};

export type ServiceType = keyof typeof BRIEF_QUESTIONS;

export function getBriefQuestions(serviceType: string | null | undefined): BriefQuestion[] {
  if (!serviceType) return BRIEF_QUESTIONS.WEB;
  const key = serviceType.toUpperCase() as ServiceType;
  return BRIEF_QUESTIONS[key] ?? BRIEF_QUESTIONS.WEB;
}
