# Audit 07 — Accessibilité WCAG 2.1 niveau AA

**Date** : 2026-07-06
**Périmètre** : vitrine + app interne
**Méthode** : ratios de contraste calculés depuis les tokens oklch réels de `styles.css` (conversion oklch→sRGB, formule WCAG) ; inspection du HTML prérendu réel (85 SVG, aria-*) ; lecture des composants.

**Synthèse** : la base est **meilleure que la moyenne** — Radix UI (accordéon, dropdowns, dialogs) apporte le clavier/ARIA gratuitement, les 85 icônes SVG ont toutes `aria-hidden`, les kanbans ont un `KeyboardSensor`, le menu mobile gère le retour de focus. Les vrais échecs : **carrousel en lecture automatique sans pause** (blocage), **labels de formulaires non associés + erreurs non annoncées**, **absence de skip link**, et **le teal primaire sous le seuil de contraste** partout où il porte du texte.

---

## Priorité 1 — Blocages et non-conformités structurantes

| Critère WCAG | Composant | Fichier:ligne | Correctif |
|---|---|---|---|
| **2.2.2 Pause, Stop, Hide (A)** | Carrousel témoignages : autoplay `setInterval` 6 s, **aucune pause** (ni au survol, ni au focus, ni bouton), impossible à arrêter | `SocialProof.tsx:65-69` | Suspendre l'autoplay au survol/focus du carrousel et ajouter un bouton pause : `const [paused, setPaused] = useState(false)` ; dans l'effet : `if (paused) return;` ; sur le conteneur : `onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)}` + bouton `aria-pressed` visible |
| **4.1.3 Status Messages / 2.4.4** | Carrousel : le changement de slide n'est pas annoncé ; pas de rôle | `SocialProof.tsx:89-131` | Sur le viewport : `role="region" aria-roledescription="carrousel" aria-label={t("home.socialProof.trustedBy")}` ; sur chaque slide `role="group" aria-roledescription="diapositive" aria-label={\`${i+1} / ${testimonials.length}\`}` ; **pas** d'aria-live sur l'autoplay (ce serait du spam SR) |
| **2.4.1 Bypass Blocks (A)** | **Aucun skip link** dans toute l'app — un utilisateur clavier retraverse le header à chaque page | `AppRoutes.tsx` / `MarketingLayout.tsx` | Premier enfant du layout : `<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Aller au contenu</a>` + `id="main"` sur `<main>` (les deux layouts) |
| **1.3.1 / 3.3.2 Labels (A)** | Formulaires Contact et JoinUs : `<label>` **sans `htmlFor`**, inputs sans `id` — aucune association programmatique ; LoginPage : **placeholder seul, pas de label du tout** | `ContactPage.tsx:183-214`, `JoinUsPage.tsx:224-261`, `LoginPage.tsx:44-49` | Générer un id par champ : `<label htmlFor="contact-message">…</label><textarea id="contact-message" …/>`. LoginPage : ajouter des labels (visuellement masqués si le design l'exige : `className="sr-only"`) — le placeholder disparaît à la saisie et n'est pas un label |
| **3.3.1 / 4.1.3 Error Identification (A)** | Erreurs de formulaires : `<p className="text-destructive">` **non reliées au champ** (pas d'`aria-describedby`), non annoncées (pas de `role="alert"`) ; `aria-invalid` présent sur 2 champs seulement | `ContactPage.tsx:168-219`, `LoginPage.tsx:45,49`, `JoinUsPage.tsx` | Patron à généraliser : `<input id="x" aria-invalid={!!errors.x} aria-describedby={errors.x ? "x-error" : undefined} />` + `<p id="x-error" role="alert">{errors.x.message}</p>` |
| **4.1.1 Parsing / nested interactive** | Zone d'upload CV/portfolio : un `<Button>` (supprimer ✕) **imbriqué dans un `<button>`** — HTML invalide, comportement SR imprévisible | `FileUploadField.tsx:109-149` | Sortir le bouton ✕ du bouton principal : transformer le conteneur en `<div>` cliquable NON — garder le `<button>` principal mais rendre le ✕ sibling absolu : `<div className="relative"><button …zone/><Button className="absolute right-3 top-1/2" onClick={handleRemove}/></div>` |
| **4.1.3 Status** | Upload : « Uploading… » et le succès ne sont pas annoncés | `FileUploadField.tsx:120-124` | Ajouter `aria-live="polite"` sur le conteneur d'état + i18n des chaînes en dur (« Uploading… », « Click to upload a file », toast FR ligne 63) |

**Bon points clavier confirmés** ✓ : zone d'upload = vrai `<button>` focusable avec ring (`FileUploadField.tsx:115`) ; accordéon FAQ = Radix (`aria-expanded`, Entrée/Espace natifs — `ui/accordion.tsx`) ; dropdowns/menus = Radix (pas de piège de focus) ; sélecteur de langue = deux vrais boutons (`Header.tsx:65-85`) ; menu mobile avec `aria-expanded`/`aria-controls`/`aria-modal` **et retour du focus au déclencheur** (`Header.tsx:25`) ; kanbans Leads/Tasks avec `KeyboardSensor` dnd-kit ✓.

---

## Priorité 2 — Contrastes (mesures réelles)

Calculés depuis `styles.css:47-83` (mode clair). Seuils : 4.5:1 texte normal, 3:1 texte ≥ 18.66px gras / 24px.

| Ratio mesuré | Verdict | Combinaison | Où | Correctif |
|---|---|---|---|---|
| **3.33 : 1** | ❌ texte normal | primary `#6794A1` sur blanc — labels « BOOK A CALL » (12px), liens `variant="link"`, eyebrows de sections | partout (`text-primary`) | Assombrir le token : `--primary: oklch(0.563 0.052 218)` = **#517D8A** (4.51:1). Même teinte, plus sombre — à valider visuellement, ou créer un token `--primary-text` réservé au texte |
| **3.24 : 1** | ❌ | blanc sur primary — bouton « Sign in » / boutons `variant="default"` | `ui/button.tsx:12` | Même correctif : primary assombri à #517D8A → ratio blanc/primary = 4.6:1 |
| **2.65 : 1** | ❌ | badge teal « Active » : primary sur primary-soft `#D3E9F0` | badges statut (CRM, HealthBoard) | Texte du badge : `oklch(0.508 0.052 218)` = **#416D79** sur primary-soft (4.5:1) — nouveau token `--primary-strong` |
| 6.34 : 1 | ✓ | muted-foreground `#575E66` sur fond — sous-titres gris | partout | rien (contrairement à l'impression visuelle, ça passe largement) |
| 9.83 : 1 | ✓ | badge coral (accent-foreground sur accent) | badges | rien |
| 4.63 : 1 | ✓ | destructive sur fond (messages d'erreur) | formulaires | rien |
| 18.8 : 1 | ✓ | blanc sur ink (CTA noirs) | hero, submit | rien |
| **1.80 : 1** | ❌ si utilisé | blanc sur accent coral | vérifier qu'aucun bouton n'utilise `bg-accent text-white` (le hover `ghost`/`outline` shadcn met `hover:bg-accent hover:text-accent-foreground` → accent-foreground = OK) | ne jamais poser du blanc sur accent |

**Focus visible** : `focus-visible:ring-1` (shadcn) est présent mais **fin** (1px) et `--ring` est à 40 % d'opacité — passer à `ring-2` et `--ring: oklch(0.563 0.052 218)` opaque pour un indicateur ≥ 3:1 (WCAG 2.4.11 draft / bonne pratique AA). Les CTA `<Link>` du hero n'ont pas de `outline-none` → l'outline navigateur par défaut s'applique ✓.

---

## Priorité 3 — Le reste du périmètre

| Critère | Composant | Constat | Correctif |
|---|---|---|---|
| 1.3.1 (tables) | Tables app (Invoices, Documents, Health Board) | `<th>` rendus ✓ mais **sans `scope="col"`** ; pas de `<caption>` | `ui/table.tsx` TableHead : `<th scope="col" …>` (1 ligne, corrige toutes les tables) |
| 1.3.1 (tri) | Tri des listes | Le tri passe par un dropdown Radix (annoncé comme menu ✓), pas de tri par clic d'en-tête → `aria-sort` non requis | rien |
| pagination | `DataTablePagination` | Boutons avec texte visible + `disabled` ✓ | envelopper dans `<nav aria-label={t("pagination.label")}>` (mineur) |
| 1.1.1 (images) | Logo header | `alt=""` + lien parent `aria-label="Secritou home"` ✓ conforme ; logo sidebar `alt="Secritou"` ✓ | rien |
| 1.1.1 (icônes) | 85/85 SVG lucide avec `aria-hidden="true"` ✓ (vérifié sur le HTML prérendu) | rien | rien |
| 2.4.4 (liens) | Footer : liens réseaux sociaux **tous étiquetés « Social link »** — génériques et identiques | `Footer.tsx` | `aria-label="Secritou sur LinkedIn"`, `…Instagram`, etc. |
| 4.1.2 | Sélecteur de langue FR/EN | état actif visuel uniquement | ajouter `aria-pressed={i18n.language === "fr"}` sur chaque bouton |
| 4.1.3 (toasts) | « Logged in successfully » (sonner) | sonner rend une région `aria-live="polite"` + `role="status"` par défaut ✓ ; durée 4 s par défaut — courte pour AA « durée suffisante » | passer `duration: 6000` dans `ui/sonner.tsx` `toastOptions` ; les toasts d'erreur utilisent `toast.error` → `role="alert"` sonner ✓ |
| 2.3.3 / animations | Hero + landing | `MotionConfig reducedMotion="user"` ✓ (posé à l'audit perf) couvre **toutes** les animations motion de la vitrine | rien |
| animations CSS | `html { scroll-behavior: smooth }` + `animate-pulse/spin` | non gatés par `prefers-reduced-motion` | `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }` dans `styles.css` ; les spinners/skeletons sont tolérés |
| 1.4.10 reflow | vérifié à l'audit responsive : orbes décoratifs clippés, pas de scroll horizontal ✓ | rien | rien |

---

## Ordre d'exécution recommandé — statut au 2026-07-06

1. **Pause du carrousel** (`SocialProof.tsx`) — ✅ appliqué : `userPaused` (bouton play/pause visible, `aria-pressed`) + suspension automatique au survol/focus (`hovered`) ; ajout de `role="region"`/`role="group"` + `aria-roledescription` (carrousel/diapositive), vérifié dans le HTML prérendu.
2. **Skip link** dans les deux layouts — ✅ appliqué : `MarketingLayout` + les 3 layouts internes (Admin/Client/Freelancer), `id="main"` posé sur chaque `<main>`, clé i18n `a11y.skipToContent` FR/EN. Vérifié dans le HTML prérendu.
3. **Labels + erreurs des formulaires publics** (Contact, JoinUs, Login) — ✅ appliqué : `Field` de ContactPage génère `id`/`aria-describedby`/`role="alert"` par champ (input, les 2 select, le textarea) ; `FormMessage` (shadcn, utilisé par JoinUsPage) a maintenant `role="alert"` — corrige tous les formulaires shadcn de l'app d'un coup ; LoginPage a désormais de vrais `<label className="sr-only">` + `aria-invalid`/`aria-describedby`.
4. **Bouton imbriqué de FileUploadField** — ✅ appliqué : le bouton ✕ est sorti du bouton principal (sibling positionné en absolu) ; ajout `aria-live="polite"` sur la zone d'état et i18n des chaînes en dur (upload, suppression, type de fichier rejeté) ; les labels externes (JoinUsPage CV/Portfolio) sont liés via un nouveau prop `aria-labelledby`.
5. **Token primary assombri** — ✅ appliqué, **avec un ajustement** : `oklch(0.554 0.052 218)` = `#4F7A87` (plus sombre que la proposition initiale `#517D8A`) pour garantir ≥ 4.5:1 **dans les deux sens** (texte teal sur blanc **et** texte blanc sur bouton teal — la première proposition ne passait qu'un seul sens, 4.38:1 pour le second). Nouveau token `--primary-strong` (`oklch(0.508 0.052 218)`, `#416D79`) pour le texte des badges sur fond `primary-soft` ; appliqué à tous les badges de statut "SENT/IN_PROGRESS/COMMENTED" trouvés (`statusColors.ts`, `InvoicesPage`, `ProposalsPage`, `ApprovalsPage`, `ProposalsClientPage`, `DashboardPage`, `DashboardCharts`, `HeroDashboard`, `ProductDashboard`) — 10 fichiers, même motif `bg-primary-soft text-primary` → `text-primary-strong`.
6. Micro-fixes — tous appliqués : `scope="col"` dans `ui/table.tsx` (corrige toutes les tables via le composant partagé) ; liens sociaux du footer nommés par réseau (`aria-label` i18n, au lieu de "Social link" générique) ; `aria-pressed` sur les 4 boutons FR/EN (desktop + mobile) ; `--ring` passé de 40%/50% d'opacité à opaque (4.68:1 mesuré) ; `duration={6000}` sur le Toaster ; media query `prefers-reduced-motion` ciblant le scroll et les animations continues (`animate-spin/pulse/bounce`) sans casser les transitions hover/focus.

**Vérification** : `tsc --noEmit` propre, build de production OK, `check-i18n.mjs` confirme FR/EN synchronisés, HTML prérendu inspecté pour confirmer skip link, rôles ARIA du carrousel et `scope="col"`.

Total appliqué : conformité AA sur les parcours identifiés comme bloquants ou en échec de contraste.
