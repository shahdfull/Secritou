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
  "/app/missions": {
    title: "Missions - Secritou",
    description: "Post and manage freelance missions in Secritou marketplace.",
    path: "/app/missions",
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
