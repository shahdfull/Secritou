# Audit 08 — Responsive (mobile-first, trafic Facebook/Instagram/WhatsApp)

> Date : 2026-07-06 · Stack : React 19 + Vite + Tailwind v4 (CSS-first, pas de `tailwind.config.js`)
> Contexte : le trafic entrant sera majoritairement mobile via liens partagés sur réseaux sociaux — les démos internes n'ont montré que du desktop 1366px, donc le rendu mobile réel n'a jamais été validé visuellement.
> Méthode : lecture intégrale des composants landing + app interne + formulaires, pas de capture d'écran réelle (pas d'accès navigateur) — chaque constat s'appuie sur les classes Tailwind effectivement présentes dans le code, avec citation fichier:ligne.

---

## Bonne nouvelle en préambule : le menu mobile existe

Contrairement à l'hypothèse de départ ("le header ne peut pas tenir sur 360px, vérifier son absence comme CRITIQUE"), **un burger menu mobile fonctionnel existe déjà** dans `client/src/components/layout/Header.tsx` :
- Nav desktop masquée sous 768px (`hidden md:flex`, ligne 48), bouton burger visible uniquement sous 768px (`md:hidden`, ligne 97).
- Menu déroulant avec `role="dialog"`, `aria-modal`, fermeture au `Escape` et refocus sur le bouton (lignes 21-36, 107-114) — accessible.
- Contient les 4 liens de nav + lien `/login` + CTA + sélecteur FR/EN (lignes 116-163).

Ce n'est donc pas un point CRITIQUE mais un point **MOYEN** : le bouton burger lui-même fait 40×40px (`h-10 w-10`, ligne 97) — sous le seuil de 44px recommandé pour le tactile, à corriger facilement.

---

## CRITIQUE

### 1. Tableaux Invoices/Credit Notes : mauvaise classe sur le wrapper (risque de coins carrés, pas de blocage fonctionnel)

`client/src/features/invoices/InvoicesPage.tsx:159,271` : le wrapper externe utilise `overflow-hidden` au lieu de `overflow-x-auto`. **Bonne nouvelle après vérification du composant `Table` partagé** (`client/src/components/ui/table.tsx:7`) : celui-ci enveloppe déjà `<table>` dans `<div className="relative w-full overflow-auto">`, donc le scroll horizontal fonctionne réellement sur les 7 colonnes (Invoices) et 8 colonnes (Credit Notes) malgré le `overflow-hidden` du wrapper externe. **Reclassé de CRITIQUE à FAIBLE** — seul effet résiduel possible : le `overflow-hidden` externe peut couper un focus ring ou une ombre qui déborderait du rayon arrondi pendant le scroll interne. Aucun correctif obligatoire, mais remplacer par `overflow-x-auto` (en gardant `rounded-lg`) supprimerait toute ambiguïté :
```diff
- <div className="border rounded-lg overflow-hidden">
+ <div className="border rounded-lg overflow-x-auto">
```

### 2. `env(safe-area-inset-*)` totalement absent

Aucune occurrence dans tout le projet (`grep -rni "safe-area-inset\|env(safe-area"` = 0 résultat). Impact concret pour le trafic ciblé (utilisateurs iPhone avec notch/Dynamic Island, ouverture de liens depuis l'app Instagram/Facebook in-app browser) :
- Le header est `sticky top-0` (`Header.tsx:39`) et la topbar de l'app interne aussi (`AdminLayout.tsx:311`) — en mode paysage sur iPhone avec encoche, ces barres peuvent chevaucher la zone de l'encoche/Dynamic Island.
- Aucun padding de sécurité en bas d'écran (home indicator) pour les CTA fixes ou les drawers.

Correctif (à ajouter globalement, `styles.css` ou sur les éléments sticky concernés) :
```css
.sticky-header-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
```
Et dans `client/index.html`, s'assurer que le meta viewport autorise le contenu à s'étendre sous l'encoche :
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```
(actuellement `client/index.html:5` n'a pas `viewport-fit=cover` — sans lui, `env(safe-area-inset-*)` renvoie toujours `0px` et n'a aucun effet.)

---

## HAUTE

### 3. `h-screen`/`min-h-screen`/`vh` classique partout, jamais `dvh` — comportement instable avec la barre d'adresse mobile

Aucun usage de `100dvh`/`svh`/`lvh` trouvé nulle part dans le projet. Tous les layouts utilisent les unités classiques, sensibles au redimensionnement de la barre d'adresse Safari/Chrome mobile lors du scroll :

| Fichier:ligne | Classe | Risque |
|---|---|---|
| `AdminLayout.tsx:177` | `h-screen` | Hauteur figée au premier calcul ; si la barre d'adresse se réduit après scroll, une bande vide apparaît en bas, ou l'inverse (contenu tronqué à l'ouverture) |
| `ClientLayout.tsx:106` | `h-screen` | Idem |
| `FreelancerLayout.tsx:72` | `h-screen` | Idem |
| `MarketingLayout.tsx:20` | `min-h-screen` | Moins grave (`min-`, pas de troncature), mais peut laisser un saut de layout visible au chargement |
| `GlobalErrorBoundary.tsx:31` | `min-h-screen` | Idem |
| `ProtectedRoute.tsx:31` | `min-h-screen` | Idem (écran de chargement du bootstrap auth) |
| `LoginPage.tsx:39` | `min-h-[72vh]` | Idem |
| `AIAssistantPage.tsx:191` | `h-[calc(100vh-8rem)]` | Le plus à risque : hauteur calculée en dur, un chat qui recalcule sa zone de scroll interne peut se retrouver avec une zone invisible ou un input caché sous le clavier virtuel |

Correctif recommandé (support large, Safari iOS 15.4+/Chrome 108+, avec repli) :
```diff
- <div className="flex h-screen w-full overflow-hidden bg-background">
+ <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-background">
```
(Tailwind v4 n'a pas d'utilitaire `dvh` par défaut — utiliser une classe arbitraire `h-[100dvh]` après le fallback `h-screen`, ou ajouter un token `--height-screen-safe: 100dvh` dans `styles.css` et l'utiliser via `h-(--height-screen-safe)`.)

Le cas `AIAssistantPage.tsx:191` mérite une correction prioritaire distincte car un chat avec clavier virtuel ouvert est un scénario mobile très fréquent (interface conversationnelle) :
```diff
- className="h-[calc(100vh-8rem)]"
+ className="h-[calc(100dvh-8rem)]"
```

### 4. Champ téléphone en `type="text"` partout — pas de clavier numérique mobile

Confirmé dans les deux formulaires publics :
- `ContactPage.tsx:158-161` (composant `Field` sans prop `type`, défaut `type="text"` ligne 358)
- `JoinUsPage.tsx:185-197` (`<Input {...field} />` sans prop `type`)

Sur mobile, taper un numéro de téléphone tunisien sur un clavier alphabétique complet est significativement plus lent et source d'erreurs de saisie — un point de friction direct sur le canal d'acquisition principal (formulaire de contact venant de réseaux sociaux mobiles).

Correctif :
```diff
- <Field label={t("contact.phone")} registration={register("phone")} error={errors.phone?.message} />
+ <Field label={t("contact.phone")} type="tel" registration={register("phone")} error={errors.phone?.message} />
```
```diff
- <Input {...field} />
+ <Input type="tel" inputMode="tel" {...field} />
```

### 5. Zones tactiles sous 44px : boutons et inputs shadcn par défaut

Le design system partagé n'atteint jamais 44px sans classe locale surchargée :

| Composant | Fichier:ligne | Taille | Écart |
|---|---|---|---|
| `Button` (`default`) | `button.tsx:21` | `h-9` = 36px | -8px |
| `Button` (`sm`) | `button.tsx:23` | `h-8` = 32px | -12px |
| `Button` (`lg`) | `button.tsx:24` | `h-10` = 40px | -4px |
| `Button` (`icon`) | `button.tsx:25` | `h-9 w-9` = 36×36px | -8px |
| `Input` | `input.tsx:11` | `h-9` = 36px | -8px |
| Bouton burger header | `Header.tsx:97` | `h-10 w-10` = 40px | -4px |
| Bouton suppression fichier (FileUploadField) | `FileUploadField.tsx:154` | `h-7 w-7` = 28px | -16px |
| Icônes réseaux sociaux (Footer) | `Footer.tsx:65` | `h-10 w-10` = 40px | -4px |

Ces composants sont utilisés massivement dans `LoginPage.tsx`, `JoinUsPage.tsx` et l'app interne — donc l'essentiel des boutons/inputs de l'app est légèrement sous le seuil WCAG 2.5.5/Material Design de 44-48px. Sur mobile, ça se traduit par des mis-taps fréquents, en particulier sur le bouton de suppression de fichier (28px, le plus petit relevé).

Correctif minimal (relever la taille par défaut du composant partagé, impact global immédiat) :
```diff
// button.tsx
- default: "h-9 px-4 py-2",
+ default: "h-11 px-4 py-2",
```
```diff
// input.tsx
- "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base ... md:text-sm"
+ "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base ... md:text-sm"
```
Pour le bouton de suppression de fichier spécifiquement :
```diff
- <Button ... className="shrink-0 h-7 w-7" onClick={handleRemove}>
+ <Button ... className="shrink-0 h-11 w-11" onClick={handleRemove}>
```

### 6. Zoom automatique iOS Safari sur les champs `ContactPage` (text-sm = 14px)

Les champs custom de `ContactPage.tsx` (composant `Field` local, `<select>` serviceType/budget, `<textarea>` message) utilisent `text-sm` (14px) sans variante mobile à 16px : lignes 382 (`Field`), 172 et 203 (les deux `<select>`), 230 (`<textarea>`). iOS Safari zoome automatiquement la page au focus sur tout champ dont la taille de police calculée est inférieure à 16px — sur le formulaire de contact, ce zoom intempestif casse l'expérience de saisie (l'utilisateur doit dézoomer manuellement pour voir le reste du formulaire).

Par contraste, le composant `Input` partagé (utilisé dans `JoinUsPage`/`LoginPage`) a déjà le bon pattern : `text-base ... md:text-sm` (`input.tsx:11`, 16px sous 768px, 14px au-dessus) — donc **seul `ContactPage.tsx` est concerné**, précisément le formulaire le plus exposé au trafic mobile entrant.

Correctif (appliquer le même pattern mobile-first que `input.tsx`) :
```diff
// ContactPage.tsx:382 (Field), 172/203 (select), 230 (textarea)
- className="... text-sm ..."
+ className="... text-base md:text-sm ..."
```

---

## MOYENNE

### 7. `HowItWorks` (steps 01-04) : saut direct 1→4 colonnes sans palier tablette

`client/src/features/landing/components/HowItWorks.tsx:43` : `grid gap-8 lg:grid-cols-4 lg:gap-6` — empilé en 1 colonne de 0 à 1023px (mobile ET tablette portrait/paysage confondues), puis 4 colonnes d'un coup à partir de 1024px. Sur iPad portrait (768-1023px), les 4 étapes s'empilent verticalement au lieu d'occuper l'espace disponible en 2×2 — la page devient nécessairement plus longue que nécessaire à ce gabarit, sans casser fonctionnellement rien.

Correctif (ajouter un palier intermédiaire) :
```diff
- <div className="grid gap-8 lg:grid-cols-4 lg:gap-6">
+ <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
```

### 8. Flèches du carrousel témoignages invisibles jusqu'à 1024px

`client/src/features/landing/components/SocialProof.tsx:155,163` : `hidden ... lg:flex` — sur mobile ET tablette (jusqu'à 1023px), seuls les dots de pagination et le swipe tactile natif d'Embla permettent de naviguer. C'est un choix défendable (les flèches n'ont de sens qu'au clavier/souris), mais mérite d'être confirmé intentionnel : sur une tablette avec souris/trackpad externe (iPad + Magic Keyboard, de plus en plus courant), l'utilisateur n'a alors aucun moyen visuel de naviguer autrement qu'au swipe.

Pas de correctif obligatoire — à valider en test manuel (voir liste finale) plutôt qu'à corriger aveuglément.

### 9. `JoinUsPage` prénom/nom : grille 2 colonnes fixe sans repli mobile

`client/src/features/landing/pages/JoinUsPage.tsx:144` : `grid grid-cols-2 gap-4` — contrairement à `ContactPage.tsx` qui utilise systématiquement `sm:grid-cols-2` (1 colonne sous 640px), ce grid reste à 2 colonnes fixes même sur les plus petits écrans (360px, 390px). Sur un iPhone SE (375px) ou plus petit, deux champs "Prénom"/"Nom" côte à côte avec leurs labels peuvent devenir visuellement serrés, sans casser le layout (les champs `Input` restent utilisables) mais avec un confort de lecture/frappe dégradé.

Correctif :
```diff
- <div className="grid grid-cols-2 gap-4">
+ <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

---

## FAIBLE

### 10. Icônes de logo (`<img>`) sans `srcset`/`sizes` — impact négligeable

Aucune image ne dépasse 44px (logo répété 5 fois : `AdminLayout.tsx:182`, `ClientLayout.tsx:111`, `Footer.tsx:54`, `FreelancerLayout.tsx:76`, `Header.tsx:42`, tailles `h-7`/`h-9`/`h-11`). Le mockup du Hero (le seul candidat plausible à un "mockup dashboard lourd" mentionné dans la demande) **n'est pas une image bitmap** — `client/src/components/dashboard/HeroDashboard.tsx` est du HTML/CSS/SVG pur, avec ses propres classes responsive (`sm:block`, `sm:col-span-8`, `sm:p-5`, lignes 18/30/47/77). Aucun octet d'image n'est donc téléchargé pour le hero, ce qui est le meilleur scénario possible pour de la 4G — pas de correctif nécessaire ici, contrairement à l'hypothèse de la demande initiale.

### 11. Icônes réseaux sociaux Footer légèrement sous 44px

`Footer.tsx:65` : `h-10 w-10` (40px) — écart mineur de 4px, cohérent avec le reste des boutons `lg`/icon du design system (voir point 5). Corrigible dans la même passe que le composant `Button` partagé si celui-ci est réutilisé ici.

---

## Tableau des breakpoints effectifs (Tailwind v4, aucun custom)

| Nom | Valeur | Défini où |
|---|---|---|
| (base, mobile) | 0px | — |
| `sm` | 640px | Défaut Tailwind v4, non surchargé |
| `md` | 768px | Défaut Tailwind v4, non surchargé |
| `lg` | 1024px | Défaut Tailwind v4, non surchargé |
| `xl` | 1280px | Défaut Tailwind v4, non surchargé |
| `2xl` | 1536px | Défaut Tailwind v4, non surchargé |

Config : `client/src/styles.css` (CSS-first Tailwind v4, `@theme inline` lignes 5-46) — aucun fichier `tailwind.config.*` dans le repo, aucune variable `--breakpoint-*` déclarée. Le seul utilitaire custom est `container-page` (`styles.css:154-162`, max-width 80rem, padding 1.25rem → 2rem à partir de `md`).

### Composants vérifiés avec repli mobile-first correct (pas de correctif nécessaire)

- **Hero** (`Hero.tsx`) : `lg:grid-cols-[1fr_1.1fr]`, titre en 3 paliers de taille, orbes décoratifs masqués sous `sm`.
- **Services / 4 pôles** (`Services.tsx:80`) : `grid-cols-1 md:grid-cols-2` (jamais 4 colonnes par design, 2×2 sur desktop).
- **FAQ** (`FAQ.tsx:45`) : `lg:grid-cols-[1fr_1.4fr]`, empilé jusqu'à 1024px.
- **Footer** (`Footer.tsx:51,74`) : `lg:grid-cols-[1.4fr_2.6fr]` pour le bloc logo/liens, `grid-cols-2 sm:grid-cols-4` pour les 4 colonnes de liens (2×2 dès le mobile).
- **Header burger menu** : fonctionnel, accessible, testé plus haut.
- **Sidebar app interne** (`AdminLayout.tsx` + `ui/sidebar.tsx:69,189-208`) : bascule en `Sheet` (drawer Radix) sur mobile via `useIsMobile()`, largeur `18rem`, déclencheur `SidebarTrigger` visible sous `md`.
- **Health Board** (`HealthBoardTab.tsx:55`) : wrapper `overflow-x-auto` explicite sur les 8 colonnes.
- **KPI cards dashboard** (`DashboardPage.tsx`, plusieurs lignes) : toutes les grilles passent par `grid-cols-1` puis `md:`/`lg:`, aucune fixée en 3-4 colonnes sans repli.
- **Filtres Invoices** (`InvoicesPage.tsx:131`) : `flex-col sm:flex-row`.
- **Meta viewport** : présent (`index.html:5`), sans blocage du zoom utilisateur (bon point a11y) — à compléter avec `viewport-fit=cover` (voir point 2).

---

## Liste des correctifs par priorité (résumé actionnable)

| # | Sévérité | Fichier:ligne | Correctif |
|---|----------|----------------|-----------|
| 1 | Faible (reclassé) | `InvoicesPage.tsx:159,271` | `overflow-hidden` → `overflow-x-auto` (cosmétique, le scroll fonctionne déjà via `ui/table.tsx`) |
| 2 | Haute | `index.html:5` + `styles.css` | `viewport-fit=cover` + `env(safe-area-inset-*)` sur les éléments sticky/fixed |
| 3 | Haute | `AdminLayout.tsx:177`, `ClientLayout.tsx:106`, `FreelancerLayout.tsx:72`, `AIAssistantPage.tsx:191` | `h-screen`/`100vh` → `h-[100dvh]` (priorité absolue sur `AIAssistantPage`, clavier virtuel + chat) |
| 4 | Haute | `ContactPage.tsx:158`, `JoinUsPage.tsx:185-197` | `type="text"` → `type="tel"` + `inputMode="tel"` |
| 5 | Haute | `button.tsx:21`, `input.tsx:11`, `FileUploadField.tsx:154` | Relever `h-9`/`h-7` → `h-11` (44px) |
| 6 | Haute | `ContactPage.tsx:172,203,230,382` | `text-sm` → `text-base md:text-sm` (anti-zoom iOS) |
| 7 | Moyenne | `HowItWorks.tsx:43` | Ajouter palier `sm:grid-cols-2` avant `lg:grid-cols-4` |
| 8 | Moyenne | `SocialProof.tsx:155,163` | À valider en test manuel plutôt qu'à corriger aveuglément |
| 9 | Moyenne | `JoinUsPage.tsx:144` | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| 10-11 | Faible | `Footer.tsx:65` | Cohérent avec le point 5, corrigible dans la même passe |

---

## 10 vérifications manuelles à faire sur un vrai téléphone avant lancement

1. **Ouvrir le lien de la landing page depuis l'app Instagram/Facebook in-app browser** (pas Safari/Chrome direct) sur un iPhone récent avec Dynamic Island, en mode portrait puis paysage — vérifier que le header sticky ne chevauche jamais l'encoche/Dynamic Island.
2. **Sur le Hero**, vérifier au chargement puis après un scroll bas-haut que la hauteur ne "saute" pas quand la barre d'adresse Safari se rétracte/réapparaît (aucun contenu ne doit se retrouver caché puis révélé).
3. **Ouvrir le menu burger, naviguer vers chaque lien, revenir en arrière** — confirmer que le menu se ferme bien à chaque navigation et que le focus revient sur le bouton burger après un `Escape`.
4. **Remplir le formulaire de contact en entier au clavier tactile** : confirmer que le champ téléphone ouvre bien un clavier numérique (ou signaler que non, si le correctif n'a pas encore été appliqué), et qu'aucun champ ne déclenche de zoom automatique au focus.
5. **Tester l'upload de CV/portfolio sur `/rejoindre` depuis la galerie photo ET depuis l'appareil photo direct** (deux flux différents sur iOS/Android) — vérifier que la zone de dépôt reste utilisable au doigt et que le bouton de suppression du fichier (petit, 28px) est atteignable sans mis-tap sur un élément voisin.
6. **Ouvrir l'assistant IA (`/app/ai` ou équivalent) avec le clavier virtuel ouvert** — vérifier que le champ de saisie et le dernier message restent visibles au-dessus du clavier (c'est le point le plus à risque identifié, `AIAssistantPage.tsx:191`).
7. **Sur le dashboard admin/manager, ouvrir la sidebar via le drawer mobile, sélectionner une page, puis rouvrir la sidebar** — confirmer l'absence de lag ou de double-scroll (page + drawer) et que le drawer se ferme bien après sélection.
8. **Faire défiler horizontalement les tableaux Invoices et Health Board avec le doigt** — confirmer que le scroll est fluide et que les colonnes fixes (statut, actions) restent lisibles, pas de contenu tronqué sans indice visuel qu'il y a plus à voir.
9. **Faire pivoter l'écran (portrait → paysage) sur chaque flux critique** (contact, login, dashboard) — vérifier qu'aucun contenu ne devient inaccessible en hauteur réduite (paysage mobile = très peu de hauteur disponible, notamment avec le clavier ouvert sur login).
10. **Tester le carrousel témoignages au swipe sur mobile ET sur une tablette avec trackpad/souris externe** (iPad + Magic Keyboard/souris Bluetooth) — confirmer qu'il existe un moyen de naviguer autre que le swipe pur (dots suffisants ? flèches à réactiver en dessous de `lg` sur tablette avec pointeur ?).
