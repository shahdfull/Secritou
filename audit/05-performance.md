# Audit 05 — Performance (Vite/React)

**Date** : 2026-07-06
**Méthode** : build de production réel (`vite build`, 17,8 s) + `rollup-plugin-visualizer` (template `raw-data`, gzip) — la config a été mise à jour pour produire `dist/stats.json` (`ANALYZE=true npx vite build`).
**Budgets cibles** : vitrine < 200 KB JS gzip au premier chargement · LCP < 2,5 s sur 4G.

**Verdict budgets** : ❌ **~315 KB JS gzip** au premier chargement de la home (dépassement +58 %) · ❌ LCP estimé **3,5–4,5 s** sur 4G tunisien.

---

## 1. Bundle de production

- **Total dist** : 9,4 MB (assets JS : 6,9 MB, 140 chunks) — inoffensif en soi, tout n'est pas chargé.
- **CSS** : un seul `index.css` de 110 KB (18 KB gzip) pour vitrine + app — acceptable.

### Chunks au premier chargement de la home (gzip)

| Chunk | Raw | Gzip | Contenu |
|---|---|---|---|
| `index-*.js` (entrée) | 743 KB | **231,5 KB** | voir décomposition ci-dessous |
| `vendor` | 49,8 KB | 17,7 KB | react + react-router (**sans react-dom !**) |
| `HomePage` | 88,5 KB | 27,6 KB | toutes les sections landing |
| `motion` | 94,9 KB | 31,3 KB | motion/react (animations hero) |
| petits chunks (FinalCTA, dialog, textarea, icônes, useCustomQuestions…) | — | ~8 KB | |
| **Total JS home** | | **≈ 315 KB** | budget : 200 KB |

### Décomposition du chunk d'entrée (231,5 KB gzip, parts approximatives)

| Dépendance | ~gzip | Justifiée dans l'entrée ? |
|---|---|---|
| **react-dom** | ~53 KB | ⚠️ devrait être dans `vendor` — le `manualChunks: { vendor: ["react-dom"] }` ne capture pas le sous-chemin `react-dom/client` importé par `main.tsx` |
| **axios** + intercepteurs | ~25 KB | ⚠️ lourd pour la vitrine (une seule requête CMS) ; `fetch` natif ferait l'affaire côté public |
| **src/i18n** (FR **et** EN JSON) | ~20 KB | ❌ les deux langues sont importées statiquement (`i18n/index.ts:4-5`) — un visiteur FR télécharge tout l'anglais |
| src/components (3 layouts internes + sidebar + Radix menu/scroll/tooltip + NotificationBell + GlobalSearch) | ~30 KB | ❌ `AppRoutes.tsx:7-9` importe `AdminLayout`/`ClientLayout`/`FreelancerLayout` **en eager** — le visiteur vitrine télécharge la coquille du CRM |
| @tanstack/react-query | ~12 KB | ✓ utilisé partout |
| i18next + react-i18next + detector | ~13 KB | ✓ |
| tailwind-merge | ~9 KB | ✓ (shadcn) |
| lucide-react (icônes) | ~9 KB | ✓ tree-shaké |
| sonner | ~7 KB | ~ (toasts inutiles sur la vitrine) |
| @sentry | ~5 KB | ✓ (init conditionnelle) |

### Grosses dépendances correctement isolées (lazy, payées seulement par l'app interne) ✓

| Chunk | Gzip | Chargé par |
|---|---|---|
| exceljs | 270 KB | ReportsPage → `import()` dans `exportExcel.ts` ✓ |
| jspdf + autotable + html2canvas | 126 + 9,5 + 47 KB | ReportsPage → `import()` dans `exportPdf.ts` ✓ |
| ApplicationsPage (react-pdf/pdfjs statique) | 128 KB | route `/app/talent` — pdfjs pourrait être différé au clic "Voir CV" mais coût limité à l'admin |
| recharts (`generateCategoricalChart`) | 104 KB | pages dashboard/analytics ✓ |
| @dnd-kit | 16,5 KB | kanban ✓ |

Pas de librairie dupliquée détectée (`dedupe: ["react","react-dom"]` actif ; une seule lib de dates : date-fns + locale fr en chunk séparé de 7 KB).

---

## 2. Code splitting vitrine vs app

**Bonne base** : les ~45 routes sont toutes en `React.lazy()` ([AppRoutes.tsx](../client/src/routes/AppRoutes.tsx)), avec préchargement au survol de la sidebar (`routePrefetch.ts`) — pattern excellent.

**Deux fuites vers la vitrine** :
1. **Layouts internes eager** (`AppRoutes.tsx:7-9`) : `AdminLayout`, `ClientLayout`, `FreelancerLayout` et leur graphe (sidebar Radix, NotificationBell, GlobalSearch, AIAssistantFloat, ai.api, dropdowns) sont dans le chunk d'entrée. Un visiteur du site télécharge la coquille du CRM sans jamais se connecter.
2. **`useBootstrapSession()` dans `App.tsx:12`** : chaque visiteur anonyme déclenche un `POST /auth/refresh` (→ 401) au chargement, en pleine fenêtre critique du LCP.

L'app interne, elle, est correctement découpée : un manager qui ouvre `/app` ne télécharge ni exceljs ni pdfjs.

---

## 3. Images

- **3 images seulement dans dist** : `secritou-logo.png` (×2) et `secritou-og.png`. Le hero est un **mockup 100 % DOM/CSS** (`HeroDashboard.tsx`) — zéro poids image, excellent choix.
- Le logo est en PNG — négligeable (favicon + sidebar), WebP/AVIF sans enjeu ici.
- `loading="lazy"` présent sur le logo sidebar ; pas d'image sous la ligne de flottaison sur la home.
- ⚠️ Point de vigilance : rien ne contraint les futures images CMS (`SiteContent type IMAGE`) — prévoir un pipeline (resize + WebP) avant d'en accepter en prod.

**Verdict : non-problème aujourd'hui.**

---

## 4. Hero animé : rendu, CLS, reduced-motion

- **Animations** : uniquement `opacity` + `transform` (composited) → **aucun layout shift** causé par motion. ✓
- **Mais le H1 (élément LCP) démarre à `opacity: 0`** (`Hero.tsx:58-61`) : le LCP n'est comptabilisé que quand le texte devient visible → **+0,6 s de LCP auto-infligé**.
- **5 orbes décoratifs `blur-3xl` de 300–560 px** (`Hero.tsx:40-44`) : le blur gaussien sur de grandes surfaces coûte cher en rastérisation sur GPU mobile entrée de gamme (scroll janky). 2 orbes suffisent visuellement ; les autres peuvent être masqués en mobile (`hidden sm:block`).
- **`prefers-reduced-motion` : aucune prise en compte** (0 occurrence de `useReducedMotion`/`MotionConfig` dans src). Accessibilité + perf : à corriger globalement en une ligne (voir optimisation n°5).
- **CLS réel de la page** : les risques viennent (a) du swap des polices Google (Inter/Jakarta ont des métriques proches des fallbacks mais pas identiques), (b) du skeleton → contenu de `PacksSection` (hauteurs proches, décalage faible). **CLS estimé : 0,05–0,12** — sous le seuil de 0,1 si les polices sont maîtrisées, au-dessus sinon.

---

## 5. Polices

- **Source** : Google Fonts, CSS bloquant dans `index.html:39-42` — 2 familles × 4 graisses = **8 variantes déclarées** (~15–20 KB woff2 chacune, le navigateur en télécharge 4–6 selon les graisses réellement utilisées → **60–100 KB**).
- `display=swap` ✓, `preconnect` ×2 ✓.
- ⚠️ Chaîne critique : HTML → CSS Google (RTT supplémentaire vers fonts.googleapis.com) → woff2 (fonts.gstatic.com). Sur 4G avec latence tunisienne (~100–200 ms RTT), c'est **2 aller-retours avant le premier glyphe web font**.
- Pas de `<link rel="preload">` possible sur les woff2 Google (URLs versionnées) — argument de plus pour l'auto-hébergement (optimisation n°4).

---

## 6. Re-renders (app interne)

Globalement sain :
- `React.memo` sur les layouts, pages lourdes et composants de liste (AdminLayout, AnalyticsCharts, SettingsUsersTab…) ✓
- Zustand consommé via **sélecteurs** (`useAuthStore((s) => s.user)`) — pas de re-render global ✓
- `SettingsUsersTab` virtualise sa table (`@tanstack/react-virtual`) ✓
- `LandingCmsProvider` : valeur de contexte recréée à chaque render du provider, mais le provider ne re-rend que 2 fois (loading → data) — OK.
- Clés de listes : stables (ids) dans les pages vérifiées ; exception mineure : `SocialProof.tsx` et `HeroDashboard` utilisent l'index (`key={i}`) sur des listes statiques — sans conséquence.

Points d'attention :
- `NotificationBell` : `refetchInterval: 30000` → re-render du header toutes les 30 s même sans changement. Ajouter `select` + `structuralSharing` (par défaut) suffit à éviter le re-render quand la payload est identique ; c'est déjà le cas avec react-query si la réponse est stable. Coût réel faible.
- `DashboardPage` (~900 lignes) re-rend entièrement à chaque tick de `exec`/`analytics` — les sections sont dans le même composant. Découpage en sous-composants mémoïsés = gain réel seulement si des interactions locales (onglets) déclenchent des re-renders globaux, ce qui est le cas (state `activeTab` au niveau page).

---

## 7. Requêtes réseau

- **Défauts react-query bien réglés** (`queryClient.ts`) : `staleTime` 5 min, pas de refetch au focus/mount/reconnect ✓ — pas de tempête de requêtes dupliquées.
- **Dashboard admin** : 2 requêtes parallèles (`/analytics/executive` + `/analytics/summary`) — **pas de cascade** ✓ (le summary est différé par onglet).
- **Problèmes** :
  1. `POST /auth/refresh` systématique pour les visiteurs anonymes de la vitrine (§2) — requête inutile + 401 dans les logs.
  2. `LandingCmsProvider` fetch le CMS **hors react-query** (pas de cache mémoire entre navigations SPA internes — refetch à chaque montage du layout marketing ? Non : le provider est monté une fois au niveau du layout ✓, mais re-fetch complet à chaque changement de langue et aucune mise en cache HTTP côté client).
  3. `NotificationBell` : polling 30 s — remplaçable à terme par SSE, non bloquant.

---

## 8. Core Web Vitals estimés (home, mobile 4G ~1,5 Mbps / RTT 150 ms, CPU milieu de gamme)

| Métrique | Estimation | Cible | Détail |
|---|---|---|---|
| **LCP** (H1 hero) | **3,5–4,5 s** ❌ | < 2,5 s | HTML (0,4 s) → entry+vendor JS 250 KB (1,6 s) → parse/exec (0,5 s) → lazy HomePage+motion 70 KB (0,6 s incl. RTT) → render + **0,6 s d'animation opacity** |
| **CLS** | **0,05–0,12** ⚠️ | < 0,1 | swap polices Google + skeleton PacksSection ; aucune image sans dimensions |
| **INP** | **< 200 ms** ✓ | < 200 ms | vitrine peu interactive ; risque de jank au scroll (5 orbes blur) sans impact INP direct. App interne : OK (tables virtualisées, kanban dnd-kit isolé) |

⚠️ **Angle mort SEO structurel** : la vitrine est une SPA 100 % client-rendered — Googlebot rend le JS mais le HTML initial est vide (`<div id="root">`). Pour un site dont le SEO est critique, envisager un prerender statique des 7 routes publiques (`vite-plugin-prerender` ou migration des pages publiques vers Astro/SSG) — hors top 5 car effort M/L.

---

## Top 5 optimisations (impact/effort)

### 1. Sortir react-dom, les layouts internes et sonner du chunk d'entrée — **−90 à −110 KB gzip** (effort : S)

`vite.config.ts` — la forme objet de `manualChunks` rate `react-dom/client` ; passer en forme fonction :

```ts
build: {
  target: "es2022",
  cssCodeSplit: true,
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes("node_modules")) {
          if (/node_modules\/(react|react-dom|scheduler|react-router)/.test(id)) return "vendor";
          if (id.includes("node_modules/motion")) return "motion";
          if (id.includes("@dnd-kit")) return "dnd";
        }
      },
    },
  },
},
```

`AppRoutes.tsx` — lazy-loader les 3 layouts internes (ils sont déjà derrière `ProtectedRoute`, le fallback est invisible pour la vitrine) :

```tsx
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout").then(m => ({ default: m.AdminLayout })));
const ClientLayout = lazy(() => import("@/components/layout/ClientLayout").then(m => ({ default: m.ClientLayout })));
const FreelancerLayout = lazy(() => import("@/components/layout/FreelancerLayout").then(m => ({ default: m.FreelancerLayout })));
// AppLayout et les <Route element={...}> existants fonctionnent tels quels sous RouteBoundary/Suspense.
```

### 2. Charger une seule langue i18n au démarrage — **−20 à −25 KB gzip** (effort : S)

`i18n/index.ts` :

```ts
import resourcesToBackend from "i18next-resources-to-backend";

i18n
  .use(resourcesToBackend((lng: string) =>
    import(`./locales/${lng}/translation.json`)
  ))
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "fr",
    partialBundledLanguages: true,
    // ... options existantes, sans `resources`
  });
```

Vite transforme le template import en 2 chunks JSON — seul celui de la langue active est téléchargé.

### 3. Supprimer le `POST /auth/refresh` des visiteurs anonymes (effort : XS)

`useAuth.ts` — poser un marqueur au login, ne tenter le refresh que s'il existe :

```ts
// au login réussi :  localStorage.setItem("hasSession", "1");
// au logout :        localStorage.removeItem("hasSession");
const query = useQuery({
  queryKey: ["auth.bootstrap"],
  queryFn: () => authApi.refresh(),
  enabled: !bootstrapped && localStorage.getItem("hasSession") === "1",
  // ...
});
```

Un visiteur SEO/conversion n'émet plus aucune requête d'auth ; un utilisateur connu garde le refresh silencieux.

### 4. Auto-héberger les polices en variable fonts + preload — **LCP texte −300 à −500 ms, CLS stabilisé** (effort : S)

```bash
npm i @fontsource-variable/inter @fontsource-variable/plus-jakarta-sans
```

```ts
// main.tsx — remplace le <link> Google Fonts de index.html
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
```

2 fichiers woff2 variables (~35 KB + ~40 KB, toutes graisses incluses) servis sur le même domaine (0 RTT supplémentaire), `font-display: swap` par défaut. Supprimer les `<link>` fonts.googleapis de `index.html` et la directive `font-src` externe du CSP.

### 5. LCP instantané + reduced-motion global (effort : XS)

`Hero.tsx` — ne pas animer l'élément LCP :

```tsx
{/* H1 : rendu immédiat, sans opacity 0 */}
<h1 className="mt-4 font-display ...">
  {title0}<span>…</span>{title2}
</h1>
```

`main.tsx` — respecter les préférences système pour toutes les animations motion :

```tsx
import { MotionConfig } from "motion/react";
// ...
<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

Et alléger les orbes sur mobile (`Hero.tsx`) :

```tsx
<div aria-hidden className="hidden sm:block absolute -top-32 ... blur-3xl" />
{/* garder 2 orbes max en mobile */}
```

### Résultats mesurés après application (build du 2026-07-06)

| Chunk (gzip) | Avant | Après |
|---|---|---|
| Entrée `index-*.js` | 231,5 KB | **95,6 KB** (−59 %) |
| `vendor` (react + react-dom + router, cache long terme) | 17,7 KB (react-dom fuyait dans l'entrée) | 74,1 KB |
| `HomePage` | 27,6 KB | 18,6 KB |
| `MarketingLayout` (Header/Footer/CMS, lazy) | dans l'entrée | 3,5 KB |
| `motion` | 31,3 KB | 40,1 KB (a absorbé le runtime partagé) |
| `translation` EN (lazy, seulement pour les visiteurs EN) | dans l'entrée | 17,1 KB hors chemin critique |
| **Total premier chargement home** | **~315 KB** | **~238 KB** (−24 %) |
| **Premier chargement /app (hors home)** | ~250 KB | **~170 KB + chunk de page** |

Le budget de 200 KB n'est pas encore atteint : les ~38 KB restants sont le chunk `motion` (40 KB), payé uniquement pour les animations d'entrée du hero. Deux options pour finir le travail :
1. **`LazyMotion` + `domAnimation`** (~−20 KB) : remplacer `motion.div` par `m.div` sous `<LazyMotion features={domAnimation}>` dans les composants landing.
2. **Remplacer les animations d'entrée du hero par du CSS** (`@keyframes` + `animation-delay`) : motion sort entièrement du chemin critique de la home (−40 KB) → **~198 KB** ✓.

| Métrique estimée | Avant | Après |
|---|---|---|
| LCP 4G | 3,5–4,5 s | **~2,4–2,8 s** (H1 non animé, −0,6 s ; JS critique −77 KB ; fonts même origine) |
| CLS | 0,05–0,12 | **< 0,05** (fonts self-hosted avec fallbacks métriques proches) |

Autres changements appliqués en même temps :
- `POST /auth/refresh` supprimé pour les visiteurs anonymes (marqueur `hasSession` posé au login/register, retiré au logout — `useAuth.ts`).
- `prefers-reduced-motion` respecté sur tout le site vitrine (`MotionConfig reducedMotion="user"` dans `MarketingLayout`).
- 3 orbes blur sur 5 masqués en mobile (`hidden sm:block`, `Hero.tsx`).
- CSP nettoyé (plus de fonts.googleapis/gstatic).
- Note build : l'avertissement Vite « translation.json is dynamically imported but also statically imported » est **attendu** — le FR est volontairement bundlé statiquement (langue principale), seul l'EN est splitté.
- Vérification : `tsc --noEmit` propre ; build prod OK en 18 s.

---

## Annexe — reproduire l'analyse

```bash
cd client
ANALYZE=true npx vite build   # génère dist/stats.json (gzip par module)
```
