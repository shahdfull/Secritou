# Audit 09 — Qualité de code (revue lead-dev)

**Date** : 2026-07-06
**Périmètre** : monorepo complet (`client`, `server`, `shared`), npm workspaces
**Méthode** : 8 explorations parallèles + vérifications ciblées (lint réel, tests réels, tsc réel)

**Verdict global** : la base est **structurellement saine** — 100% TypeScript strict, 0 `@ts-ignore`, 0 `console.log` de debug oublié, 0 `TODO`/`FIXME` fantôme, 0 secret commité, aucune fuite de nommage français dans les variables/fonctions. Les vrais problèmes sont ailleurs : **duplication massive de composants** (le dossier `shared/crud` existe mais n'est utilisé nulle part), **deux caches de données divergents pour les factures** (cause confirmée de l'incohérence dashboard/invoices documentée dans l'audit 04), un **test de facturation qui ne teste pas le vrai fichier source**, et **zéro CI**.

---

## Légende de priorité

- 🔴 **Avant lancement** — bloquant ou risque direct pour l'utilisateur/les données
- 🟡 **Premier mois** — dette qui coûtera cher à ignorer plus longtemps
- ⚪ **Plus tard** — confort, cohérence, à planifier sans urgence

---

## 1. Structure : fichiers volumineux et duplication

### Fichiers à découper (> 300 lignes, top 10)

| Lignes | Fichier | Constat |
|---|---|---|
| 932 | `client/src/features/service-requests/ServiceRequestsAdminPage.tsx` | Hooks data + état local + tout le JSX (Sheet/Dialog/Table) dans un seul composant |
| 924 | `client/src/features/dashboard/DashboardPage.tsx` | Fonction pure `calculateGrowth` (L.99-106) mélangée à 3+ implémentations de cards |
| 809 | `client/src/features/clients/ClientDetailPage.tsx` | Appels `apiClient` bruts + `useQuery`/`useMutation` directement dans la page |
| 755 | `client/src/features/leads/LeadsPage.tsx` | Table + formulaire + validation Zod, tout inline |
| 744 | `client/src/components/ui/sidebar.tsx` | (primitive UI shadcn, pas de métier — pas prioritaire) |
| 659 | `server/src/services/emailTemplates/index.ts` | Templates HTML en dur dans le service |
| 640 | `client/src/features/applications/ApplicationsPage.tsx` | — |
| 617 | `client/src/features/settings/tabs/SettingsUsersTab.tsx` | — |
| 611 | `client/src/features/projects/ProjectsPage.tsx` | — |
| 524 | `server/src/repositories/executiveMetrics.repository.ts` | Gros mais cohérent (un seul domaine : calculs KPI) — voir §7 tests |

**35 fichiers** au total dépassent 300 lignes dans `client/src` + `server/src`.

**Priorité** : 🟡 découper les 4 pages CRUD les plus grosses (ServiceRequestsAdminPage, DashboardPage, ClientDetailPage, LeadsPage) — **12h** (3h/fichier : extraire hooks de fetch + sous-composants de présentation).

### Duplication confirmée — le vrai problème structurel

**a) Cards des 4 pôles de service** — 3 implémentations indépendantes, aucune factorisée :
- `Services.tsx:12-57` (tableau `services`, rendu `motion.button`)
- `ServicesPage.tsx:9-38` (`getServices(t)`, redéfinit les mêmes 4 services avec JSX différent)
- `SolutionsPage.tsx:9-43` (3ᵉ pattern, données différentes)

Risque réel : les traductions `home.services.items.X` et `services.xxx.title` peuvent diverger silencieusement — c'est déjà arrivé (`PacksSection` appelait `packs.*` au lieu de `home.packs.*`, corrigé lors de l'audit i18n).

**b) KPI cards** — `KPICard` existe et est bien conçu (`DashboardPage.tsx:138-183`, props propres), mais :
- **N'est même pas réutilisé dans son propre fichier** : l'onglet "Trends" du même `DashboardPage.tsx` (L.828-857) réécrit à la main un JSX quasi identique.
- `FreelancerDashboardPage.tsx:61-71,222-279` : 5 blocs `<Card>` copiés-collés, aucune fonction.

**c) Tableaux de données** — **`client/src/components/shared/crud/EntityTable.tsx` existe mais n'est importé nulle part** (confirmé par grep exhaustif). Chaque page (Invoices, Documents, Proposals, Approvals, Leads) réimplémente sa propre paire `Table/TableHeader/TableBody/TableRow`. Seul `DataTablePagination` est réellement partagé (8 pages).

**Priorité** :
- 🟡 Factoriser un `ServiceCard` unique consommé par Services.tsx + ServicesPage.tsx (SolutionsPage a des données différentes, à garder séparé) — **4h**
- 🟡 Faire adopter `KPICard` partout où le motif existe (DashboardPage onglet Trends, FreelancerDashboardPage) — **4h**
- ⚪ Soit finir `EntityTable` et migrer les 5 pages, soit **le supprimer** s'il n'est pas viable (ne pas laisser du code mort ambigu) — **8h pour migrer, ou 15 min pour supprimer**

---

## 2. Typage TypeScript

**100% TypeScript**, aucun fichier `.js`/`.jsx` métier. `strict: true` actif dans `client/tsconfig.json` et `server/tsconfig.json`. **0 `@ts-ignore`/`@ts-expect-error`** dans tout le dépôt — signal de rigueur réel, pas juste `strict` de façade.

**Points faibles** :
- **96 occurrences de `any`** (58 client / 38 server), concentrées sur peu de fichiers : `useClientSuccess.ts` (7), `managerPermission.service.ts` (6), `SettingsUsersTab.tsx` (6).
- Des **payloads métier typés `any`** : `permissionProfiles.api.ts:8,15` (`permissions: any`), `managerPermissions.api.ts:7` (`overrides?: any`) — sur exactement le système de permissions qui protège l'accès aux données financières.
- **Aucun type d'entité partagé** entre client et serveur. Le package `@secritou/shared` ne contient que des schémas Zod de validation — `Invoice`, `Project`, `User` sont **définis indépendamment** dans `server/src/types/entities.ts` et `client/src/types/*.ts` (et `client/src/api/invoices.api.ts:3` définit son propre `Invoice` qui n'existe nulle part côté serveur). Une évolution du schéma DB peut désynchroniser silencieusement le type client.

**Priorité** :
- 🟡 Typer les 2 payloads de permissions (`permissions`, `overrides`) — **3h**, risque direct sur le système RBAC déjà identifié fragile dans l'audit sécurité.
- ⚪ Réduire les `any` des 3 fichiers les plus chargés — **6h**
- ⚪ Partager au moins les types de réponse API (`Invoice`, `Project`, `User`) via `shared/` — **8-16h**, gros chantier, à planifier mais pas urgent tant que les tests d'intégration API existent.

---

## 3. Gestion d'état — cause confirmée de l'incohérence dashboard/invoices

**Un seul store Zustand** (`auth.store.ts`) — pas de duplication généralisée état-serveur/Zustand. Mais un point faible : `permissions: PermissionsMap | null` (`auth.store.ts:14,33,80-87`) est une **donnée serveur mise en cache manuellement dans Zustand** au lieu de passer par TanStack Query — pas de `staleTime`, pas d'invalidation automatique, rafraîchie seulement par appel explicite.

**La vraie cause de la divergence Dashboard/Invoices (déjà documentée dans audit 04)**, confirmée précisément :

| Chemin | Query key | staleTime | Source |
|---|---|---|---|
| Dashboard (compteur "overdue") | `["dashboard", "full"]` | 2 min | agrégat backend `dashboardApi.getFull()` |
| Dashboard (exec tab) | `["analytics", "executive"]` | 3 min + `refetchInterval` 5 min | agrégat backend `analyticsApi.getExecutiveMetrics()` |
| InvoicesPage | `["invoices", params]` | 1 min | liste paginée/filtrée réelle `invoicesApi.getInvoices()` |

**Aucune invalidation croisée** : les mutations de `useInvoices.ts` (create/update/delete/payment) n'invalidatent que `["invoices"]`, jamais `["dashboard", "full"]` ni `["analytics", "executive"]`. Une facture modifiée depuis `InvoicesPage` laisse le dashboard avec des compteurs périmés jusqu'à expiration de son propre `staleTime`.

Aggravant : `InvoicesPage.tsx:202-211` recalcule un `effectiveStatus` "OVERDUE" **côté client** avec un commentaire explicite disant que c'est pour "rester cohérent" avec le dashboard — la présence même de ce correctif confirme que l'équipe avait déjà remarqué la divergence sans la corriger à la racine.

Autre incohérence mineure : `useDashboard.ts:6` définit `["dashboard", "summary"]` (`useDashboardSummary`) qui **n'est appelé nulle part** — code mort à côté du vrai hook utilisé (`useDashboardFull`).

**Priorité** :
- 🔴 **Invalider `["dashboard"]` et `["analytics"]` depuis les mutations de `useInvoices.ts`** (ou passer par les tags d'invalidation déjà posés côté serveur lors du fix précédent) — **2h**, corrige la cause racine plutôt que le symptôme (le recalcul client `effectiveStatus` peut alors être retiré).
- 🟡 Centraliser les `staleTime` factures/dashboard dans une constante partagée plutôt que 3 valeurs différentes (1/2/3 min) choisies indépendamment — **1h**
- ⚪ Supprimer `useDashboardSummary`/`["dashboard","summary"]` (mort) ou l'utiliser — **30 min**
- ⚪ Faire passer `permissions` par TanStack Query au lieu de Zustand — **4h**

---

## 4. Gestion d'erreurs

**3 Error Boundaries** à des niveaux cohérents : `GlobalErrorBoundary` (racine, `App.tsx`, remonte à Sentry), `RouteBoundary` (par route, `console.error` seulement — pas de Sentry), `TabErrorBoundary` (2 pages seulement : Commercial, ProjectDetail).

**Trou identifié** : `AppLayout()` et `ClientLayout` (le shell applicatif — sidebar, notifications, recherche globale, assistant IA) ne sont entourés que d'un `<Suspense>`, **sans Error Boundary dédié**. Une erreur dans la sidebar remonte directement au `GlobalErrorBoundary` racine — écran 500 plein au lieu d'un fallback localisé.

**Erreurs avalées silencieusement** (4 cas concrets) :
- `auth.store.ts:84-86` — échec de fetch des permissions : `console.error` seul, aucun état d'erreur exposé à l'UI qui consomme `permissions`.
- `useUpload.ts:49,51` — `.catch(() => {})` sur la suppression d'un ancien fichier, `.catch(() => null)` sur l'upload lui-même : un échec d'upload de CV/portfolio (formulaire public JoinUs) peut passer inaperçu.
- `LandingCmsProvider.tsx:47-49` — erreur de fetch CMS totalement avalée (fallback silencieux vers les textes i18n, acceptable ici mais non documenté comme volontaire).
- `proposal.service.ts:413` (serveur) — `.catch(() => null)` sans log sur `findById`.

**6 pages avec `isLoading` géré mais `isError` jamais exploité** (l'utilisateur voit un état vide/indéterminé au lieu d'un message d'erreur en cas d'échec réseau) : `InvoicesPage.tsx`, `InvoicesClientPage.tsx`, `ApprovalsClientPage.tsx`, `ProjectsClientPage.tsx`, `ClientDashboardPage.tsx`, `DocumentsClientPage.tsx` — notamment **tout le portail client**, qui a le moins de garde-fous d'erreur alors qu'il est exposé aux clients externes.

Le middleware d'erreur serveur (`error.middleware.ts`) est correctement centralisé et monté en dernier, gère Prisma/Multer/Zod/HttpError avec fallback 500 + Sentry conditionnel. Manque : **aucun request ID** dans les logs (`morgan` + `pino` séparés, pas de corrélation) — impossible de relier une entrée de log d'erreur à une requête précise sans APM.

**Priorité** :
- 🔴 Ajouter la gestion `isError` sur les 6 pages du portail client (le plus exposé, le moins couvert) — **4h**
- 🟡 Error Boundary dédié autour du shell applicatif (sidebar/notifications) dans AppLayout/ClientLayout — **2h**
- 🟡 Remonter les 4 erreurs avalées silencieusement (au minimum un toast utilisateur pour l'upload CV/portfolio) — **3h**
- ⚪ Request ID corrélé dans les logs serveur (middleware `express-request-id` + inclusion dans le contexte pino) — **3h**

---

## 5. Code mort

**Excellent état général** : 0 `console.log` de debug, 0 vrai `TODO`/`FIXME` (tous les faux positifs identifiés sont des valeurs d'enum `"TODO"` ou des gabarits de téléphone `+216XXXXXXXX`), 0 fichier `.bak`/`.old`/reliquat, tous les assets référencés.

**Trouvailles concrètes** :
- `client/src/features/landing/components/BusinessImpact.tsx` — composant complet, **jamais importé nulle part** (confirmé par grep exhaustif).
- `@dnd-kit/utilities` — utilisé dans `TasksKanban.tsx:19` mais **absent du `package.json`** (fonctionne aujourd'hui uniquement comme dépendance transitive — cassera au premier changement de version de `@dnd-kit/core`).
- depcheck client : `@radix-ui/react-aspect-ratio`, `input-otp`, `tw-animate-css`, `vaul` potentiellement inutilisées (à vérifier, faux positifs possibles pour des composants shadcn pré-générés).
- depcheck server : `@bull-board/api`, `@bull-board/express`, `exceljs` — 0 occurrence dans `server/src`.
- Hors périmètre code mais signalé : la racine du dépôt contient des fichiers bureautiques (`SaaS.zip`, `.docx`, `.xlsx`, `.pdf`, un `.png` au nom généré) qui n'ont rien à faire dans un repo git.

**Priorité** :
- 🔴 Ajouter `@dnd-kit/utilities` explicitement au `package.json` — **5 min**, évite une casse silencieuse future.
- 🟡 Supprimer `BusinessImpact.tsx` (ou le réintégrer si l'oubli est involontaire — à trancher avec le produit) — **15 min**
- ⚪ Nettoyer les dépendances depcheck après vérification manuelle — **1h**
- ⚪ Déplacer les fichiers bureautiques hors du repo git (ou `.gitignore` + retrait de l'historique si sensibles) — **30 min**

---

## 6. Conventions et linting

**Aucune fuite de nommage français dans les variables/fonctions/props** — le code applicatif est intégralement en anglais. **Une seule incohérence de routes** : `mentions-legales`, `confidentialite`, `rejoindre` (`AppRoutes.tsx:160,161,163`) sont en français alors que toutes les routes voisines (`services`, `solutions`, `case-studies`, `contact`, `login`...) sont en anglais — et `rejoindre` route vers un composant nommé `JoinUsPage` (incohérence directe entre route et nom de fichier). C'était un choix SEO volontaire (voir audit 06) mais mérite d'être documenté comme tel dans le code pour qu'un futur dev ne le "corrige" pas par erreur.

**`npm run lint` échoue actuellement des deux côtés** :
- Client : **172 problèmes (9 erreurs, 163 warnings)**. Les 8 erreurs `no-undef` viennent toutes de `client/scripts/prerender.mjs` (créé lors de l'audit SEO) : le fichier `.mjs` n'est pas couvert par les globals Node de la config ESLint (`files: ["**/*.{ts,tsx}"]` l'exclut). 1 erreur réelle : `axios.ts:124` `no-async-promise-executor`.
- Server : **150 problèmes (28 erreurs, 122 warnings)**. Erreurs dominantes : `no-non-null-asserted-optional-chain` répété dans 5 controllers, 2×`no-constant-condition` dans un test. Warning répété partout : `COMPANY_ID` importé mais non utilisé dans presque tous les controllers.

**Prettier n'a jamais été passé sur ce dépôt** : `npx prettier --check .` liste quasi tous les fichiers comme non formatés, et **plante avec une erreur bloquante** sur `client/src/i18n/locales/en/test.json` (encodage corrompu, caractère `<0xFFFD>`) — ce fichier est probablement un reliquat à supprimer. `eslint-config-prettier` est installé mais **jamais importé** dans la config ESLint (dépendance inerte).

Pas de tri d'imports outillé — ordre mélangé externe/interne/relatif observé sur 6 fichiers échantillonnés. Une seule incohérence de nommage de fichier : `use-mobile.tsx` en kebab-case au lieu du camelCase de tous les autres hooks.

**Priorité** :
- 🔴 Supprimer ou corriger `client/src/i18n/locales/en/test.json` (bloque tout passage de Prettier) — **15 min**
- 🔴 Corriger le fichier `client/eslint.config.js` pour inclure `**/*.mjs` dans les globals Node (corrige les 8 fausses erreurs de `prerender.mjs`) — **15 min**
- 🟡 Corriger les 28 erreurs serveur (`no-non-null-asserted-optional-chain`, `no-constant-condition`) et l'erreur client (`no-async-promise-executor`) pour repasser `lint` au vert — **4h**
- 🟡 Un passage Prettier unique sur tout le repo (`prettier --write .`) une fois le JSON corrompu retiré, committé isolément pour ne pas polluer l'historique — **1h + revue**
- ⚪ Documenter en commentaire (`AppRoutes.tsx`) que les 3 routes FR sont un choix SEO volontaire — **10 min**
- ⚪ Renommer `use-mobile.tsx` → `useMobile.tsx` — **10 min**

---

## 7. Tests — l'état actuel et les 10 premiers tests à écrire

### État actuel

- **Client** : 7 fichiers, 22 tests, **tous passent**. Vitest + Testing Library, `environment: "jsdom"`, setup minimal (`jest-dom` uniquement). **Aucun seuil de couverture configuré.**
- **Server** : 23 fichiers dans `server/test/` (hors `src/`), **2934 lignes**, runner `node:test` natif (pas Vitest) — deux runners différents à maintenir dans le même monorepo. Couverture large : auth, RBAC, IDOR, scopes par rôle, cascades de propositions, validators Zod.
- **Trouvaille critique** : `server/test/invoice.service.test.ts` (398 lignes) **ne teste pas le fichier source réel**. Son propre en-tête l'assume : *"no DB, no imports of service"* — la logique de `computeNewStatus` et les stubs de transaction sont **recopiés à la main** dans le test. Si `server/src/services/invoice.service.ts` change, ces tests continuent de passer sans rien détecter. C'est un faux sentiment de sécurité sur le module le plus sensible (facturation, paiements, avoirs).
- **Zéro test** sur `executiveMetrics.repository.ts` (calculs churn/retention/growth — déjà identifiés comme ayant des formules discutables dans l'audit 04), `format.ts` (formatage montants), et les schémas Zod inline de ContactPage/JoinUsPage (JoinUsPage a un test partiel, ContactPage seulement indirect via le rendu).

### Setup à poser d'abord (si pas déjà suffisant)

Le setup client existant (`client/vitest.config.ts` + `client/src/test/setup.ts`) est suffisant pour les tests 1-6 ci-dessous. Pour le module serveur, ajouter Vitest permettrait d'unifier les deux runners — mais migrer les 23 fichiers `node:test` existants est un chantier séparé, **hors périmètre de ces 10 tests** (qui utilisent `node:test`, déjà en place côté serveur, pour rester cohérents avec l'existant).

### Les 10 tests au meilleur ratio impact/effort

**1. Corriger `invoice.service.test.ts` pour importer le vrai fichier** (🔴, 3h)
Le seul "test" de la liste qui n'en ajoute pas un nouveau — il rend existant un test qui ne teste rien.

```ts
// server/test/invoice.service.test.ts (extrait à remplacer)
import { computeNewStatus } from "../src/services/invoice.service.js"; // exporter la fonction pure si elle ne l'est pas déjà
import test from "node:test";
import assert from "node:assert/strict";

test("computeNewStatus: paiement partiel -> PARTIAL", () => {
  assert.equal(computeNewStatus({ amount: 1000, amountPaid: 400, status: "SENT" }), "PARTIAL");
});
test("computeNewStatus: paiement complet -> PAID", () => {
  assert.equal(computeNewStatus({ amount: 1000, amountPaid: 1000, status: "SENT" }), "PAID");
});
test("computeNewStatus: sur-paiement plafonné, reste PAID (pas > PAID)", () => {
  assert.equal(computeNewStatus({ amount: 1000, amountPaid: 1200, status: "SENT" }), "PAID");
});
```
*(Nécessite d'exporter `computeNewStatus`/la logique équivalente depuis `invoice.service.ts` si elle est actuellement une fonction interne non exportée — sinon restructurer légèrement pour la rendre testable en isolation.)*

**2. Invariants KPI de `executiveMetricsRepository`** (🔴, 4h) — calculs jamais testés, déjà signalés fragiles dans audit 04 (churn/retention, division par zéro)

```ts
// server/test/executiveMetrics.repository.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { executiveMetricsRepository } from "../src/repositories/executiveMetrics.repository.js";
import { prisma } from "../src/config/prisma.js"; // ou le client de test dédié déjà utilisé par les autres server/test/*.ts

test("getExecutiveMetrics: retention + churn somment à 100", async () => {
  const metrics = await executiveMetricsRepository.getExecutiveMetrics(/* companyId de test */);
  assert.equal(metrics.clients.retentionRate + metrics.clients.churnRate, 100);
});

test("getExecutiveMetrics: 0 client -> pas de division par zéro (retourne 0, pas NaN/Infinity)", async () => {
  // utiliser une company de test sans clients
  const metrics = await executiveMetricsRepository.getExecutiveMetrics(/* companyId vide */);
  assert.equal(Number.isFinite(metrics.clients.churnRate), true);
  assert.equal(Number.isFinite(metrics.clients.retentionRate), true);
});
```

**3. `format.ts` : montants, dates, pluriels** (🟡, 2h) — zéro test sur un module utilisé dans presque toutes les pages financières

```ts
// client/src/utils/format.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatPercent } from "./format";

describe("formatCurrency", () => {
  it("formate un montant TND en fr-FR", () => {
    expect(formatCurrency(1234.5, "TND", "fr-FR")).toContain("234");
  });
  it("retourne le fallback sur null/undefined/NaN", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency(NaN)).toBe("—");
  });
});

describe("formatDate", () => {
  it("retourne le fallback sur une date invalide", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});
```

**4. Schéma Zod du formulaire Contact (isolé du composant)** (🟡, 2h) — actuellement testé seulement via le rendu du composant, pas en isolation

```ts
// client/src/features/landing/pages/contactSchema.test.ts
// Prérequis : extraire `contactSchema` de ContactPage.tsx vers un fichier séparé
// (ex. contactSchema.ts) pour le rendre testable sans monter le composant — profite
// aussi à la lisibilité du composant (924 lignes -> moins).
import { describe, it, expect } from "vitest";
import { contactSchema } from "./contactSchema";

describe("contactSchema", () => {
  it("rejette un téléphone non tunisien", () => {
    const result = contactSchema.safeParse({ name: "Test", email: "a@b.com", phone: "0033612345678", company: "Acme", message: "x".repeat(20), serviceType: "Business Performance" });
    expect(result.success).toBe(false);
  });
  it("accepte le budget vide (placeholder)", () => {
    const result = contactSchema.safeParse({ name: "Test", email: "a@b.com", budget: "", company: "Acme", message: "x".repeat(20), serviceType: "Business Performance" });
    expect(result.success).toBe(true);
  });
});
```

**5. RBAC `authorize()` — matrice de rôles** (🟡, 2h) — le middleware existe déjà et est réellement testable (contrairement à invoice.service, c'est un vrai import), mais `server/test/rbac.test.ts` ne fait que 23 lignes — étendre la matrice

```ts
// server/test/rbac.middleware.test.ts (ou étendre rbac.test.ts existant)
import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../src/middlewares/rbac.middleware.js";

function mockReq(role?: string) { return { user: role ? { role } : undefined } as any; }
function mockNext() { const calls: any[] = []; const next = (err?: unknown) => calls.push(err); return { next, calls }; }

test("authorize: 401 si pas d'utilisateur", () => {
  const { next, calls } = mockNext();
  authorize("ADMIN")(mockReq(undefined), {} as any, next);
  assert.equal((calls[0] as any)?.statusCode, 401);
});

test("authorize: 403 si rôle non autorisé", () => {
  const { next, calls } = mockNext();
  authorize("ADMIN")(mockReq("CLIENT"), {} as any, next);
  assert.equal((calls[0] as any)?.statusCode, 403);
});

test("authorize: passe si rôle autorisé", () => {
  const { next, calls } = mockNext();
  authorize("ADMIN", "MANAGER")(mockReq("MANAGER"), {} as any, next);
  assert.equal(calls[0], undefined);
});
```

**6. `requirePermission()` — le chemin MANAGER avec permissions résolues** (🟡, 3h) — jamais testé alors que c'est le système qui protège l'accès financier des managers, et que `permissions`/`overrides` sont typés `any` (§2)

```ts
// server/test/rbac.middleware.test.ts (suite)
import { requirePermission } from "../src/middlewares/rbac.middleware.js";
// nécessite de mocker managerPermissionService.resolvePermissions — suivre le
// pattern de mock déjà utilisé dans server/test/leadService.test.ts ou financeAccess.test.ts

test("requirePermission: ADMIN toujours autorisé sans vérifier les permissions", async () => {
  const { next, calls } = mockNext();
  await requirePermission("invoices", "delete")(mockReq("ADMIN"), {} as any, next);
  assert.equal(calls[0], undefined);
});

test("requirePermission: MANAGER refusé si permission absente du module", async () => {
  // mock resolvePermissions -> { invoices: { read: true, delete: false } }
  const { next, calls } = mockNext();
  await requirePermission("invoices", "delete")(mockReq("MANAGER"), {} as any, next);
  assert.equal((calls[0] as any)?.statusCode, 403);
});
```

**7. i18n complet — les clés FR et EN sont synchronisées** (🟡, 1h) — `scripts/check-i18n.mjs` existe et fonctionne (vérifié : exit 0) mais n'est pas encore un test automatisé dans la CI

```ts
// client/src/i18n/i18n-sync.test.ts
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("i18n FR/EN sync", () => {
  it("check-i18n.mjs passe sans erreur (clés FR/EN synchronisées)", () => {
    expect(() => execSync("node scripts/check-i18n.mjs", { cwd: "../../.." })).not.toThrow();
  });
});
```
*(Alternative plus propre : appeler directement la logique de `check-i18n.mjs` importée en module plutôt que `execSync` — à ajuster selon si le script est facilement importable.)*

**8. Validation téléphone tunisien partagée (`shared/`)** (⚪, 1h) — logique déjà testée côté client (ContactPage.test.tsx) et implicitement côté serveur (contactValidator.test.ts), mais pas testée directement à la source dans `shared/`

```ts
// shared/src/constants/phone.test.ts (si un test shared/ existe déjà pour phone.ts, l'étendre ; sinon créer)
import test from "node:test";
import assert from "node:assert/strict";
import { isValidTunisianPhone } from "./phone.js";

test("accepte +216 suivi de 8 chiffres", () => {
  assert.equal(isValidTunisianPhone("+21612345678"), true);
});
test("accepte un numéro local 8 chiffres commençant par 2-9", () => {
  assert.equal(isValidTunisianPhone("23456789"), true);
});
test("rejette 216 sans + (ambigu avec un numéro local)", () => {
  assert.equal(isValidTunisianPhone("21612345678"), false);
});
```

**9. Cascade de suppression client (déjà partiellement couverte par `businessGuards.test.ts`, à étendre)** (⚪, 2h) — l'audit 04 avait signalé le garde-fou "client avec factures ne peut pas être supprimé" comme correct en service mais fragile si appelé hors service

```ts
// server/test/businessGuards.test.ts (étendre le fichier existant, 55 lignes)
test("deleteClient: refuse si le client a au moins une facture (peu importe le statut)", async () => {
  // setup: créer un client de test + une facture DRAFT
  // vérifier que clientService.deleteClient lève bien une HttpError 409
});
```

**10. Page 6 client sans gestion d'erreur — test de régression sur `DocumentsClientPage`** (⚪, 2h) — représentatif des 6 pages identifiées au §4, à traiter comme patron pour les 5 autres

```tsx
// client/src/features/client-portal/DocumentsClientPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
// mock useQuery pour retourner isError: true
describe("DocumentsClientPage", () => {
  it("affiche un message d'erreur si le chargement des documents échoue", async () => {
    // mock du hook -> { data: undefined, isLoading: false, isError: true }
    render(/* DocumentsClientPage avec providers nécessaires */);
    expect(await screen.findByText(/erreur|impossible de charger/i)).toBeInTheDocument();
  });
});
```
*(Ce test doit être écrit **après** l'ajout de la gestion `isError` recommandée au §4 — sinon il documente un manque plutôt que de le vérifier.)*

**Effort total des 10 tests** : ~22h, dont 3h de correctif pur (le test invoice.service existant).

---

## 8. Git et CI

**`.gitignore`** : 3 fichiers (racine, client, server), tous corrects sur l'essentiel (`node_modules`, `dist`, `.env`, `*.log`, `.DS_Store`). **Trous** : aucun ne couvre `coverage/` alors que `server/package.json` a un script `test:coverage` (c8) qui en génère un ; règle env limitée à `.env.local`/`.env.*.local` plutôt qu'un pattern `.env*` + `!.env.example` plus robuste. **Aucun secret tracké** — seuls les `.env.example` sont versionnés (vérifié par grep direct sur `git ls-files`).

**Aucune CI** : pas de dossier `.github/workflows/`. Le repo est un monorepo npm workspaces propre (`client`, `server`, `shared`) avec toutes les commandes nécessaires déjà en place (`lint`, `typecheck`, `test`/`test:coverage`, `build` sur chaque package, plus `prisma:validate`/`prisma:format:check` côté serveur) — il ne manque que le fichier de pipeline.

**Priorité** :
- 🔴 Ajouter `coverage/` aux 2 `.gitignore` (client, server) — **5 min**
- 🔴 Mettre en place la CI minimale ci-dessous — **2h** (montage + premier passage rouge à corriger avec les points §6)
- ⚪ Renforcer les règles `.env*` — **15 min**

### Pipeline CI minimal proposé

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  client:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
        working-directory: .
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build

  server:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: secritou
          POSTGRES_PASSWORD: secritou
          POSTGRES_DB: secritou_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://secritou:secritou@localhost:5432/secritou_test
      NODE_ENV: test
      JWT_SECRET: ci-test-secret-min-32-characters-long
      JWT_REFRESH_SECRET: ci-test-refresh-secret-min-32-chars
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
        working-directory: .
      - run: npm run prisma:validate
      - run: npm run prisma:generate
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build

  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/check-i18n.mjs
```

*Note : ce pipeline échouera immédiatement sur `lint` tant que les points du §6 (8 erreurs `no-undef` sur `prerender.mjs`, 28 erreurs serveur, 1 erreur `no-async-promise-executor`) ne sont pas corrigés — c'est voulu : la CI doit être installée en même temps que le nettoyage lint, sinon elle est rouge dès le premier commit et perd sa valeur.*

---

## Synthèse — effort total par horizon

| Horizon | Items | Effort cumulé |
|---|---|---|
| 🔴 Avant lancement | Invalidation cache dashboard/invoices, `isError` portail client, `@dnd-kit/utilities`, fichier JSON corrompu, config ESLint `.mjs`, `.gitignore` coverage, CI minimale | **~10h** |
| 🟡 Premier mois | Découpage des 4 grosses pages, factorisation ServiceCard/KPICard, typage permissions, Error Boundary shell, erreurs avalées, lint serveur/client au vert, Prettier, 6 des 10 tests (RBAC, format, i18n, contactSchema, invoice.service, executiveMetrics) | **~45h** |
| ⚪ Plus tard | Partage de types shared, réduction des `any` restants, nettoyage depcheck, `EntityTable` (finir ou supprimer), 4 tests restants, renommages mineurs | **~35h** |

**Total estimé : ~90h** de dette identifiée, dont un dixième (10h) suffit à sécuriser le lancement.
