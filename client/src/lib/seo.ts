export type SeoConfig = {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
};

const siteUrl = (import.meta.env.VITE_SITE_URL ?? "https://secritou.com").replace(/\/$/, "");
const defaultImage = `${siteUrl}/secritou-logo.png`;

export const defaultSeo: SeoConfig = {
  title: "Secritou - Growth & Digital Transformation Platform",
  description:
    "Secritou helps SMEs, entrepreneurs and creators organize, digitize and grow through strategy, technology, marketing and data-driven decisions.",
  path: "/",
  image: defaultImage,
};

export const seoByPath: Record<string, SeoConfig> = {
  "/": defaultSeo,
  "/services": {
    title: "Services - Secritou",
    description:
      "Explore Secritou services across business performance, digital growth, technology solutions, AI and automation.",
    path: "/services",
    image: defaultImage,
  },
  "/solutions": {
    title: "Solutions for SMEs, Entrepreneurs and Creators - Secritou",
    description:
      "Growth and digital transformation solutions tailored for SMEs, entrepreneurs and content creators.",
    path: "/solutions",
    image: defaultImage,
  },
  "/case-studies": {
    title: "Case Studies - Secritou",
    description:
      "See how Secritou helps businesses improve performance, launch digital systems and unlock measurable growth.",
    path: "/case-studies",
    image: defaultImage,
  },
  "/contact": {
    title: "Contact Secritou",
    description:
      "Book a free consultation with Secritou to discuss strategy, technology, marketing, AI and business growth.",
    path: "/contact",
    image: defaultImage,
  },
  "/login": {
    title: "Sign in - Secritou",
    description: "Sign in to your Secritou workspace.",
    path: "/login",
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
  "/app/analytics": {
    title: "Analytics - Secritou",
    description: "Track company KPIs, trends and operating metrics in Secritou.",
    path: "/app/analytics",
    image: defaultImage,
    noindex: true,
  },
  "/app/ai-assistant": {
    title: "AI Assistant - Secritou",
    description: "Ask questions about projects, reports and company performance in Secritou.",
    path: "/app/ai-assistant",
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
  "/app/reports": {
    title: "Reports - Secritou",
    description: "Create, review and share business performance reports in Secritou.",
    path: "/app/reports",
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
  "/app/settings": {
    title: "Settings - Secritou",
    description: "Configure company settings, users, billing and access controls in Secritou.",
    path: "/app/settings",
    image: defaultImage,
    noindex: true,
  },
};

export function getSeoConfig(pathname: string) {
  return seoByPath[pathname] ?? {
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
