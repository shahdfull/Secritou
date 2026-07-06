# Audit 04 — Logique métier, calculs et cohérence des données

**Date** : 2026-07-05
**Périmètre** : Dashboard, CRM, Invoices, Projects, Tasks, Talent, Documents
**Fichier pivot** : `server/src/repositories/executiveMetrics.repository.ts` (source unique des KPI exec)

---

## 1. Incohérences de KPI — causes racines

### 1.1 "ACTIVE CLIENTS: 3, -100%, Total: 4" — mélange de deux métriques sur un même tile

**Cause racine** : le tile "Clients actifs" affiche la **valeur** `clients.active` mais la **variation** `clients.newGrowthMoM` — deux métriques différentes.

- `client/src/features/dashboard/DashboardPage.tsx:370-378` :
  ```tsx
  <KPICard
    label={t("exec.activeClients")}
    value={clients.active}            // 3 — clients avec projet actif
    sub={`Total : ${clients.total}`}  // 4
    growth={clients.newGrowthMoM}     // -100% — croissance des NOUVEAUX clients MoM !
  ```
- `server/src/repositories/executiveMetrics.repository.ts:375` : `newGrowthMoM: growthPct(clientsNewMTD, clientsNewPrevMTD)`.
- `growthPct` (ligne 23-26) : 0 nouveau ce mois-ci, ≥1 le mois dernier → `(0-1)/1 = -100%`. Mathématiquement correct, mais affiché sous le mauvais label.

**Correctif** : soit déplacer `growth={clients.newGrowthMoM}` sur le tile "Nouveaux clients (MTD)" (ligne 379-386, qui n'a pas de growth), soit calculer une vraie variation de clients *actifs* (nécessite un snapshot du mois précédent — table d'historique ou comparaison `createdAt` des projets).

### 1.2 Rétention 100% / churn 0% avec 3 clients sur 4 "at-risk"

**Cause racine** : `churnRate` ne compte que les clients **"lost"** (aucun projet actif + dernier projet terminé il y a > 6 mois). Les clients "at-risk" (facture impayée > 30j) en sont **exclus par construction** :

- `executiveMetrics.repository.ts:360-362` :
  ```ts
  if (hasOverdue30) atRisk++;
  else if (!hasActive && lastCompleted && lastCompleted < sixMonthsAgo) lost++;  // else if !
  ```
  Un client à la fois at-risk ET perdu n'est compté que at-risk → `lost` sous-estimé.
- Ligne 369 : `churnRate = pct(lost, clientsAll - clientsNewMTD)` → `lost=0` → churn 0% → rétention 100%.
- La rétention est donc **structurellement optimiste** : elle ignore le signal de risque le plus fort (impayés).

**Correctif** : (a) séparer les axes — "at-risk" est un statut de santé financière, "lost" un statut d'activité ; un client peut être les deux (compteurs indépendants, pas de `else if`) ; (b) afficher un avertissement UI si `atRisk / total > seuil` à côté de la rétention ; (c) documenter la formule de rétention dans le tooltip du tile.

### 1.3 `activeClients` du dashboard standard = TOTAL des clients

- `server/src/services/dashboard.service.ts:32` :
  ```ts
  activeClients: (summary.clients as { total: number }).total,
  ```
- `summary.repository.ts:93` : `prisma.client.count({})` — **tous** les clients, sans filtre d'activité.
- Le dashboard non-exec (`DashboardPage.tsx:606,781`) affiche donc "Clients actifs = 4" alors que l'exec affiche 3.

**Correctif** : réutiliser la définition de l'exec (client avec ≥1 projet `IN_PROGRESS|REVIEW|PLANNING`) ou renommer le label en "Clients (total)".

### 1.4 Task Progress 2/10 et Project Completion 0% — corrects mais bruts

- `executiveMetrics.repository.ts:429` : `completionRate: pct(completed, totalProjects)` — correct, 0 projet COMPLETED → 0%.
- Lignes 252-254 : `tasksDone/tasksTotal` — correct.
- Pas de bug de calcul ici ; l'incohérence perçue vient de la juxtaposition avec "rétention 100%" (voir 1.2).

### 1.5 Divisions par zéro — traitées mais avec des choix discutables

| Fonction | Comportement à dénominateur 0 | Problème |
|---|---|---|
| `pct()` (ligne 19-21) | retourne 0 | rétention = 100 - 0 = **100%** avec 0 client — affiche une rétention parfaite sur base vide |
| `growthPct()` (ligne 23-26) | `current>0 ? 100 : 0` | +100% dès le premier élément — spike artificiel le premier mois |
| `convRate` (ligne 322) | **30 en dur** si aucune proposition | valeur inventée injectée dans le forecast (voir 1.6) |

### 1.6 Forecast : revenus fabriqués à partir d'un taux de conversion par défaut

- `executiveMetrics.repository.ts:322-327` :
  ```ts
  const convRate = proposalSentRaw === 0 ? 30 : pct(proposalWonRaw, proposalSentRaw);
  const f30 = invoices30 + pipeline * CONV * 0.33;
  ```
  Avec 0 proposition historique, le forecast ajoute 30% × pipeline × pondération — **du chiffre d'affaires spéculatif présenté comme prévisionnel**, sans mention UI. Les coefficients 0.33/0.66/1.0 sont arbitraires et non documentés.

**Correctif** : si `proposalSentRaw === 0`, n'ajouter aucune part pipeline (ou l'afficher séparément "dont pipeline pondéré : X"), et exposer `conversionRate` + la formule dans le tooltip.

### 1.7 `cashByMonth[].billed` : toujours 0

- `executiveMetrics.repository.ts:289-304` : la série mensuelle n'alimente que `cash` ; le commentaire ligne 296 l'avoue ("fetch separately would be another query") et `billed` reste `0` pour tous les mois. Tout graphique cash vs facturé affiche une série plate à zéro.

**Correctif** : une requête `invoice.findMany({ where: { status: notIn [DRAFT,CANCELLED], createdAt: gte 13 mois } , select: {createdAt, amount} })` agrégée dans la même boucle.

### 1.8 Projets "stale" : les projets sans tâche comptent comme stale/critiques

- Ligne 234-239 : `tasks: { every: { updatedAt: { lt: day7ago } } }` — en Prisma, `every` est **vrai pour une liste vide** → un projet IN_PROGRESS fraîchement créé sans tâche est "stale".
- Ligne 402 : `const isStale = lastActivity ? lastActivity < day7ago : p.tasks.length === 0;` — explicite : 0 tâche → stale → `criticalCount++` (ligne 407). Un projet en PLANNING sans tâche est compté **critique**.

**Correctif** : exclure les projets sans tâche du calcul stale (ou les classer "à démarrer"), et borner par `createdAt` du projet (< 7 jours = jamais stale).

---

## 2. Divergence Dashboard "Overdue 19K / 3 invoices" vs page Invoices "No invoices yet"

### Cause racine n°1 (la plus probable) : cache exec jamais invalidé

- `server/src/services/executiveMetrics.service.ts:4-15` : les métriques exec sont mises en cache Redis (`executive:metrics:v1`, TTL 180 s).
- La méthode `invalidate()` (ligne 17-19) **n'est appelée nulle part** dans le code serveur (grep exhaustif : 0 usage).
- Conséquence : après suppression/re-seed des factures, le dashboard sert jusqu'à 3 minutes de KPI fantômes (Overdue 19K, section Risks avec 3 factures) pendant que la page Invoices (requête live `GET /invoices`) affiche une base vide. **C'est exactement le symptôme observé en démo.**

**Correctif** : appeler `executiveMetricsService.invalidate()` dans `invoice.service` (create/update/delete/addPayment), `client.service`, `project.service` — ou rattacher la clé aux tags existants (`cacheTags.dashboard()`) déjà invalidés par `invalidateTags` (cf. `client.service.ts:55`).

### Cause racine n°2 : scoping MANAGER par `project.serviceId`

- `server/src/controllers/invoice.controller.ts:28-35` : pour un MANAGER, `GET /invoices` passe par `findAllByServiceId`.
- `invoice.repository.ts:62` : `where: { project: { serviceId } }` — une facture **sans projet** (`projectId: null`, cas légal : `create` ligne 107 le rend optionnel) est invisible pour tout MANAGER. `assertInvoiceInScope` (invoice.service.ts:25) la 404 même par ID.
- Le dashboard MANAGER (`dashboard.service.ts:14-16`) compte l'overdue avec le même filtre — cohérent entre eux — mais tout ADMIN qui crée une facture hors projet la rend invisible aux managers tout en gonflant les KPI globaux.

**Correctif** : décider d'une règle et l'appliquer partout — soit interdire les factures sans projet (validator), soit élargir le scope : `OR: [{ project: { serviceId } }, { projectId: null, client: { ... } }]`.

### Cause racine n°3 : overdue calculé à la lecture vs statut stocké

- Dashboard : `status IN (SENT, PARTIAL, OVERDUE) AND dueDate < now()` (`dashboard.service.ts:13-16`, `executiveMetrics.repository.ts:199`) — calcul temps réel.
- Le seed ne contient qu'**une** facture au statut `OVERDUE` (INV-2026-007, 17 500 TND, `seed.ts:458`) ; les "3 factures / 19 000 TND" de la démo sont des SENT/PARTIAL dont la `dueDate` est passée. La page Invoices affiche le **statut stocké** (badge "Sent") — l'utilisateur ne voit pas 3 factures "en retard" dans la liste alors que le dashboard en compte 3.

**Correctif** : afficher dans la liste un badge dérivé (`isOverdue = dueDate < now && status in (SENT,PARTIAL)`), ou s'assurer que le job quotidien qui bascule les statuts en OVERDUE tourne (mentionné en commentaire `dashboard.service.ts:24` — vérifier qu'il est planifié dans BullMQ).

### Autres divergences du même type

| Divergence | Cause | Fichier:ligne |
|---|---|---|
| Exec dashboard ADMIN-only mais Risks pointent vers des pages accessibles | `authorize("ADMIN")` sur `/analytics/executive` | `analytics.routes.ts:34` |
| Dashboard summary aussi caché (Redis) — même risque de staleness que exec | tags invalidés seulement par certains services | `dashboard.service.ts:47-53` |
| Santé client (at-risk) ne voit que les factures **liées à un projet** | `clientsWithProjects` traverse `projects.invoices` ; les factures `projectId: null` échappent au calcul at-risk/revenue alors que `Invoice.clientId` est direct | `executiveMetrics.repository.ts:219-229, 354-357` |
| `topClients.revenue` = somme des `amountPaid` des factures projet uniquement | même cause | `executiveMetrics.repository.ts:357` |
| Documents : page vide possible avec documents référencés dans projets/onboarding | les documents sont liés par `projectId`/`clientId` SetNull — un document orphelin n'apparaît que dans la liste globale | `schema.prisma:522-524` |

---

## 3. Données de démo

### État : correctement isolées ✓

- **Toutes** les données de démo (Carrefour Tunisia, Monoprix Tunisia, Géant Tunisia, Vermeg Digital, Ahmed Ben Ali, Sarra Mansouri, etc.) vivent dans **`server/prisma/seed.ts`** — un seul fichier, 0 occurrence dans les composants client (grep exhaustif).
- Aucun mock côté front : toutes les pages consomment l'API réelle.

### Mécanisme proposé pour démarrer en prod avec une base vide

1. **Séparer le seed en deux** :
   - `seed-core.ts` : uniquement l'indispensable (compte ADMIN initial, `Service` de base, profils de permissions par défaut). Exécuté en prod.
   - `seed-demo.ts` : les données Carrefour/Monoprix/etc. Gardé par un flag :
     ```ts
     if (process.env.SEED_DEMO !== "true") { console.log("demo seed skipped"); return; }
     ```
2. **package.json** : `"db:seed": "node seed-core.js"`, `"db:seed:demo": "SEED_DEMO=true node seed-demo.js"`.
3. **États vides** : déjà prévus dans l'UI (voir §7) — l'app ne casse pas sur base vide. Les seuls points durs sur base vide sont cosmétiques : rétention 100% (§1.5) et `convRate` 30% par défaut (§1.6).

---

## 4. Montants

### Centralisation : bonne base, deux angles morts

- ✓ `client/src/utils/format.ts` centralise `formatCurrency/formatNumber/formatPercent` (désormais locale-aware après le fix i18n).
- ✗ **Suffixe " TND" manuel dans 16 fichiers** (42 occurrences) : le pattern dominant est `` `${formatNumber(x)} TND` `` au lieu de `formatCurrency(x)`. Fonctionne, mais la devise est dupliquée en dur — si un client est facturé en EUR (`Invoice.currency` existe et vaut "TND" par défaut seulement), l'UI affichera quand même TND. `InvoicesPage.tsx:191` fait mieux : `{invoice.currency} {invoice.amount}`.
- ✗ **Formatage FR en dur côté serveur** : `executiveMetrics.repository.ts:445` (`toLocaleString("fr-FR")` dans le subtitle des risques) et `:302` (labels de mois `fr-FR`) — les chaînes des Risks sont construites côté serveur en français, non traduisibles (déjà noté dans l'audit i18n).

### Arrondis

- `Math.round` appliqué aux forecasts et séries mensuelles (`executiveMetrics.repository.ts:303, 334-336`) — perte volontaire des centimes dans les KPI, OK pour un dashboard, mais les invariants de somme (facture par facture vs agrégat arrondi) peuvent diverger de ±n/2 dinars. Ne pas comparer des agrégats arrondis à des sommes exactes dans les tests.
- Prisma `Decimal` converti par `Number(...)` partout — acceptable pour des montants < 2^53, pas de bug réel à ces magnitudes.

### "0 TND" partout

- `formatNumber(0)` → "0" + suffixe. C'est le comportement voulu du helper ; si le produit préfère "—" pour les montants nuls non renseignés, distinguer `null` (→ "—", déjà géré) de `0` réel (→ "0 TND", correct). Rien à corriger techniquement, décision produit.

---

## 5. Dates et fuseaux

| Point | Constat | Fichier:ligne | Risque |
|---|---|---|---|
| Bornes MTD/YTD | `startOf()` utilise le fuseau **local du serveur** (`d.setDate(1); d.setHours(0,0,0,0)`) | `executiveMetrics.repository.ts:11-17` | serveur Docker en UTC vs métier Africa/Tunis (UTC+1) : les paiements entre 23h00 et minuit (heure tunisienne) du dernier jour du mois basculent sur le mauvais mois |
| "141j de retard" | `Math.ceil((now - dueDate) / 86 400 000)` | `executiveMetrics.repository.ts:440` | `ceil` ajoute systématiquement 1 jour dès la première seconde de retard ; une facture due hier à 23h59 affiche "1j" à 00h01 (OK) mais une due il y a 140,1 jours affiche "141j". Convention à documenter ; `floor` serait plus conservateur |
| "Il y a 10j" | même pattern `ceil` sur `createdAt` des approbations | `executiveMetrics.repository.ts:453` | idem |
| Plage "05/06/2026 - 05/07/2026" | fenêtres glissantes `now ± n*86 400 000` ms | `:133-140` | insensible aux DST (la Tunisie n'applique plus l'heure d'été → OK aujourd'hui, fragile si ça change) |
| Comparaison MoM | `prevMtdEnd = mtdStart - 1 ms` compare un mois **complet** au mois **en cours partiel** | `:129-130` | -100% le 1er du mois à 00h01 est mathématiquement attendu mais trompeur ; comparer à "même jour du mois précédent" (pro-rata) serait plus honnête |
| `freshAt` | `toLocaleTimeString("fr-FR")` — heure du **navigateur**, pas du serveur | `DashboardPage.tsx:217` | OK en pratique (ISO string → local), juste locale FR en dur |

**Correctif prioritaire** : fixer `TZ=Africa/Tunis` dans l'environnement du serveur (docker-compose/env) pour aligner `startOf` avec la réalité métier, ou passer par `date-fns-tz`.

---

## 6. Suppression et cascades

Lecture de `server/prisma/schema.prisma` + services :

| Suppression de… | Effet | Verdict |
|---|---|---|
| **Client** | `Invoice → Cascade` (schema:936), `Payment → Cascade` via Invoice — **destruction de l'historique financier**. MAIS `client.service.ts:43-52` **bloque** la suppression si `invoiceCount > 0` (409, "archive instead") | ✓ garde-fou applicatif correct ; ⚠️ le garde-fou n'existe qu'en service — un `prisma.client.delete` direct (script, futur endpoint) détruirait les factures. Envisager `onDelete: Restrict` en DB |
| **Client** (suite) | `Project.clientId → SetNull` (schema:138) : les projets deviennent **orphelins** (sans client) et sortent des KPI client | ⚠️ voulu ? Un projet sans client est invisible dans ClientDetail et fausse `clientsWithProjects` |
| **Client** (suite) | `ServiceRequest`, `Proposal`, `Approval`, `ClientOnboarding`, `ClientSuccess → Cascade` | OK si suppression client = purge RGPD ; sinon archiver |
| **Projet** | `Task → Cascade` (355), `TimeEntry → Cascade` (1194), `Invoice.projectId → SetNull` (938), `Document.projectId → SetNull` (524), `ClientOnboarding → Restrict` (588) | ✓ cohérent : factures conservées, tâches purgées ; Restrict onboarding empêche la suppression d'un projet avec onboarding actif |
| **Facture** | `Payment → Cascade` (645), `CreditNote(source) → Cascade` (967), `InvoiceItem/Reminder → Cascade` | ✓ **corrigé au ré-examen** : `invoiceService.delete` (invoice.service.ts:111) refuse déjà les non-DRAFT côté serveur (409 INVOICE_NOT_DRAFT) — le constat initial visait le repository seul. Un DRAFT ne peut pas avoir de paiement via `addPayment` (le flux UI ne le propose que sur SENT/PARTIAL/OVERDUE) |
| **Document** | `document.service.ts:30-32` : suppression **DB uniquement** — le fichier S3/MinIO (`fileKey`) n'est **jamais supprimé** (`deleteFile` de `upload.service.ts:219` n'est appelé que par la route `/upload` DELETE) | ✗ fichiers orphelins accumulés dans le bucket. Correctif : dans `document.service.delete`, récupérer `fileKey` et appeler `uploadService.delete(fileKey)` (best-effort, après le delete DB) |
| **User** | `Notification`, `AiConversation`, `RefreshToken → Cascade` ; références métier (`assigneeId`, `recordedById`, `uploadedById`…) → `SetNull` | ✓ correct |

---

## 7. États vides par module

Clés `empty` présentes et traduites (FR+EN) après l'audit i18n :

| Module | Clé | Action associée | Verdict |
|---|---|---|---|
| Invoices | `invoices.empty` ("No invoices yet.") | bouton "Créer une facture" dans le header (pas dans l'état vide) | ✓ acceptable |
| Credit notes | `invoices.creditNotes.empty` | aucune (création via paiement excédentaire — normal) | ✓ |
| Documents | `documents.empty` | bouton "Ajouter un document" dans le header | ✓ |
| Proposals | `proposals.empty` + `commercial.proposals.empty` | CTA création dans toolbar | ✓ |
| Approvals | `approvals.empty` | — | ✓ |
| Notifications | `notifications.empty` | — | ✓ |
| Onboardings | `onboarding.empty` | — | ✓ |
| Talent (candidatures) | `applications.empty` | — | ✓ |
| Dashboard (risks) | `dashboard.noOverdue` (ajouté à l'audit i18n) | — | ✓ |
| CRM/Leads | kanban vide sans message dédié explicite | vérifier visuellement | ⚠️ à confirmer en démo |

Aucun module ne casse sur base vide (pas d'accès `[0]` non gardé détecté dans les pages listées). Le principal problème d'une base vide reste les KPI par défaut trompeurs (§1.5, §1.6).

---

## 8. Invariants métier à tester (suite de tests recommandée)

À implémenter comme tests d'intégration (Vitest + DB de test) :

1. **Overdue** : `finance.overdueAmount` = Σ `amount` des factures `status ∈ {SENT,PARTIAL,OVERDUE} AND dueDate < now` = Σ des items INVOICE_OVERDUE de `risks` (quand ≤ 10 factures) = `alerts.overdueInvoices` (count).
2. **Clients** : `active + (total - active) = total` ; `atRisk + lost + champions ≤ total` ; `retentionRate = 100 - churnRate` ; `churnRate = 0` quand `lost = 0`.
3. **Santé client exhaustive** : chaque client apparaît dans exactement une catégorie de santé (`at-risk | lost | champion | good`) — actuellement garanti par le `else if`, mais à re-tester après le correctif §1.2.
4. **Projets** : `planning + inProgress + review + completed = total` ; `completionRate = round(100 * completed / total)`.
5. **Cash** : `cashTotal` = Σ `payment.amount` = Σ `cashByMonth[].cash` (sur la fenêtre) ; `cashMTD ≤ cashYTD ≤ cashTotal`.
6. **Facturé vs payé** : pour toute facture, `amountPaid ≤ amount` et `amountPaid` = Σ de ses `payments.amount` (invariant à imposer par trigger applicatif dans `addPayment`).
7. **Scoping** : pour un MANAGER de service S, `GET /invoices` ∪ factures invisibles = ensemble des factures ADMIN ; aucune facture `projectId: null` ne doit exister si la règle "facture ⇒ projet" est retenue (§2, cause 2).
8. **Cache** : après `POST /invoices/:id/payments`, `GET /analytics/executive` reflète le paiement en < 1 s (test de l'invalidation à implémenter, §2 cause 1).
9. **Forecast** : `next30 ≤ next60 ≤ next90` ; avec 0 proposition, `next30` = Σ factures dues à 30j exactement (pas de part pipeline) — après correctif §1.6.
10. **Suppression** : supprimer une facture non-DRAFT → 409 ; supprimer un client avec factures → 409 ; supprimer un document → l'objet S3 `fileKey` n'existe plus (après correctif §6).
11. **Fuseaux** : un paiement enregistré le dernier jour du mois à 23h30 Africa/Tunis compte dans le bon mois (`cashMTD`) — test avec `TZ` forcé.
12. **cashByMonth.billed** : ≠ 0 dès qu'une facture non-DRAFT existe sur le mois (après correctif §1.7).

---

## 9. Priorisation des correctifs — **STATUT : appliqués le 2026-07-05**

| # | Correctif | Statut | Implémentation |
|---|---|---|---|
| 1 | Invalider le cache exec sur mutations (§2.1) | ✅ | cache exec taggé `dashboard`/`company` (`executiveMetrics.service.ts`) + `invalidateFinanceCaches()` dans create/update/delete/cancel/send/addPayment (`invoice.service.ts`) |
| 2 | Déplacer `newGrowthMoM` sur le bon tile (§1.1) | ✅ | growth déplacé sur le tile "Nouveaux clients (MTD)" (`DashboardPage.tsx`) |
| 3 | Refuser delete si non-DRAFT (§6) | ✅ déjà en place | `invoice.service.ts:111` le faisait déjà — constat initial corrigé (§6) |
| 4 | Supprimer le fichier S3 à la suppression d'un document (§6) | ✅ | `document.service.delete` supprime l'objet S3 best-effort, seulement si plus aucune version ne référence le `fileKey` |
| 5 | Compter at-risk et lost indépendamment (§1.2) | ✅ | compteurs découplés (`executiveMetrics.repository.ts`) — le churn voit désormais les clients perdus même s'ils sont aussi at-risk ; badge `health` inchangé (at-risk prioritaire) |
| 6 | Règle unique factures sans projet (§2.2) | ✅ | règle retenue : facture sans projet = **service-neutre, visible par tous les managers**. Appliquée dans `findAllByServiceId`, `assertInvoiceInScope`, `dashboard.service` (overdue manager) et santé client exec (fetch des factures client-level `projectId: null`). Constat aggravant : `CreateInvoiceDialog` n'envoie jamais de `projectId` — avant ce fix, **toute facture créée via l'UI était invisible pour les managers** |
| 7 | `TZ=Africa/Tunis` serveur (§5) | ✅ | documenté dans `server/.env.example` (à reporter dans l'env de prod) |
| 8 | Badge "en retard" dérivé dans la liste factures (§2.3) | ✅ | `InvoicesPage.tsx` : SENT/PARTIAL avec `dueDate < now` affiche le badge OVERDUE |
| 9 | Split seed core/demo (§3) | ✅ | flag `SEED_DEMO` (opt-out) : `SEED_DEMO=false` → seed minimal (company, services, admin, profils, CMS) ; défaut = démo complète pour le dev |
| 10 | Corriger `cashByMonth.billed` (§1.7) | ✅ | requête factures 13 mois agrégée dans la série mensuelle |
| 11 | Exclure projets sans tâche du "stale" (§1.8) | ✅ | `tasks: { some: {} }` ajouté à la requête + `isStale=false` sans tâche dans le health loop |
| 12 | Forecast sans convRate par défaut (§1.6) | ✅ | 0 proposition historique → convRate 0, forecast = factures dues uniquement |

Vérification : `tsc --noEmit` propre côté serveur et client après application.
