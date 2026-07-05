export type SeoConfig = {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string;
  noindex?: boolean;
};

const siteUrl = (import.meta.env.VITE_SITE_URL ?? "https://secritou.tn").replace(/\/$/, "");
const defaultImage = `${siteUrl}/secritou-og.png`;

export const defaultSeo: SeoConfig = {
  title: "Secritou - Agence digitale en Tunisie | Croissance & Transformation",
  description:
    "Secritou, agence digitale en Tunisie : nous aidons les PME, startups et créateurs à s'organiser, se digitaliser et croître grâce à la stratégie, la technologie, le marketing et la data.",
  path: "/",
  image: defaultImage,
  keywords:
    "agence digitale Tunisie, digitalisation PME Tunisie, transformation digitale Tunisie, agence marketing Tunisie, croissance entreprise Tunisie",
};

export const seoByPath: Record<string, SeoConfig> = {
  "/": defaultSeo,
  "/services": {
    title: "Services - Création site web & community management en Tunisie | Secritou",
    description:
      "Découvrez les services Secritou en Tunisie : création de site web, community management, solutions technologiques, IA et automatisation pour votre entreprise.",
    path: "/services",
    image: defaultImage,
    keywords:
      "community management Tunisie, création site web Tunisie, développement web Tunisie, agence SEO Tunisie, automatisation IA Tunisie",
  },
  "/solutions": {
    title: "Solutions PME, Startups & Créateurs en Tunisie | Secritou",
    description:
      "Solutions de croissance et de transformation digitale adaptées aux PME, entrepreneurs et créateurs de contenu en Tunisie.",
    path: "/solutions",
    image: defaultImage,
    keywords:
      "solutions digitales PME Tunisie, transformation digitale startup Tunisie, agence digitale créateurs Tunisie",
  },
  "/case-studies": {
    title: "Études de cas — Résultats clients | Secritou Tunisie",
    description:
      "Découvrez comment Secritou aide les entreprises tunisiennes à améliorer leurs performances, lancer des systèmes digitaux et atteindre une croissance mesurable.",
    path: "/case-studies",
    image: defaultImage,
    keywords:
      "études de cas agence digitale Tunisie, résultats transformation digitale, success stories PME Tunisie",
  },
  "/contact": {
    title: "Contact - Agence digitale à Tunis | Secritou",
    description:
      "Contactez Secritou, agence digitale à Tunis. Réservez une consultation gratuite pour discuter stratégie, technologie, marketing, IA et croissance de votre entreprise.",
    path: "/contact",
    image: defaultImage,
    keywords:
      "agence digitale Tunis, contact Secritou, consultation digitale Tunisie, rendez-vous agence Tunis",
  },
  "/mentions-legales": {
    title: "Mentions légales | Secritou",
    description: "Mentions légales du site Secritou, agence digitale en Tunisie.",
    path: "/mentions-legales",
    image: defaultImage,
    noindex: true,
  },
  "/confidentialite": {
    title: "Politique de confidentialité | Secritou",
    description: "Politique de confidentialité et gestion des données personnelles — Secritou, agence digitale Tunisie.",
    path: "/confidentialite",
    image: defaultImage,
    noindex: true,
  },
  "/login": {
    title: "Sign in - Secritou",
    description: "Sign in to your Secritou workspace.",
    path: "/login",
    image: defaultImage,
    noindex: true,
  },
  "/rejoindre": {
    title: "Join Secritou as Freelancer or Manager - Secritou",
    description:
      "Apply to join Secritou as a freelancer or manager. Submit your profile, CV, and portfolio to our team.",
    path: "/rejoindre",
    image: defaultImage,
  },
  "/forgot-password": {
    title: "Forgot Password - Secritou",
    description: "Reset your Secritou workspace password.",
    path: "/forgot-password",
    image: defaultImage,
    noindex: true,
  },
  "/reset-password": {
    title: "Reset Password - Secritou",
    description: "Create a new password for your Secritou account.",
    path: "/reset-password",
    image: defaultImage,
    noindex: true,
  },
  "/change-password": {
    title: "Change Password - Secritou",
    description: "Update your Secritou account password.",
    path: "/change-password",
    image: defaultImage,
    noindex: true,
  },
  "/app": {
    title: "Dashboard - Secritou",
    description: "Access your Secritou workspace dashboard.",
    path: "/app",
    image: defaultImage,
    noindex: true,
  },
  "/app/leads": {
    title: "Leads - Secritou",
    description: "Track and manage your sales pipeline and lead opportunities in Secritou.",
    path: "/app/leads",
    image: defaultImage,
    noindex: true,
  },
  "/app/clients": {
    title: "Clients - Secritou",
    description: "Organize client companies, contacts and engagements in Secritou.",
    path: "/app/clients",
    image: defaultImage,
    noindex: true,
  },
  "/app/freelancers": {
    title: "Freelancers - Secritou",
    description: "Browse and manage freelancer profiles in Secritou.",
    path: "/app/freelancers",
    image: defaultImage,
    noindex: true,
  },
  "/app/projects": {
    title: "Projects - Secritou",
    description: "Manage initiatives, ownership, timelines and tasks in Secritou.",
    path: "/app/projects",
    image: defaultImage,
    noindex: true,
  },
  "/app/tasks": {
    title: "Tasks - Secritou",
    description: "Track project tasks, assignments and progress in Secritou.",
    path: "/app/tasks",
    image: defaultImage,
    noindex: true,
  },
  "/app/ai": {
    title: "AI Assistant - Secritou",
    description: "Ask questions about projects, reports and company performance in Secritou.",
    path: "/app/ai",
    image: defaultImage,
    noindex: true,
  },
  "/app/analytics": {
    title: "Analytics - Secritou",
    description: "Track company KPIs, trends and operating metrics in Secritou.",
    path: "/app/analytics",
    image: defaultImage,
    noindex: true,
  },
  "/app/reports": {
    title: "Reports - Secritou",
    description: "Create, review and share business performance reports in Secritou.",
    path: "/app/reports",
    image: defaultImage,
    noindex: true,
  },
  "/app/applications": {
    title: "Applications - Secritou",
    description: "Review freelancer applications to your missions in Secritou.",
    path: "/app/applications",
    image: defaultImage,
    noindex: true,
  },
  "/app/proposals": {
    title: "Proposals - Secritou",
    description: "Manage proposals for client projects in Secritou.",
    path: "/app/proposals",
    image: defaultImage,
    noindex: true,
  },
  "/app/approvals": {
    title: "Approvals - Secritou",
    description: "Review and approve project deliverables and milestones in Secritou.",
    path: "/app/approvals",
    image: defaultImage,
    noindex: true,
  },
  "/app/invoices": {
    title: "Invoices - Secritou",
    description: "Create and manage invoices for projects and missions in Secritou.",
    path: "/app/invoices",
    image: defaultImage,
    noindex: true,
  },
  "/app/documents": {
    title: "Documents - Secritou",
    description: "Store, organize and share project documents securely in Secritou.",
    path: "/app/documents",
    image: defaultImage,
    noindex: true,
  },
  "/app/client-onboardings": {
    title: "Client Onboardings - Secritou",
    description: "Manage client onboarding processes and timelines in Secritou.",
    path: "/app/client-onboardings",
    image: defaultImage,
    noindex: true,
  },
  "/app/service-requests": {
    title: "Service Requests - Secritou",
    description: "Manage service requests from clients in Secritou.",
    path: "/app/service-requests",
    image: defaultImage,
    noindex: true,
  },
  "/app/settings": {
    title: "Settings - Secritou",
    description: "Configure company settings, users, billing and access controls in Secritou.",
    path: "/app/settings",
    image: defaultImage,
    noindex: true,
  },
  "/client": {
    title: "Client Dashboard - Secritou",
    description: "Access your client dashboard to track projects and requests in Secritou.",
    path: "/client",
    image: defaultImage,
    noindex: true,
  },
  "/client/projects": {
    title: "My Projects - Secritou",
    description: "View and manage your projects in Secritou client portal.",
    path: "/client/projects",
    image: defaultImage,
    noindex: true,
  },
  "/client/requests": {
    title: "Service Requests - Secritou",
    description: "Submit and track service requests in Secritou client portal.",
    path: "/client/requests",
    image: defaultImage,
    noindex: true,
  },
  "/client/profile": {
    title: "My Profile - Secritou",
    description: "Manage your profile information in Secritou client portal.",
    path: "/client/profile",
    image: defaultImage,
    noindex: true,
  },
};

export function getSeoConfig(pathname: string) {
  // First, try exact match
  if (seoByPath[pathname]) {
    return seoByPath[pathname];
  }

  // Try to match dynamic routes by replacing :id, :clientId, etc. with pattern
  const dynamicRouteMatchers = [
    { pattern: /^\/app\/clients\/[^/]+$/, fallbackPath: "/app/clients" },
    { pattern: /^\/app\/freelancers\/[^/]+$/, fallbackPath: "/app/freelancers" },
    { pattern: /^\/app\/client-success\/[^/]+$/, fallbackPath: "/app/analytics" },
    { pattern: /^\/app\/client-onboarding\/[^/]+$/, fallbackPath: "/app/client-onboardings" },
  ];

  for (const { pattern, fallbackPath } of dynamicRouteMatchers) {
    if (pattern.test(pathname)) {
      const fallbackConfig = seoByPath[fallbackPath];
      if (fallbackConfig) {
        return {
          ...fallbackConfig,
          path: pathname,
        };
      }
    }
  }

  // Fallback for truly unknown routes
  return {
    ...defaultSeo,
    title: "Page Not Found - Secritou",
    description: "The requested Secritou page could not be found.",
    path: pathname,
    noindex: true,
  };
}

export function absoluteUrl(path: string) {
  return `${siteUrl}${path === "/" ? "" : path}`;
}
