# Audit 06 — SEO technique du site vitrine

**Date** : 2026-07-06
**Périmètre** : pages publiques (`/`, `/services`, `/solutions`, `/case-studies`, `/contact`, `/rejoindre`)
**Contexte** : agence B2B tunisienne, lancement sans notoriété — cibles : « agence digitale Tunis », « tableaux de bord KPI Tunisie », « création site e-commerce Tunisie »

**Verdict global** : l'infrastructure méta (title/description/canonical/robots par route) est **déjà bien construite** (`lib/seo.ts` + `SEO.tsx`), mais elle tourne **entièrement en JavaScript** — les crawlers sociaux ne la voient jamais, et Google ne voit le contenu qu'au second passage de rendu. À corriger avant tout investissement contenu.

---

## 1. Rendu : SPA pur — le problème n°1

**Constat** (`dist/index.html` après build) : le body est `<div id="root"></div>`. Sans JavaScript :

- **Googlebot** : rend le JS (file d'attente de rendu), mais un site neuf sans notoriété subit un crawl budget minimal — l'indexation initiale peut prendre des semaines, et tout signal on-page dépend du rendu différé.
- **LinkedIn, Facebook, WhatsApp, Twitter** : leurs scrapers **n'exécutent pas JS**. Ils lisent le `<head>` statique de `index.html` — qui contient les meta **de la page d'accueil**. Conséquence directe : **partager `/services` ou `/contact` sur LinkedIn affiche le titre/description/image de la home**. Pour une agence B2B dont LinkedIn est le canal principal, c'est le défaut le plus coûteux du site.
- Le `SEO.tsx` (useEffect) ne sert donc qu'à Googlebot post-rendu et aux navigateurs.

### Recommandation : prérendu post-build des 7 routes publiques (effort S — ~1 jour)

Pas de SSR ni de migration : un script Puppeteer post-build qui visite chaque route publique sur `vite preview` et écrit le HTML rendu dans `dist/<route>/index.html`. L'hébergeur sert ces fichiers statiques ; l'app s'hydrate par-dessus ; `/app/*` reste une SPA pure.

```js
// client/scripts/prerender.mjs — npm run build && node scripts/prerender.mjs
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import puppeteer from "puppeteer";
import sirv from "sirv";

const ROUTES = ["/", "/services", "/solutions", "/case-studies", "/contact", "/rejoindre", "/mentions-legales", "/confidentialite"];
const DIST = new URL("../dist", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

const serve = sirv(DIST, { single: true });
const server = createServer(serve).listen(4174);

const browser = await puppeteer.launch();
const page = await browser.newPage();
for (const route of ROUTES) {
  await page.goto(`http://localhost:4174${route}`, { waitUntil: "networkidle0" });
  const html = await page.content();
  const file = route === "/" ? join(DIST, "index.html") : join(DIST, route, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(`✓ ${route} → ${file}`);
}
await browser.close();
server.close();
```

| Option | Effort | Quand |
|---|---|---|
| **Script Puppeteer post-build** (ci-dessus) | **S (~1 j)** | maintenant — résout crawlers sociaux + HTML initial complet |
| `vite-react-ssg` (SSG intégré) | M (2-4 j, refactor des points d'entrée) | si le contenu vitrine grandit |
| Migration vitrine vers Astro (app React inchangée) | L (1-2 sem.) | seulement si la vitrine devient un vrai site de contenu (blog, pages piliers) |

⚠️ Piège à éviter avec le prérendu : `useBootstrapSession` et `LandingCmsProvider` s'exécutent pendant le snapshot — vérifier que le HTML capturé contient bien les fallbacks i18n FR (c'est le cas : le CMS ne fait que surcharger des textes déjà rendus).

---

## 2. Balises par page

### Ce qui est déjà bon ✓

- `title` + `meta description` **uniques par route**, orientés mots-clés locaux (`lib/seo.ts`) ✓
- `canonical` par page ✓ · `robots noindex` sur login/legal/app ✓
- OG complet (title/description/url/image/locale) + Twitter card ✓ (mais voir §1 : invisibles pour les scrapers sans prérendu)
- `lang` dynamique sur `<html>` ✓ (corrigé à l'audit i18n)

### Problèmes

| # | Problème | Fichier | Correctif |
|---|---|---|---|
| 2.1 | **Image OG : PNG de 1,1 MB en 1730×909** alors que les meta déclarent 1200×630. Facebook/LinkedIn tolèrent mal > 300 KB (timeout scraper possible) et le ratio ne correspond pas | `public/secritou-og.png` | Exporter en **JPG 1200×630, < 200 KB**. Idem `secritou-logo.png` : **1,4 MB** pour un favicon — le réduire à 512×512 < 50 KB |
| 2.2 | **Pas de hreflang** — FR/EN partagent la même URL (langue en localStorage) : Google ne verra jamais l'anglais, et aucun hreflang n'est déclarable sans URLs distinctes | — | **Pour le lancement : assumer un site FR-only pour Google** (cible tunisienne francophone — correct). Si l'EN devient stratégique : préfixe `/en/*` + hreflang (effort M). Ne PAS déclarer de hreflang tant que les URLs ne diffèrent pas |
| 2.3 | Titles de `/rejoindre` **en anglais** sur un slug français (« Join Secritou as Freelancer... ») | `lib/seo.ts:83` | FR : `Rejoindre Secritou — Freelances & Managers en Tunisie` |
| 2.4 | `meta keywords` rempli partout — ignoré par Google depuis 2009, signal spam pour certains | `SEO.tsx:133` | Supprimer (1 ligne) |
| 2.5 | **Titre « Page Not Found » sur des pages valides** : toutes les routes internes absentes de `seoByPath` (`/app/talent`, `/app/crm`, `/app/commercial`, `/app/questions`, `/client/invoices`, `/client/documents`, `/app/freelancer-dashboard`…) tombent dans le fallback 404 de `getSeoConfig` | `lib/seo.ts:286-292` | Fallback intelligent : `if (pathname.startsWith("/app") || pathname.startsWith("/client")) return { ...defaultSeo, title: "Secritou", noindex: true, path: pathname };` avant le fallback 404 |

### Balises corrigées prêtes à coller (`lib/seo.ts`)

```ts
"/rejoindre": {
  title: "Rejoindre Secritou — Freelances & Managers en Tunisie",
  description:
    "Rejoignez le réseau Secritou : missions pour freelances (dev, design, data, marketing) et postes de managers. Postulez avec votre CV et portfolio.",
  path: "/rejoindre",
  image: defaultImage,
  keywords: undefined, // meta keywords supprimé partout
},
```

Équivalents EN (à utiliser le jour où `/en/*` existe) :

```ts
"/en/": { title: "Secritou — Digital Agency in Tunisia | Growth & Transformation", description: "Secritou helps Tunisian SMEs, startups and creators get organized, digitize and grow through strategy, technology, marketing and data.", path: "/en/" },
"/en/services": { title: "Services — Web Development & Digital Marketing in Tunisia | Secritou", description: "Secritou services: website & e-commerce development, KPI dashboards, community management, AI & automation for Tunisian businesses.", path: "/en/services" },
"/en/solutions": { title: "Solutions for SMEs, Startups & Creators in Tunisia | Secritou", description: "Growth and digital transformation solutions tailored to Tunisian SMEs, entrepreneurs and content creators.", path: "/en/solutions" },
"/en/contact": { title: "Contact — Digital Agency in Tunis | Secritou", description: "Contact Secritou, digital agency in Tunis. Book a free 30-minute consultation about strategy, technology, marketing and AI.", path: "/en/contact" },
"/en/join": { title: "Join Secritou — Freelancers & Managers in Tunisia", description: "Join the Secritou network: freelance missions (dev, design, data, marketing) and manager roles. Apply with your CV and portfolio.", path: "/en/join" },
```

---

## 3. Structure Hn et liens

- **Un seul H1 par page** ✓ vérifié sur les 8 pages publiques (Hero, Services, Solutions, CaseStudies, Contact, JoinUs, Legal, Privacy).
- Hiérarchie H2/H3 : correcte sur la home (sections en H2). Sur `/services`, chaque pôle est un H2 ✓ mais il n'y a **aucun H3** de détail — symptôme du contenu mince (§7).
- Textes de liens : les CTA (« Réserver une consultation gratuite », « Voir nos services ») sont explicites ✓. Pas de « cliquez ici » détecté.
- ⚠️ `NotFoundPage` a pour H1 « 404 » — acceptable, mais ajouter un lien retour explicite vers `/` et `/services` (maillage).

---

## 4. robots.txt & sitemap.xml

**robots.txt** ✓ très bien : `/app`, `/client`, `/admin`, `/freelancer`, `/login`, mots de passe — tous exclus, sitemap déclaré.

**sitemap.xml** ✓ propre (7 URLs publiques, priorités cohérentes). Points d'amélioration :
- Pas d'alternates hreflang — **correct en l'état** (une seule langue indexable, cf. §2.2). En ajouter serait une erreur tant que FR/EN partagent l'URL.
- `lastmod` figé au 2026-07-05 — à générer au build (sinon le retirer : un lastmod faux est pire qu'absent).
- Défense en profondeur : les pages `noindex` (login, legal) ne sont pas dans le sitemap ✓ cohérent.

**Exclusion /app et /login de l'indexation** : double protection ✓ — `Disallow` dans robots.txt **et** `meta robots noindex` par route. (Note : le noindex meta n'est vu qu'au rendu JS ; avec le prérendu §1, les pages publiques l'auront en HTML statique. Pour `/app/*`, le Disallow robots.txt suffit puisque Google ne doit même pas crawler.)

---

## 5. Données structurées

**Existant** (`SEO.tsx:28-119`) : Organization + ProfessionalService + WebSite injectés en JS. Deux défauts :
1. Le `WebSite.potentialAction.SearchAction` pointe vers `/search?q=` **qui n'existe pas** → à supprimer (risque de rich result cassé).
2. Pas de `LocalBusiness` géolocalisé Tunis ni de `Service` individuels — demandés, les voici **prêts à coller** (remplacer le contenu de `setStructuredData`) :

```ts
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}#organization`,
  name: "Secritou",
  url: siteUrl,
  logo: { "@type": "ImageObject", url: logoUrl, width: 512, height: 512 },
  description: "Agence digitale tunisienne — stratégie, technologie, marketing et IA pour PME, startups et créateurs.",
  email: "hello@secritou.com",
  telephone: "+21694243333",
  sameAs: [
    // à compléter : page LinkedIn de l'agence, Facebook, Instagram
    // "https://www.linkedin.com/company/secritou",
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
  email: "hello@secritou.com",
  priceRange: "990 TND - sur devis",
  address: {
    "@type": "PostalAddress",
    streetAddress: "", // à compléter si adresse physique
    addressLocality: "Tunis",
    addressRegion: "Tunis",
    postalCode: "",
    addressCountry: "TN",
  },
  geo: { "@type": "GeoCoordinates", latitude: 36.8065, longitude: 10.1815 },
  openingHoursSpecification: [{
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  }],
  areaServed: { "@type": "Country", name: "Tunisia" },
  parentOrganization: { "@id": `${siteUrl}#organization` },
};

// Un nœud Service par pôle — aligné sur les 4 pôles internes
const serviceSchemas = [
  {
    name: "Tableaux de bord KPI & pilotage de la performance",
    description: "Mise en place de tableaux de bord KPI, objectifs et analytics business pour PME tunisiennes : une seule source de vérité pour vos chiffres.",
    slug: "services#performance",
  },
  {
    name: "Croissance digitale & marketing",
    description: "Réseaux sociaux, contenu, SEO et acquisition payante coordonnés pour générer des leads qualifiés en Tunisie.",
    slug: "services#digital-growth",
  },
  {
    name: "Création de sites web & e-commerce",
    description: "Création de sites vitrines et boutiques e-commerce en Tunisie : développement sur mesure, paiement local (Flouci, virement), inventaire.",
    slug: "services#technology",
  },
  {
    name: "IA & automatisation",
    description: "Chatbots IA, automatisation de processus et assistants intelligents pour compresser des heures de travail manuel.",
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
  // SearchAction supprimé : /search n'existe pas
};
```

Valider ensuite avec https://search.google.com/test/rich-results.

---

## 6. URLs, slugs, redirections, 404

### Incohérence de langue des slugs

| Slug | Langue | Cohérent ? |
|---|---|---|
| `/services`, `/solutions`, `/contact` | neutre/EN | ✓ |
| `/case-studies` | EN | ⚠️ seul slug purement anglais indexable |
| `/rejoindre`, `/mentions-legales`, `/confidentialite` | FR | ✓ pour cible FR |

Le mélange n'est pas pénalisant en soi, mais pour un site FR-first : renommer `/case-studies` → `/realisations` avec redirection 301 de l'ancien slug (à faire **avant** le lancement, tant qu'aucun lien externe n'existe — après, ne plus toucher).

### Le bug « Page Not Found » vu en démo

Cause identifiée : ce n'est pas la 404 de l'hébergeur mais `getSeoConfig` (`lib/seo.ts:286-292`) qui met `document.title = "Page Not Found - Secritou"` pour **toute route absente de `seoByPath`** — dont une douzaine de routes internes valides (`/app/talent`, `/app/crm`, `/app/commercial`, `/client/invoices`…). Correctif §2.5 (3 lignes).

### 404 SPA côté hébergeur — à configurer (aucune config trouvée dans le repo)

Aucun `vercel.json`, `netlify.toml`, `_redirects` ni conf nginx dans le projet. Deux exigences contradictoires à réconcilier :
1. les deep links (`/services` rechargé) doivent servir l'app (rewrite vers `index.html`) ;
2. une URL inexistante doit renvoyer un **vrai statut 404** (sinon : soft-404, Google indexe des pages d'erreur en 200).

Avec le prérendu §1, la solution devient propre — exemple nginx :

```nginx
server {
  listen 443 ssl;
  server_name secritou.tn;
  root /var/www/secritou/dist;

  # Pages publiques prérendues : servies en statique (vrai HTML, vrai 200)
  location / {
    try_files $uri $uri/index.html @spa_known;
  }

  # Routes SPA connues uniquement (app interne) : fallback index.html
  location @spa_known {
    if ($uri ~ ^/(app|client|login|change-password|forgot-password|reset-password)) {
      rewrite ^ /index.html last;
    }
    # Tout le reste : vrai 404 (page prérendue de NotFoundPage)
    return 404;
  }
  error_page 404 /404/index.html;
}
```

(Ajouter `/404` à la liste des routes prérendues du script §1.) Équivalent Vercel : `vercel.json` avec `rewrites` pour `/app/*` etc. et le prérendu en output statique.

---

## 7. Contenu indexable par pôle

**Constat** : tout le contenu vit sur 3 pages courtes. `ServicesPage.tsx` = 115 lignes : les 4 pôles sont des **cartes H2 avec ~2 phrases chacune**, sans H3, sans ancres (`id=`), sans URL propre. `/solutions` = 105 lignes, même structure par persona.

Pour les requêtes cibles (« création site e-commerce Tunisie », « tableaux de bord KPI Tunisie »), il faut **une URL par pôle** avec 400–800 mots :

| URL à créer | Requête cible | Contenu minimal |
|---|---|---|
| `/services/site-ecommerce-tunisie` | création site e-commerce Tunisie | processus, technologies, paiement local (Flouci), délais, FAQ, 1 cas client |
| `/services/tableaux-de-bord-kpi` | tableaux de bord KPI Tunisie | exemples de KPI par secteur, captures du produit, méthode |
| `/services/marketing-digital-tunis` | agence digitale Tunis / community management | canaux, livrables mensuels, tarifs indicatifs |
| `/services/ia-automatisation` | automatisation IA Tunisie | cas d'usage concrets (chatbot, relances, reporting auto) |

Chaque page : H1 avec la requête, H2 sections, JSON-LD `Service` (§5), lien retour `/services`, CTA `/contact`. Ajouter ces URLs au sitemap et au script de prérendu. **C'est l'investissement SEO au meilleur ROI après le prérendu** — sans ces pages, le site ne peut tout simplement pas se positionner sur les requêtes cibles, quelle que soit la technique.

---

## Plan d'action priorisé — statut au 2026-07-06

| # | Action | Impact SEO | Statut |
|---|---|---|---|
| 1 | Prérendu post-build des routes publiques (§1) | 🔴 bloquant partages sociaux + indexation | ✅ **appliqué** — `client/scripts/prerender.mjs` (Puppeteer + sirv), scripts npm `prerender` et `build:seo`. 9 routes prérendues (dont `/404` pour l'error_page hébergeur). Langue forcée FR (Chrome headless détecterait EN via navigator), analytics bloqués pendant le snapshot, **garde-fou localhost** : avertit si les canonicals sont bakés avec le VITE_SITE_URL de dev. Vérifié : title/OG/canonical par page, contenu FR, `lang="fr"`, 7 blocs JSON-LD dans le HTML statique |
| 2 | Image OG en JPG 1200×630 < 200 KB + logo optimisé (§2.1) | 🔴 partages LinkedIn/FB | ⬜ **manuel** — asset design à réexporter |
| 3 | Config hébergeur : rewrites SPA + vrai 404 (§6) | 🔴 soft-404 / deep links | ⬜ à faire au déploiement (conf nginx fournie §6) |
| 4 | Fallback `getSeoConfig` pour /app, /client (§2.5) | titre correct partout | ✅ appliqué — plus de « Page Not Found » sur les routes internes |
| 5 | JSON-LD LocalBusiness + Service, retrait SearchAction (§5) | rich results locaux | ✅ appliqué — Organization + LocalBusiness (Tunis, geo, horaires) + 4 Service + WebSite, liés par `@id`. `sameAs` à compléter avec les réseaux sociaux réels |
| 6 | 4 pages pôles avec contenu 400-800 mots (§7) | 🔴 positionnement requêtes cibles | ⬜ contenu à rédiger (plan §7) |
| 7 | Title FR pour /rejoindre ✅, retrait meta keywords ✅, `/case-studies` → `/realisations` + 301 ⬜ (décision produit) | hygiène | partiel |
| 8 | lastmod sitemap généré au build (§4) | hygiène | ⬜ |

**Rappel déploiement** : builder avec `VITE_SITE_URL=https://secritou.tn` puis `npm run build:seo` — le script avertit si les canonicals pointent vers localhost.
