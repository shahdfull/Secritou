import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { absoluteUrl, getSeoConfig } from "@/lib/seo";

function setMetaAttribute(selector: string, attribute: "content" | "href", value: string) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;

  if (!element) {
    element = selector.startsWith("link")
      ? document.createElement("link")
      : document.createElement("meta");

    const nameMatch = selector.match(/\[name="([^"]+)"\]/);
    const propertyMatch = selector.match(/\[property="([^"]+)"\]/);
    const relMatch = selector.match(/\[rel="([^"]+)"\]/);

    if (nameMatch) element.setAttribute("name", nameMatch[1]);
    if (propertyMatch) element.setAttribute("property", propertyMatch[1]);
    if (relMatch) element.setAttribute("rel", relMatch[1]);

    document.head.appendChild(element);
  }

  element.setAttribute(attribute, value);
}

function setStructuredData() {
  const siteUrl = absoluteUrl("/");
  const logoUrl = absoluteUrl("/secritou-logo.png");

  // Organization Schema
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Secritou",
    url: siteUrl,
    logo: logoUrl,
    description:
      "Secritou helps SMEs, startuppers and creators organize, digitize and grow through strategy, technology, marketing and data-driven decisions.",
  };

  // ProfessionalService Schema
  const professionalServiceSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Secritou",
    description:
      "Secritou helps SMEs, startuppers and creators organize, digitize and grow through strategy, technology, marketing and data-driven decisions.",
    url: siteUrl,
    provider: {
      "@type": "Organization",
      name: "Secritou",
      url: siteUrl,
    },
    areaServed: "Worldwide",
    serviceType: [
      "Business Performance & KPI Tracking",
      "Digital Growth & Marketing",
      "Technology Solutions & Websites",
      "AI & Automation",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@secritou.com",
      contactType: "customer service",
      availableLanguage: ["English"],
    },
  };

  // Website Schema
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Secritou",
    url: siteUrl,
    publisher: {
      "@type": "Organization",
      name: "Secritou",
      logo: logoUrl,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  // Remove existing script tags if any
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());

  // Add Organization Schema
  const orgScript = document.createElement("script");
  orgScript.type = "application/ld+json";
  orgScript.text = JSON.stringify(organizationSchema);
  document.head.appendChild(orgScript);

  // Add ProfessionalService Schema
  const serviceScript = document.createElement("script");
  serviceScript.type = "application/ld+json";
  serviceScript.text = JSON.stringify(professionalServiceSchema);
  document.head.appendChild(serviceScript);

  // Add Website Schema
  const websiteScript = document.createElement("script");
  websiteScript.type = "application/ld+json";
  websiteScript.text = JSON.stringify(websiteSchema);
  document.head.appendChild(websiteScript);
}

export function SEO() {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoConfig(location.pathname);
    const canonicalUrl = absoluteUrl(seo.path);
    const robots = seo.noindex ? "noindex,nofollow" : "index,follow";
    const image = seo.image ?? absoluteUrl("/secritou-logo.png");

    document.title = seo.title;

    setMetaAttribute('meta[name="description"]', "content", seo.description);
    setMetaAttribute('meta[name="robots"]', "content", robots);
    setMetaAttribute('link[rel="canonical"]', "href", canonicalUrl);

    setMetaAttribute('meta[property="og:type"]', "content", "website");
    setMetaAttribute('meta[property="og:site_name"]', "content", "Secritou");
    setMetaAttribute('meta[property="og:title"]', "content", seo.title);
    setMetaAttribute('meta[property="og:description"]', "content", seo.description);
    setMetaAttribute('meta[property="og:url"]', "content", canonicalUrl);
    setMetaAttribute('meta[property="og:image"]', "content", image);

    setMetaAttribute('meta[name="twitter:card"]', "content", "summary_large_image");
    setMetaAttribute('meta[name="twitter:title"]', "content", seo.title);
    setMetaAttribute('meta[name="twitter:description"]', "content", seo.description);
    setMetaAttribute('meta[name="twitter:image"]', "content", image);

    setStructuredData();
  }, [location.pathname]);

  return null;
}
