import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { absoluteUrl, getSeoConfig } from "@/lib/seo";
import i18n from "@/i18n";

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

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}#organization`,
    name: "Secritou",
    url: siteUrl,
    logo: { "@type": "ImageObject", url: logoUrl },
    description:
      "Agence digitale tunisienne — stratégie, technologie, marketing et IA pour PME, startups et créateurs.",
    email: "contact@secritou.tn",
    telephone: "+21694243333",
    sameAs: [
      // à compléter : page LinkedIn de l'agence, Facebook, Instagram
    ],
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${siteUrl}#localbusiness`,
    name: "Secritou",
    image: absoluteUrl("/secritou-og.png"),
    url: siteUrl,
    telephone: "+21694243333",
    email: "contact@secritou.tn",
    priceRange: "990 TND - sur devis",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Tunis",
      addressRegion: "Tunis",
      addressCountry: "TN",
    },
    geo: { "@type": "GeoCoordinates", latitude: 36.8065, longitude: 10.1815 },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    areaServed: { "@type": "Country", name: "Tunisia" },
    parentOrganization: { "@id": `${siteUrl}#organization` },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+21694243333",
      email: "contact@secritou.tn",
      contactType: "customer service",
      availableLanguage: ["French", "Arabic", "English"],
    },
  };

  // One Service node per pôle, aligned with the four internal service lines.
  const serviceSchemas = [
    {
      name: "Tableaux de bord KPI & pilotage de la performance",
      description:
        "Mise en place de tableaux de bord KPI, objectifs et analytics business pour PME tunisiennes : une seule source de vérité pour vos chiffres.",
      slug: "services#performance",
    },
    {
      name: "Croissance digitale & marketing",
      description:
        "Réseaux sociaux, contenu, SEO et acquisition payante coordonnés pour générer des leads qualifiés en Tunisie.",
      slug: "services#digital-growth",
    },
    {
      name: "Création de sites web & e-commerce",
      description:
        "Création de sites vitrines et boutiques e-commerce en Tunisie : développement sur mesure, paiement local, inventaire.",
      slug: "services#technology",
    },
    {
      name: "IA & automatisation",
      description:
        "Chatbots IA, automatisation de processus et assistants intelligents pour compresser des heures de travail manuel.",
      slug: "services#ai-automation",
    },
  ].map((s) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.name,
    description: s.description,
    url: absoluteUrl(`/${s.slug}`),
    provider: { "@id": `${siteUrl}#localbusiness` },
    areaServed: { "@type": "Country", name: "Tunisia" },
    availableChannel: { "@type": "ServiceChannel", serviceUrl: absoluteUrl("/contact") },
  }));

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Secritou",
    url: siteUrl,
    inLanguage: "fr",
    publisher: { "@id": `${siteUrl}#organization` },
    // No SearchAction: the site has no public /search page.
  };

  // Remove existing script tags if any, then inject the full graph.
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());

  for (const schema of [organizationSchema, localBusinessSchema, ...serviceSchemas, websiteSchema]) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }
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
    // meta keywords: ignored by search engines since 2009 — removed on purpose.
    document.head.querySelector('meta[name="keywords"]')?.remove();
    setMetaAttribute('meta[name="robots"]', "content", robots);
    setMetaAttribute('link[rel="canonical"]', "href", canonicalUrl);

    setMetaAttribute('meta[property="og:type"]', "content", "website");
    setMetaAttribute('meta[property="og:site_name"]', "content", "Secritou");
    setMetaAttribute('meta[property="og:title"]', "content", seo.title);
    setMetaAttribute('meta[property="og:description"]', "content", seo.description);
    setMetaAttribute('meta[property="og:url"]', "content", canonicalUrl);
    setMetaAttribute('meta[property="og:image"]', "content", image);
    setMetaAttribute('meta[property="og:image:width"]', "content", "1200");
    setMetaAttribute('meta[property="og:image:height"]', "content", "630");
    setMetaAttribute('meta[property="og:locale"]', "content", (i18n.resolvedLanguage ?? i18n.language ?? "fr").split("-")[0] === "en" ? "en_US" : "fr_TN");

    setMetaAttribute('meta[name="twitter:card"]', "content", "summary_large_image");
    setMetaAttribute('meta[name="twitter:title"]', "content", seo.title);
    setMetaAttribute('meta[name="twitter:description"]', "content", seo.description);
    setMetaAttribute('meta[name="twitter:image"]', "content", image);

    setStructuredData();
  }, [location.pathname]);

  return null;
}
