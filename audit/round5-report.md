# Audit Round 5 — Vérification des correctifs Round 4, reconstitution des volets perdus (Round 2/3), nouveaux domaines — Secritou

> Contexte : Round 4 a corrigé 11 points dans la même session (3 Élevée, 5 Moyenne, 3 Faible/latente) et a explicitement exclu C1-C7 et la conformité produit (documents CEO perdus). Ce round 5 (2026-07-11) : (1) revérifie les 11 correctifs Round 4 sur le code actuel, (2) reconstruit B1 (conformité produit) et B2 (domaines Round 3) à partir des définitions exactes fournies en amont de cette session, (3) ouvre 7 nouveaux domaines C1-C7 jamais audités. **Découverte majeure de cette session : une base Postgres locale réelle est accessible via `DATABASE_URL` (server/.env) et a permis une vérification empirique — ce qui a révélé un bug critique invisible à la seule lecture du code (voir Rapport 1, point DB-DRIFT).**

---

## Rapport 1 — Vérification des correctifs Round 4

### Méthode empirique utilisée dans cette session
Contrairement au Round 4 (qui n'avait "pas de base de données de test/dev interrogeable"), **Postgres était réellement démarré sur `localhost:5432`** (confirmé par `Test-NetConnection` et connexion Prisma réussie). Requêtes réelles exécutées : `client.count()` (4), `invoice.count()` (0), `project.count()` (0), `lead.count()` (12), `service.findMany()` (4 services), plus une tentative de réconciliation SQL directe (`payment.aggregate` filtré par `deletedAt`) et une inspection `information_schema.columns` + `_prisma_migrations` + `prisma migrate diff`.

### Statuts des 11 correctifs nommés

| # | Correctif | Fichier + ligne | Statut |
|---|---|---|---|
| 1 | `GET /summary/dashboard` scopé par serviceId MANAGER + cache bypass si scopé | `server/src/controllers/summary.controller.ts:35-36` (`buildServiceScope` si `role === "MANAGER"`, passé à `summaryService.getEnhancedDashboardSummary(scope?.userServiceId)`) ; `summary.service.ts:33-38` (si `serviceId !== undefined`, retourne directement `summaryRepository.getEnhancedDashboardSummary(serviceId)` **sans passer par le cache global**, commentaire explicite ligne 34-35) ; `summary.repository.ts:103-179` (`getEnhancedDashboardSummary(serviceId?)` construit `projectScope`/`leadWhere`/`invoiceWhere` conditionnés par `serviceId`, appliqués à `lead.groupBy`, `client.count`, `project.groupBy`, `task.groupBy`, `invoice.aggregate`) | ✅ Corrigé — lu ligne à ligne, cohérent avec le pattern déjà utilisé par `dashboard.service.ts`/`executiveMetrics.service.ts`. |
| 2 | `deletedAt: null` sur client/project dans executiveMetrics/clientProfitability/revenueForecast | `executiveMetrics.repository.ts:129-134` (`projectScope`/`clientActiveScope`), appliqué systématiquement à tous les `payment.aggregate`/`invoice.aggregate`/`client.count`/`client.findMany` du fichier (lignes 202-291, ~20 occurrences vérifiées) ; `clientProfitability.repository.ts:33,38,51` ; `revenueForecast.repository.ts:47-48,98-99,110-111` | ✅ Corrigé — les 3 fichiers filtrent désormais systématiquement `deletedAt: null` côté Invoice/Payment/Client/Project. **Mais voir DB-DRIFT ci-dessous : ce correctif est actuellement non fonctionnel contre la base réelle du dépôt (colonne absente).** |
| 3 | URL signée 7 jours retirée de l'API liste/détail, front migré vers `getDownloadUrl` | `document.controller.ts:17-20` (`redactStorageUrl`, retire `url`/`fileUrl` de toute réponse liste/détail, commentaire explicite lignes 13-16) ; `document.service.ts:94-100` (`getDownloadUrl` re-vérifie le scope via `documentRepository.findById(id, viewer)` puis mint un lien à TTL court `getSignedReadUrl(doc.fileKey, 3600)`) ; balayage exhaustif de `client/src` pour `doc.url`/`document.url`/`.fileUrl`/`invoice.pdfUrl`/`proposal.pdfUrl` : **0 résultat** | ✅ Corrigé et généralisé — le pattern dangereux a bien disparu de tout `client/src`, pas seulement de `DocumentsPage.tsx` (zone d'ombre Round 4 comblée). |
| 4 | Filtre parent (project/client) soft-supprimé dans task.repository.ts/invoice.repository.ts | `task.repository.ts:24-25,72-92` (`project: { deletedAt: null }` sur toutes les branches `buildWhere`/`findById`) ; `invoice.repository.ts:27,56,84-86,115` (`client: { deletedAt: null }` sur `findAll`, presque partout) | ✅ Corrigé pour l'essentiel. ⚠️ Reste un angle mort mineur : `invoice.repository.ts:56` (`findAllByClientId`, utilisée pour le portail client) ne filtre **pas** `client: { deletedAt: null }` — appelée avec un `clientId` déjà connu/scopé, donc risque résiduel très faible (un client soft-supprimé qui se reconnecterait encore verrait ses propres factures), non bloquant mais à aligner par cohérence. |
| 5 | PDF facture régénéré/flag stale après modif line items | Nouvelle migration `20260711175430_document_invoice_id` (`Document.invoiceId` nullable FK) ; `documentGenerator.service.ts` stampe `invoiceId` sur le PDF généré ; `invoice.service.ts` : `assertInvoicePdfNotGenerated()` (grep confirmé, appelée avant `update`/`addItem`/`updateItem`/`deleteItem`/`addItemsFromTimeEntries`) lève 409 si un Document déjà généré référence la facture | ✅ Corrigé — mécanisme différent de ce qu'imaginait Round 4 ("régénération auto") mais fonctionnellement équivalent et plus sûr : bloque la modification plutôt que de risquer un PDF désynchronisé. **Non testé empiriquement (aucune facture en base, `invoice.count()` = 0) — vérification structurelle uniquement.** |
| 6 | `GET /upload/signed-url` — vérification de propriété | Route et contrôleur entièrement supprimés : `grep -rn "signed-url" server/src/routes server/src/controllers server/src/validators client/src` → **0 résultat** | ✅ Corrigé par suppression complète (option plus radicale que "ajouter une vérification de propriété", mais élimine la surface d'attaque entièrement puisque la route n'était jamais appelée par le front — cohérent avec le résumé fourni). |
| 7 | `requirePermission("freelancers", ...)` ajouté | `server/src/routes/freelancer.routes.ts:13,23` : `requirePermission("freelancers", "read")` ajouté sur `GET /` et `GET /:id`, en plus de `authorize(...)` existant | ✅ Corrigé. |
| 8 | Échappement HTML dans emailTemplates | `server/src/services/emailTemplates/base.ts:7` (fonction `esc()`) ; usage confirmé `server/src/services/emailTemplates/index.ts` : 85 occurrences de `esc(...)` (grep -c) | ✅ Corrigé, application large (85 usages, pas un cas isolé). |
| 9 | `INTEGRATIONS_ENCRYPTION_KEY` validée au démarrage | `server/src/config/env.ts:67` (toujours `.optional()` dans le schéma zod) + `env.ts:96-118` : garde-fou explicite ajoutée — si `GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI` sont définies, vérifie que `INTEGRATIONS_ENCRYPTION_KEY` existe et décode en exactement 32 octets (base64 ou hex), sinon `throw` au boot (lignes 103-116) | ✅ Corrigé — comportement exactement conforme à la demande. |
| 10 | `$executeRawUnsafe` durci dans maintenance.processor.ts | `maintenance.processor.ts:32-35` (commentaire explicite "ne jamais rendre ARCHIVE_RULES configurable sans allowlist") ; `ensureMonthlyPartitions` (lignes 88-96) : `rangeStart`/`next` passés comme paramètres liés `$1`/`$2` (`FOR VALUES FROM ($1::date) TO ($2::date)`) au lieu d'interpolation de chaîne | ✅ Corrigé. |
| 11 | `idempotencyKey` systématiquement envoyé par le front (AddPaymentDialog) | `client/src/features/invoices/components/AddPaymentDialog.tsx:64` (`idempotencyKeyRef = useRef(crypto.randomUUID())`), `:86` (transmis dans le payload `addPayment`), `:69` (régénéré après soumission) ; `invoices.api.ts:139` (`idempotencyKey?: string` dans la signature) | ✅ Corrigé et confirmé fonctionnellement câblé de bout en bout côté front — comble la zone d'ombre Round 4 ("non vérifié si le front fournit systématiquement idempotencyKey"). **Mais voir DB-DRIFT : la colonne `Payment.idempotencyKey` n'existe pas dans la base réelle du dépôt.** |

### 🆕 DB-DRIFT — Découverte critique de cette session : schema.prisma désynchronisé des migrations réelles

**Sévérité : Élevée.** En tentant la réconciliation numérique demandée (zone d'ombre B3), une requête Prisma réelle a échoué :
```
The column `j0.deletedAt` does not exist in the current database.
```
Investigation complète :
- `npx prisma migrate status` rapporte **"Database schema is up to date!"** (26 migrations trouvées et appliquées, `_prisma_migrations` confirme même l'application de la toute dernière migration `20260711175430_document_invoice_id`, exécutée il y a quelques minutes).
- Pourtant, `information_schema.columns` interrogée en direct sur la table `Invoice` **ne contient pas** la colonne `deletedAt` (21 colonnes listées, aucune `deletedAt`). Idem pour `Project` (pas de `deletedAt` — seul `archivedAt` existe) et `Payment` (pas de `idempotencyKey`).
- Recherche exhaustive dans **tous** les fichiers `.sql` de `server/prisma/migrations/` : aucune migration ne contient `ALTER TABLE "Invoice" ADD COLUMN "deletedAt"`, ni `"Project" ADD COLUMN "deletedAt"`, ni `"Payment" ADD COLUMN "idempotencyKey"`. Seul `Client` a une vraie migration pour son `deletedAt` (`20260708080000_client_archived_deleted_at/migration.sql:3`).
- `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` confirme un **drift réel** : le script de diff généré contient explicitement `ALTER TABLE "Invoice" ADD COLUMN "deletedAt" TIMESTAMPTZ(6)`, `ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMPTZ(6)`, `ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" VARCHAR(255)` + les index/contraintes uniques associés — c'est-à-dire que `schema.prisma` déclare ces colonnes mais **aucune migration ne les a jamais créées**.
- `git status --short server/prisma/schema.prisma` confirme que `schema.prisma` est **modifié dans l'arbre de travail par rapport au dernier commit** (731 insertions / 460 suppressions) — cohérent avec un édit manuel du schéma pendant la session de correctifs Round 4, sans exécution de `prisma migrate dev` pour générer la migration correspondante. De nombreux fichiers de migration existants (`20260708000000_invoice_vat_breakdown` et onze autres) sont eux-mêmes **non trackés par git** (`??` dans `git status`), suggérant que plusieurs sessions récentes ont accumulé des migrations locales jamais commitées, en parallèle d'éditions manuelles du schéma qui n'ont pas toutes été suivies d'une migration.

**Impact réel** : les correctifs Round 4 #2 (`deletedAt` sur Invoice/Project) et #11 (`idempotencyKey` sur Payment) sont **corrects au niveau du code TypeScript et du schéma déclaratif**, mais **provoqueraient une erreur Prisma en exécution réelle** (`column does not exist`) sur toute base construite en rejouant les migrations de ce dépôt depuis zéro (`prisma migrate deploy`) — y compris un environnement de production qui suivrait le processus standard. Le fait que `prisma migrate status` affiche "up to date" est trompeur : cette commande compare la table `_prisma_migrations` au dossier `migrations/`, pas au schéma déclaratif `schema.prisma` — elle ne détecte donc pas ce type de drift.

**Recommandation immédiate** : exécuter `npx prisma migrate dev --name fix_invoice_project_deletedat_payment_idempotency` (ou équivalent) pour générer et committer la migration manquante, puis vérifier `prisma migrate diff` retourne un script vide. Avant tout déploiement, auditer l'ensemble des migrations non commitées (`git status` liste 17 dossiers `??`) pour s'assurer qu'elles sont bien voulues et cohérentes entre elles.

### Zones d'ombre Round 4 — statut après cette session
- **Réconciliation numérique dashboard (B3)** : partiellement possible cette fois (DB réelle accessible, contrairement au Round 4) — mais bloquée net par le bug DB-DRIFT ci-dessus dès la première requête filtrée par `deletedAt`. Les chiffres bruts obtenus sans ce filtre : 4 clients, 0 invoice, 0 project, 12 leads, 4 services — le jeu de données est trop pauvre (aucune facture/projet) pour une réconciliation ligne-à-ligne significative même une fois la colonne réparée. Réconciliation complète impossible dans cette session pour deux raisons cumulées : bug de colonne manquante + absence de données de facturation réelles en base.
- **idempotencyKey front** : confirmé câblé (voir #11 ci-dessus) — comblé.
- **SPF/DKIM/DMARC** : toujours hors du périmètre du code source, non vérifiable depuis ce dépôt. Domaine `contact@secritou.tn` désormais cohérent dans le code (`email.service.ts`, `env.ts`, `.env.example` — confirmé aligné avec le résumé fourni), mais la configuration DNS réelle (SPF/DKIM/DMARC) reste une action infra externe à documenter séparément.

---

## Rapport 2 — Volets perdus reconstitués (B1 conformité produit, B2 domaines Round 3)

### B1 — Conformité au cadrage produit (documents CEO)

| Point | Verdict | Preuve |
|---|---|---|
| **1. Noms des 4 pôles** | ⚠️ Partiel / 🆕 nouveau problème | `server/prisma/seed.ts:44` définit les noms **exactement conformes** au cadrage (`Management & Performance`, `Croissance digitale`, `Technologie`, `IA & Automatisation`). Mais la **base de données réelle** (requête live confirmée dans cette session) contient : `Business Performance`, `Digital Growth`, `Technology Solutions`, `AI & Automation` — des paraphrases anglaises non conformes, ni dans la langue ni dans le libellé exact du cadrage. Le code de seed est conforme ; la donnée réelle en base ne l'est pas — signe d'une dérive (seed rejoué avec un ancien contenu, script ad hoc, ou édition manuelle post-seed via l'UI admin). |
| **2. Activation du portail client** | ❌ Non conforme | `proposal.service.ts` (`acceptWithCascade`, ~ligne 391-397) appelle `clientService.inviteClientUser()` **immédiatement** à l'acceptation de la proposition, indépendamment de tout paiement. `client.service.ts:80-96` (`inviteClientUser`) crée directement un `User` `role: "CLIENT"` et envoie l'email d'invitation avec mot de passe temporaire. Aucun champ `portalActivatedAt` (ou équivalent) n'existe dans `schema.prisma` (grep confirmé sur `model User`/`model Client`). Le cadrage (§6) exige explicitement "paiement 1re tranche = ouverture de l'espace client" — le code actuel ouvre l'espace client dès l'acceptation, avant tout paiement réel (la facture d'acompte 30% est bien créée dans la même transaction, mais son règlement n'est jamais une condition d'activation). |
| **3. Rapport mensuel client** | ❌ Non conforme | Seul job périodique de type "rapport" trouvé : `weeklyCeoReport` (`ceoAlerts.processor.ts`), envoyé aux **admins/CEO**, pas aux clients. Aucun job/mécanisme de "rapport mensuel client" n'existe — la "Mesure des résultats" (§6) repose uniquement sur le dashboard live (HealthBoard, pages client-portal), pas sur le rapport mensuel explicitement requis en complément. |
| **4. Base de calcul commission / évolution 60→50** | ℹ️ Non tranché dans le doc source, donc pas un écart — précision utile | `commission.service.ts` (`computeForPaymentTx`) calcule sur `amountReceived` (CA brut encaissé, aucune déduction de coût). `ProjectCommissionSplit.ratePct` est un champ **manuel par projet**, sans aucune formule d'évolution temporelle automatique 60/40→50/50. Comme le cadrage laisse ces deux points explicitement ouverts, ce n'est pas un écart — mais le choix implicite du code (CA brut, 100% manuel) mérite une validation CEO formelle. |
| **5. Sélecteur de devise autre que TND** | ⚠️ Partiel (risque latent, pas actif) | `client/src/lib/currencies.ts` définit `SUPPORTED_CURRENCIES = ["TND","EUR","USD"]` mais cette constante n'est **utilisée nulle part** dans l'UI (aucun `<select>` de devise trouvé dans `CreateInvoiceDialog.tsx` ou ailleurs — tout référence uniquement `DEFAULT_CURRENCY` = TND). Code mort actuellement inoffensif, mais représente un risque si jamais branché par erreur. |
| **6. LegalPage.tsx bilingue FR/EN** | ✅ Conforme | `client/src/features/landing/pages/LegalPage.tsx` utilise `useTranslation()`, aucun texte français en dur — toutes les chaînes passent par `t("legalPage.*")`. Clés présentes en `fr/translation.json` et `en/translation.json`. Conforme au critère de réception §9. |
| **7. Ambiguïté conversionRate** | ✅ Conforme (pas d'ambiguïté) | Deux métriques distinctes existent (`leadConversionRate` dans `analytics.repository.ts`, funnel commercial ; `conversionRate` scopé dans `analyticsEvent.service.ts`, funnel web CTA→contact) mais portent des noms/scopes différents dans le code — pas de collision réelle sur un même identifiant utilisé pour deux sens différents. |

### B2 — Domaines Round 3 reconstruits

| Domaine | Verdict | Résumé de preuve |
|---|---|---|
| **Sessions/tokens** | ✅ Majoritairement sain, ⚠️ un point | Access 15 min, refresh 7j stocké en DB (`env.ts:13-14`). Rotation avec détection de réutilisation et révocation de toute la famille de tokens (`auth.service.ts:97-132`) — implémentation correcte. Logout révoque réellement côté serveur (`auth.service.ts:141-147`). Changement de mot de passe et reset password invalident toutes les sessions (`refreshToken.deleteMany`). **Point ouvert** : un changement de **rôle** (`user.service.ts:54-61`) ne révoque aucune session — fenêtre de 15 min max avec l'ancien rôle actif dans le JWT déjà émis. |
| **Dépendances (npm audit)** | ✅ Sain | 3 vulnérabilités identiques server/client (workspace partagé) : 1 low (`esbuild`, dev-server only, non exploitable en prod), 2 moderate (`uuid` transitif via `exceljs`, mais `exceljs` jamais importé dans `server/src` — code mort du point de vue du risque). Aucune vulnérabilité high/critical. |
| **Audit trail** | ❌ Absent | Aucun modèle `AuditLog`/`ActivityLog` dans `schema.prisma` (confirmé absent). Aucune des 5 actions sensibles définies (suppression client, changement de rôle, annulation facture, commission payée, permission MANAGER) n'a de trace immuable dédiée au-delà de la mise à jour de la ligne elle-même — seule la commission bénéficie d'une trace indirecte et mutable via `Notification`. |
| **Données personnelles / RGPD-like** | ⚠️ Partiel | Aucun mécanisme d'export/suppression sur demande. Aucune fuite de secret en clair dans les logs (grep exhaustif). Leads archivés à 30j (pas supprimés), mais **aucune politique de rétention pour les candidatures freelancer rejetées** — conservées indéfiniment. |
| **Accessibilité publique** | ✅ Sain | `ContactPage.tsx`/`BookingCalendar.tsx` : labels correctement associés (`htmlFor`/`id` cohérents), boutons natifs (pas de `div onClick`), erreurs annoncées via `role="alert"`/`aria-invalid`/`aria-describedby`, honeypot anti-bot bien implémenté (`tabIndex={-1}`, `aria-hidden`). |
| **Secrets/config** | ✅ Sain, ⚠️ un point seed | Aucun secret sensible (JWT, clé de chiffrement, OAuth) avec fallback hardcodé silencieux — `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` obligatoires (`z.string().min(32)` sans `.default()`), garde explicite contre les placeholders connus en prod (`env.ts:80-93`). **Point ouvert** : `seed.ts:97-101` crée le compte `admin@secritou.tn`/`admin123` **même avec `SEED_DEMO=false`**, sans garde-fou empêchant l'exécution du seed contre une base de production. |

*(Rapport détaillé complet de B2 avec toutes les citations fichier+ligne : voir `audit/12-round5-b2-security.md`, produit dans cette même session par l'agent dédié à ce domaine — conservé séparément car exhaustif.)*

---

## Rapport 3 — Nouveaux domaines C1-C7

> Vérification basée exclusivement sur lecture structurelle du code (pas de trafic HTTP réel exécuté, pas de scan antivirus réel sur un polyglotte, pas de test de charge sur le rate limiting).

| Domaine | Verdict | Résumé |
|---|---|---|
| **C1. CORS/Helmet/cookies** | ✅ Sain | `app.ts` : `cors({ origin: env.FRONTEND_URL, credentials: true })` — origine unique stricte, pas de wildcard. Helmet configuré (CSP `defaultSrc 'self'`, `frameAncestors: ["'none'"]`, HSTS hors dev, `X-Content-Type-Options`). Cookie refresh token : `httpOnly: true`, `secure` en prod, `sameSite: "strict"` (`authCookies.ts`). |
| **C2. Upload polyglotte** | ⚠️ Partiel | Double contrôle (MIME déclaré + `fileTypeFromBuffer` sur les octets réels) — robuste contre un simple mismatch de type. Mais un polyglotte valide en tant que conteneur PDF/ZIP (payload additionnel après `%%EOF`, ou JS dans un `.docx`) passerait car le format de tête reste valide — `file-type` ne fait pas d'inspection de contenu profonde. Au téléchargement, aucun `Content-Disposition: attachment` forcé (`upload.service.ts`/`document.service.ts:94-100`) — dépend du comportement par défaut du navigateur pour le rendu inline. |
| **C3. Injection CSV/Excel** | ❌ Non conforme | `client/src/features/reports/exportExcel.ts` écrit `lead.name`/`project.description` directement dans les cellules ExcelJS **sans vérifier/échapper** un préfixe `=`/`+`/`-`/`@` — injection de formule classique possible si un lead/projet a un nom malveillant. |
| **C4. Rate limiting** | ⚠️ Partiel (conditionnel à l'infra) | 7 limiteurs bien répartis par endpoint (`rateLimit.middleware.ts`). Endpoints publics non authentifiés (contact, candidature, analytics event) reposent sur IP seule. `app.set("trust proxy", 1)` uniquement en prod — cohérent seulement si un unique reverse-proxy de confiance est réellement en amont ; non vérifiable depuis ce dépôt (infra non documentée ici). |
| **C5. Webhooks** | ✅ Non applicable | Recherche exhaustive de "webhook" sur tout `server/src` : 0 résultat. Aucune route de réception de webhook externe n'existe dans ce codebase. |
| **C6. Fuseaux horaires** | ⚠️ Partiel / 🆕 nouveau problème | Stockage UTC confirmé (`@db.Timestamptz(6)` partout). `dateRange.ts` définit un helper correctement Tunis-aware (`Africa/Tunis` via `Intl.DateTimeFormat`), utilisé par `analytics.repository.ts`. **Mais** `executiveMetrics.repository.ts` (déclaré "Single Source of Truth for all KPIs") définit son **propre** `startOf()` naïf basé sur `setHours()`/`setMonth()` — fuseau serveur (probablement UTC), pas Tunis. Deux définitions différentes de "début de mois" cohabitent entre l'écran Analytics et l'écran Exécutif/CEO. De plus, les cron BullMQ (`jobs/index.ts`) n'ont **aucune option `tz`** — un job "8h" tourne en réalité à l'heure serveur, décalage d'1h si le serveur est en UTC (Tunisie = UTC+1 fixe, pas de DST depuis 2009). |
| **C7. Fraîcheur cache React Query** | ✅ Majoritairement sain, ⚠️ deux points | Le flux paiement (le plus sensible, cf. Round 4 point 6) est correctement instrumenté : `useAddInvoicePayment` invalide `["invoices"]`/`["dashboard"]`/`["analytics"]` en `onSuccess` (`useInvoices.ts`) — pas de risque de double-paiement par état périmé. **Mais** `useUpdateTask` (`useTasks.ts`) n'invalide que `["tasks"]`, pas `["dashboard"]` ; les mutations d'approbation (`useApprovals.ts`) n'invalident que `["approvals"]`, jamais un éventuel badge/dashboard — staleness possible sur des compteurs annexes (non confirmé si de tels compteurs dépendants existent réellement dans l'UI). |

---

## Synthèse consolidée finale — items réellement ouverts (Round 1 à 5)

> Triée par sévérité réelle. Pour chaque item, le round de dernière vérification est précisé. Les items marqués "Round 4 ✅" ou "Round 5 ✅" ne sont **pas** listés ici (considérés clos sauf mention contraire).

### Sévérité Critique (nouveau)
1. **Désynchronisation `schema.prisma` / migrations réelles (Invoice.deletedAt, Project.deletedAt, Payment.idempotencyKey absents de la DB malgré `prisma migrate status` "up to date")** — bloque en exécution réelle deux correctifs Round 4 (#2 deletedAt, #11 idempotencyKey). Trouvé Round 5. À corriger en priorité absolue avant tout déploiement (générer la migration manquante).

### Sévérité Élevée
2. **Activation du portail client non conditionnée au paiement de la 1re tranche** — `proposal.service.ts` (`acceptWithCascade`), `client.service.ts:80-96`. Écart direct au parcours client §6 du cadrage. Trouvé Round 5 (B1, volet perdu reconstruit).
3. Aucune trace d'audit immuable pour les actions sensibles (suppression client, changement de rôle, annulation facture, commission payée, permission MANAGER). Trouvé Round 5 (B2, volet perdu reconstruit).
4. Injection de formule CSV/Excel non échappée dans `exportExcel.ts`. Trouvé Round 5 (C3, nouveau domaine).

### Sévérité Moyenne
5. Task/Invoice listing : angle mort résiduel mineur sur `invoice.repository.ts:56` (`findAllByClientId` sans filtre `client.deletedAt`). Trouvé Round 5 (vérification Round 4 #4).
6. Changement de rôle ne révoque pas les sessions actives (fenêtre 15 min). Trouvé Round 5 (B2).
7. Aucune politique de rétention pour les candidatures freelancer rejetées. Trouvé Round 5 (B2).
8. Compte admin de seed (`admin@secritou.tn`/`admin123`) créé même avec `SEED_DEMO=false`, sans garde-fou anti-prod. Trouvé Round 5 (B2).
9. Rapport mensuel client absent (seul le dashboard live existe), écart au §6 du cadrage. Trouvé Round 5 (B1).
10. Noms des 4 pôles en base réelle non conformes au cadrage (paraphrases anglaises vs noms français exacts du seed). Trouvé Round 5 (B1).
11. Upload : pas de `Content-Disposition: attachment` forcé au téléchargement ; risque de rendu inline d'un polyglotte. Trouvé Round 5 (C2).
12. Incohérence de fuseau horaire entre `executiveMetrics.repository.ts` (naïf, fuseau serveur) et `dateRange.ts`/`analytics.repository.ts` (Tunis-aware) pour les bornes MTD/YTD. Trouvé Round 5 (C6, nouveau domaine).
13. Cron BullMQ sans option `tz` — décalage d'1h potentiel sur les jobs "horaires métier" si serveur en UTC. Trouvé Round 5 (C6).
14. `trust proxy: 1` en production — dépend d'une infra à un seul reverse-proxy de confiance, non vérifiable depuis le dépôt. Trouvé Round 5 (C4).
15. `useUpdateTask`/mutations d'approbation n'invalident pas `["dashboard"]` — staleness possible sur des compteurs annexes (non confirmé si un tel compteur existe). Trouvé Round 5 (C7).
16. Aucun mécanisme GDPR-like d'export/suppression sur demande. Trouvé Round 5 (B2).
17. Sélecteur de devises EUR/USD mort dans `client/src/lib/currencies.ts`, jamais branché mais présent. Trouvé Round 5 (B1).

### Sévérité Faible / latente
18. `esbuild`/`uuid` : 3 vulnérabilités npm (1 low, 2 moderate), non exploitables dans le contexte actuel. Trouvé Round 5 (B2).
19. Upload polyglotte (conteneur PDF/ZIP valide + payload additionnel) non détecté par le sniffing magic-byte seul — risque résiduel partiellement mitigé par C2/Content-Disposition. Trouvé Round 5 (C2).
20. SPF/DKIM/DMARC du domaine d'envoi réel — hors code, non vérifiable depuis ce dépôt. Confirmé toujours ouvert Round 4 et Round 5.

### Points confirmés clos (ne pas rouvrir sans nouvelle preuve)
- Les 11 correctifs Round 4 nommés (sauf le sous-point DB-DRIFT rattaché à #2/#11 ci-dessus) : ✅ Round 5.
- `addPayment` sur facture CANCELLED, fuite `hourlyRate`, scope MANAGER sur Approval, `applyCredit`, rotation refresh token, logout server-side, reset password : ✅ Round 4, reconfirmés Round 5 sans nouvelle lecture complète (non contredits).
- LegalPage bilingue FR/EN, absence d'ambiguïté `conversionRate`, accessibilité des formulaires publics, absence de webhook, CORS/Helmet/cookies : ✅ Round 5 (première vérification, items nouvellement ouverts par ce round).

---

## Section "Non vérifié / zones d'ombre" actualisée

- **Réconciliation numérique complète du dashboard exécutif** : toujours impossible à finaliser — bloquée par le bug DB-DRIFT (colonne manquante) ET par l'absence de données de facturation réelles en base (0 invoice, 0 project). Une fois la migration corrigée, cette réconciliation devra être refaite avec un jeu de données de test plus riche (au moins quelques factures/paiements/projets) pour être significative.
- **SPF/DKIM/DMARC** : hors du code source, toujours non vérifiable depuis ce dépôt — action infra à documenter séparément.
- **Composant `Calendar` interne** (`@/components/ui/calendar`) utilisé par `BookingCalendar.tsx` : non audité directement pour l'accessibilité clavier stricte (hors périmètre des deux fichiers ciblés par B2 tâche 5).
- **Revalidation du rôle utilisateur en base à chaque requête** (au-delà du rôle signé dans le JWT) : non vérifiée précisément — pertinente pour évaluer la fenêtre d'exposition exacte du point "changement de rôle" (item 6 de la synthèse).
- **Schéma `FreelancerApplication`** : non relu en détail pour confirmer l'absence de champ de rétention/expiration au niveau modèle (le constat repose sur l'absence de job de purge, pas sur une relecture du schéma).
- **Existence réelle d'un badge de notification/compteur dashboard dépendant des approbations/tâches** (item 15 de la synthèse) : la staleness potentielle du cache React Query n'a pas été confirmée avec certitude car l'existence même du composant consommateur (badge) n'a pas été vérifiée dans cette session.
- **Test réel d'un fichier polyglotte** (upload) : analyse structurelle uniquement, aucun fichier de test réellement uploadé/téléchargé dans cette session.
- **Infra de déploiement réelle** (nombre de reverse-proxies, CDN) pour évaluer C4/`trust proxy` avec certitude : non vérifiable depuis ce dépôt.
- **17 dossiers de migration non trackés par git** (`git status` confirme `??` sur `20260708000000_invoice_vat_breakdown` et onze autres) : leur cohérence mutuelle et leur caractère "prêt à committer" n'a pas été auditée exhaustivement au-delà du point DB-DRIFT ; une revue git dédiée de `server/prisma/migrations/` est recommandée avant tout commit/déploiement.

---

## Méthodologie

### Base de données réelle utilisée dans cette session
**Oui, contrairement au Round 4.** Postgres local démarré et accessible (`localhost:5432`, confirmé par `Test-NetConnection`). Connexion Prisma réelle établie via un script Node temporaire (`server/checkdb.mjs`, `reconcile.mjs`, `checkcol.mjs`, `checkcol2.mjs`, `checkmig.mjs` — tous supprimés après usage, non commités). Requêtes exécutées : comptages (`client`, `invoice`, `project`, `lead`), liste des `Service`, tentative d'agrégat `Payment` filtré par `deletedAt` (a échoué et révélé DB-DRIFT), inspection `information_schema.columns` sur `Invoice`/`Project`/`Payment`/`ApprovalTimeline`, lecture de `_prisma_migrations`, et `npx prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script`. Données réelles trouvées : 4 clients, 0 invoice, 0 project, 12 leads, 4 services (noms non conformes au cadrage, cf. B1 point 1).

### Répartition du travail dans cette session
Trois agents dédiés lancés en parallèle après la vérification directe de Partie A (Round 4) et la découverte DB-DRIFT :
- **Agent B1** : conformité produit (7 points du cadrage CEO), lecture complète de `proposal.service.ts`, `client.service.ts`, `commission.service.ts`, `seed.ts`, `currencies.ts`, `LegalPage.tsx`, grep exhaustif `conversionRate`.
- **Agent B2** : sessions/tokens (`auth.service.ts` intégral), `npm audit` réel (4 commandes, server+client × avec/sans dev), audit trail (schema.prisma grep + 5 handlers), RGPD/logs/rétention, accessibilité (`ContactPage.tsx`/`BookingCalendar.tsx` intégraux), secrets/config (`env.ts` intégral, `seed.ts` quasi-intégral). Rapport détaillé complémentaire produit dans `audit/12-round5-b2-security.md`.
- **Agent C1-C7** : `app.ts`, `authCookies.ts`, `upload.service.ts`, `document.service.ts`, `rateLimit.middleware.ts`, `exportExcel.ts`, `dateRange.ts`, `executiveMetrics.repository.ts`, `jobs/index.ts`, `useInvoices.ts`/`useTasks.ts`/`useApprovals.ts`.

### Fichiers lus intégralement ou quasi-intégralement dans cette session (vérification directe Partie A)
- `server/src/services/summary.service.ts` (52 lignes), `summary.controller.ts` (41 lignes), `summary.repository.ts` (180 lignes)
- `server/src/repositories/executiveMetrics.repository.ts`, `clientProfitability.repository.ts`, `revenueForecast.repository.ts` (greps ciblés + lecture des sections d'agrégats)
- `server/src/controllers/document.controller.ts` (101 lignes, intégral), `server/src/services/document.service.ts` (101 lignes, intégral)
- `server/src/repositories/task.repository.ts`, `invoice.repository.ts` (greps ciblés + lecture des sections pertinentes)
- `server/src/jobs/processors/maintenance.processor.ts:70-115` (extraits ciblés)
- `server/src/routes/freelancer.routes.ts` (grep intégral)
- `server/src/config/env.ts` (extraits ciblés sur INTEGRATIONS_ENCRYPTION_KEY)
- `client/src/features/invoices/components/AddPaymentDialog.tsx` (grep ciblé, lignes 64-86)
- `server/prisma/schema.prisma` (lecture du modèle Invoice complet, greps exhaustifs sur deletedAt)
- Tous les fichiers `.sql` de `server/prisma/migrations/` (grep exhaustif pour `deletedAt`/`idempotencyKey` sur Invoice/Project/Payment)

### Non couvert / hors périmètre de cette session
- Aucun test de charge réel sur le rate limiting (C4) — analyse structurelle uniquement.
- Aucun upload réel d'un fichier polyglotte de test (C2) — analyse structurelle du code de validation uniquement.
- SPF/DKIM/DMARC (hors code source).
- Infrastructure de déploiement réelle (nombre de reverse-proxies) pour trancher C4 avec certitude.
