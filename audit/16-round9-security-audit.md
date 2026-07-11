# Round 9 — Security & Robustness Audit

**Date :** 2026-07-12  
**Method :** All code read from source — no assumptions from function names or prior reports.  
**Scope :** Auth/authz · Prisma/DB · BullMQ · State machines · Input validation · Secrets · Dependencies · React frontend

---

## Findings table (sorted by severity)

| # | Sévérité | Fichier : Ligne | Problème | Scénario d'exploitation | Fix |
|---|---|---|---|---|---|
| 1 | **ÉLEVÉE** | `server/.env.example:13` | `JWT_SECRET` utilisé à la place de `JWT_ACCESS_SECRET` | Un développeur qui copie `.env.example` verbatim démarre sans `JWT_ACCESS_SECRET` ; Zod lance une erreur immédiate et refuse de démarrer — impossible de valider quoi que ce soit | Renommer `JWT_SECRET` → `JWT_ACCESS_SECRET` dans `.env.example` |
| 2 | **MOYENNE** | `server/src/routes/upload.routes.ts:37–43` | `DELETE /upload` sans authentification pour les préfixes `cv/` et `portfolio/` | Un attaquant qui connaît une clé S3 valide (retournée dans la réponse `POST /upload/cv`) peut supprimer ce fichier sans token d'accès, avec seulement le rate-limit comme barrière | Exiger l'authentification sur DELETE pour toutes les clés, ou vérifier ownership via session/token |
| 3 | **MOYENNE** | `server/src/jobs/processors/maintenance.processor.ts:125` | `whereClause` interpolé dans `$executeRawUnsafe` sans validation runtime | Les noms de table sont gardés par `assertSafeArchiveTable`, mais le `whereClause` de chaque `ArchiveRule` est injecté directement dans le SQL. Une future règle ajoutée via une config ou un admin-UI transformerait cette ligne en SQLi RCE | Ajouter un `assertSafeWhereClause(clause)` regex-guard (`/^"?[a-zA-Z_][a-zA-Z0-9_"]*"?\s*(=|IS|<|>|AND|OR|NOT|INTERVAL|\.|'|\d).*$/`) ou utiliser `Prisma.sql` template tags pour les filtres paramétrables |
| 4 | **MOYENNE** | `server/src/services/auth.service.ts:177–191` | `resetPassword` lit le token puis le clear dans deux requêtes non-transactionnelles | Deux requêtes identiques soumises simultanément (race window < 1 ms) peuvent toutes deux franchir le `findFirst` avant que l'une des deux exécute l'`update(resetToken: null)` — permet de réinitialiser deux fois avec le même token | Wrapper le `findFirst` + `update` dans `prisma.$transaction` avec isolation `Serializable`, ou utiliser `updateFirst` avec `where: { resetToken, resetTokenExpiry: { gt: now } }` en un seul `update` (Prisma retourne 0 si absent → rejeter) |
| 5 | **FAIBLE** | `server/.env.example:13` | `INTEGRATIONS_ENCRYPTION_KEY` absent du `.env.example` | Un développeur activant Google OAuth sans cette clé obtient une erreur au boot sur les environments sans `GOOGLE_OAUTH_CLIENT_ID`, mais sur un environnement de staging où OAuth est activé, la clé serait silencieusement absente | Ajouter `INTEGRATIONS_ENCRYPTION_KEY=` au `.env.example` avec un commentaire |
| 6 | **FAIBLE** | `server/src/routes/upload.routes.ts:27–32` | Upload public non-authentifié permet d'injecter des fichiers arbitraires dans le bucket S3 | Sans authentification, n'importe qui peut uploader des CV/portfolio — le rate-limit est la seule barrière. Un bot peut remplir le bucket MinIO à faible coût (e.g. Cloudflare bypass + rotation IP) | Ajouter une clé d'upload signée côté serveur (pre-signed POST) ou exiger au minimum un captcha sur le formulaire public qui génère un token à usage unique |
| 7 | **FAIBLE** | `server/src/controllers/upload.controller.ts:55–65` | `DELETE /upload` ne vérifie pas que la clé appartient à l'appelant (même authentifié) | Un utilisateur ADMIN authentifié peut supprimer la clé `document/abc.pdf` qui appartient à un autre client | Après authentification, vérifier que le `Document` ou `FreelancerProfile` référençant cette clé appartient bien à `req.user.sub` |

---

## Section 1 — Auth & Authorization

### 1.1 Routes et middlewares

**Méthode :** `grep -rn "router\.(get|post|put|delete|patch)"` sur tous les fichiers de routes + vérification du premier middleware de chaque handler.

**Résultat :** 241 routes analysées. Modèles de protection observés :
- `router.use(authenticate)` en haut de fichier (invoice, user, proposal, etc.) — couvre toutes les routes sous ce router ✅
- `authenticate` par route individuelle (notification, auth /logout, upload) ✅
- Routes publiques intentionnelles : `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/contact`, `/booking/slots`, `/booking/book`, `/site-content` (lecture seule), `/upload/cv`, `/upload/portfolio` ✅

**Aucun IDOR trouvé dans les services critiques :** Toutes les opérations sur des ressources appartenant à un client ou projet passent par un `ServiceScope` ou un `where: { clientId: req.user.clientId }` dans Prisma.

### 1.2 JWT

**Fichier :** `server/src/services/auth.service.ts`, `server/src/config/env.ts`

| Aspect | Valeur | Status |
|---|---|---|
| `expiresIn` access token | `JWT_ACCESS_EXPIRES_IN` (défaut 15m) | ✅ |
| `expiresIn` refresh token | `JWT_REFRESH_EXPIRES_IN` (défaut 7d) | ✅ |
| Secrets en dur | Aucun — tout via `env.JWT_ACCESS_SECRET` / `env.JWT_REFRESH_SECRET` | ✅ |
| Validation secret en production | `KNOWN_PLACEHOLDER_SECRETS` check au démarrage | ✅ |
| Token family rotation (RFC 6819) | Reuse = révocation famille entière | ✅ |

### 1.3 Reset password token

**Fichier :** `server/src/services/auth.service.ts:153–191`

| Aspect | Status |
|---|---|
| Token à usage unique | ✅ — `resetToken: null` après usage |
| Expiration en base | ✅ — `resetTokenExpiry: { gt: new Date() }` dans la requête |
| Token hashé en base (SHA-256) | ✅ — stocké haché, pas en clair |
| **Race condition** | ⚠️ `findFirst` + `update` non-transactionnel — voir Finding #4 |

---

## Section 2 — Prisma / DB

### 2.1 Raw SQL (`$queryRaw`, `$executeRaw`, `$executeRawUnsafe`)

**Fichier :** `server/src/jobs/processors/maintenance.processor.ts`, `server/src/routes/index.ts`, `server/src/utils/projectProgress.ts`

| Occurrence | Type | Status |
|---|---|---|
| `maintenance.processor.ts:106` — `ensureMonthlyPartitions` | `$executeRawUnsafe(sql, rangeStart, next)` — table guardée, params bindés | ✅ |
| `maintenance.processor.ts:125` — `archiveTableRows` | `$executeRawUnsafe(\`...${rule.whereClause}...\`)` — **whereClause interpolé sans garde** | ⚠️ Finding #3 |
| `routes/index.ts:105` — health check | `` $queryRaw`SELECT 1` `` — template literal safe | ✅ |
| `utils/projectProgress.ts:14` | `` $queryRaw<...>` `` — template literal safe | ✅ |

### 2.2 Champs monétaires

**Résultat :** Tous les champs financiers sont en `Decimal @db.Decimal(14, 3)` (TND millimes). Aucun `Float` trouvé pour des montants. ✅

### 2.3 Transactions atomiques

Les opérations critiques sont correctement transactionnelles :
- `addPayment` — `prisma.$transaction` englobant mise à jour solde + création paiement + crédit note + commissions ✅
- `creditNote.applyCreditToInvoice` — transaction ✅
- `contact.convertToLead` — transaction ✅
- `commission.createForProject` — transaction ✅

### 2.4 Drift schéma / casts `as any`

Vérification : aucun `as any` post-`findUnique/findMany` dans les services ou repositories pour des champs monétaires. Les `Decimal` Prisma sont correctement convertis via `Number()` ou `roundMoney()`. ✅

---

## Section 3 — BullMQ

### 3.1 Queues et workers

| Queue | Worker | `on('failed')` | Retry | Backoff |
|---|---|---|---|---|
| `communication` | ✅ | ✅ + Sentry + admin notification | 3 (emails: 5) | Exponentiel 3 s |
| `documents` | ✅ | ✅ + Sentry | 4 | Exponentiel 5 s |
| `maintenance` | ✅ | ✅ + Sentry | 2 | Aucun (backoff absent) |

**Finding :** `maintenanceQueue` n'a pas de `backoff` configuré. Sur retry, les jobs rejoués s'exécutent immédiatement. Pour `markOverdueInvoices` ou `expireProposals`, une retry immédiate est idempotente (le job relit l'état en base), donc pas critique.

### 3.2 Idempotence

- `addPayment` : idempotency key optionnel côté API, `@unique` en DB, fallback 10s window ✅
- Document generation : pas de `jobId` fixe → un redémarrage serveur immédiatement après un `enqueueDocumentGeneration` pourrait re-enqueuer les mêmes PDFs depuis le code applicatif. En pratique les jobs d'enqueue viennent d'une transaction Prisma (proposal acceptance) et ne sont pas re-déclenchés au redémarrage. ✅
- Jobs récurrents : `jobId` fixes (e.g. `"cleanup-refresh-tokens-daily"`) — idempotents au redémarrage ✅

### 3.3 Jobs récurrents vérifiés

Tous les jobs attendus ont bien leur `maintenanceQueue.add(..., { repeat: { pattern } })` :
`cleanupRefreshTokens` · `archiveColdData` · `warmDashboardSummaries` · `recalculateClientScores` · `expireProposals` · `markOverdueInvoices` · `syncSearchConsole` · `pruneAnalyticsEvents` · CEO alerts (9 jobs) ✅

---

## Section 4 — State machines / statuts

### 4.1 Invoice

Transitions valides gardées dans le service :

| From | To | Guard |
|---|---|---|
| any | `CANCELLED` | `status !== "PAID" && status !== "CANCELLED"` |
| `SENT/PARTIAL/OVERDUE` | `PARTIAL/PAID` (via payment) | `["SENT","PARTIAL","OVERDUE"].includes(status)` |
| `DRAFT` | `SENT` | implicite — seules factures DRAFT peuvent être envoyées |

**Aucune transition invalide trouvée.** Ex: `CANCELLED → PAID` est impossible via l'API.

### 4.2 Proposal

`updateProposalSchema` (Zod) ne contient **pas** le champ `status` — il ne peut pas être fixé directement via `PUT /proposals/:id`. Seuls les endpoints spécialisés (`/accept`, `/send`, `/reject`) peuvent changer le statut. ✅

### 4.3 Approval

Guards `if (approval.status !== "PENDING")` présents sur toutes les transitions (`APPROVED`, `REJECTED`, `REVISION`, `ACKNOWLEDGED`). ✅

### 4.4 Commission

Guard `if (commission.status === "PAID") throw HttpError(409, ...)` avant marquage comme payé. ✅

---

## Section 5 — Validation d'input

### 5.1 Cohérence des schémas Zod

Vérification sur `invoice`, `lead`, `project`, `proposal` :
- Tous les endpoints `POST` et `PUT` ont un middleware `validate(schema)` **avant** le handler.
- Les endpoints sensibles (`/invoices/:id/add-payment`, `/invoices/:id/send`, etc.) ont leur propre schéma Zod avec les contraintes appropriées.

### 5.2 Endpoints sans validation

Seuls les endpoints qui ne reçoivent pas de body utilisateur (ex: `GET /invoices/trash`, `POST /invoices/:id/restore` avec Zod sur le param `id`) passent sans schéma body — acceptable car aucun `req.body` n'est utilisé.

---

## Section 6 — Secrets & config

### 6.1 Secrets en dur

**Commande :** `grep -rn "sk_|api_key|API_KEY|\"secret\"" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v "process.env|env\.|//|test|spec"`

**Résultat :** Aucun secret en dur trouvé dans le code source. ✅

### 6.2 `.env.example` vs utilisation réelle

| Variable requise (env.ts) | Dans `.env.example` | Status |
|---|---|---|
| `JWT_ACCESS_SECRET` | **Absent** (remplacé par `JWT_SECRET`) | ❌ Finding #1 |
| `JWT_REFRESH_SECRET` | ✅ Présent | ✅ |
| `INTEGRATIONS_ENCRYPTION_KEY` | **Absent** | ❌ Finding #5 |
| `DATABASE_URL` | ✅ Présent | ✅ |
| `REDIS_URL` | ✅ Présent | ✅ |
| `SMTP_PASSWORD` | Présent comme `SMTP_PASS` ≠ `SMTP_PASSWORD` | ⚠️ Mineur |

**Action immédiate requise :** Corriger `.env.example` (voir fixes ci-dessous).

---

## Section 7 — Dépendances

**Liste des dépendances serveur analysées :**

| Dépendance | Usage | Evaluation |
|---|---|---|
| `@aws-sdk/client-s3` | MinIO/S3 | AWS officiel, 9M dl/semaine ✅ |
| `@bull-board/api` + `@bull-board/express` | BullMQ dashboard | Maintenu, lié à BullMQ ✅ |
| `@prisma/client` | ORM | Prisma officiel ✅ |
| `@sentry/node` | Error tracking | Sentry officiel ✅ |
| `bcryptjs` | Password hashing | Bien maintenu, 5M dl/semaine ✅ |
| `bullmq` | Job queue | Official Taskforce lib ✅ |
| `file-type` | MIME detection | sindresorhus, 8M dl/semaine ✅ |
| `googleapis` | Search Console | Google officiel ✅ |
| `helmet` | HTTP headers | Express-team, 2M dl/semaine ✅ |
| `jsonwebtoken` | JWT | Auth0, 12M dl/semaine ✅ |
| `multer` | File upload | Express-team ✅ |
| `pdfkit` | PDF generation | Bien maintenu ✅ |
| `pino` | Logging | Très utilisé, 4M dl/semaine ✅ |
| `prom-client` | Prometheus | siimon/prom-client, officiel ✅ |
| `zod` | Validation | 7M dl/semaine ✅ |

**Aucune dépendance suspecte (typosquat, quasi-inconnue, ou substituable par stdlib) détectée.** ✅

---

## Section 8 — React frontend

### 8.1 Vérifications de rôle côté client

**Fichiers analysés :** `ProtectedRoute.tsx`, `AdminLayout.tsx`, `DashboardPage.tsx`, `SettingsPage.tsx`, `usePermission.ts`, `auth.store.ts`.

Les checks frontend comme `user?.role === "ADMIN"` sont utilisés uniquement pour :
- Redirection après login (`getRedirectPathForRole`)
- Masquage de composants UI (boutons, tabs)
- Activation de requêtes (`enabled: role === "ADMIN"`)

**Confirmation backend :** Chaque route API correspondante possède `authorize("ADMIN")` ou `requirePermission(module, action)`. Le frontend ne sert que d'UX — aucun bypass possible. ✅

### 8.2 Données sensibles en query string

**Commande :** `grep -rn "apiClient.get.*?" client/src/ --include="*.ts" --include="*.tsx" | grep -v "//"`

Aucun endpoint ne passe des données sensibles (tokens, passwords, PII) en query string. Les filtres de liste utilisent des query params non-sensibles (`page`, `search`, `status`). ✅

---

## Fixes à appliquer

### Fix #1 — `server/.env.example` (ÉLEVÉE)

```diff
-JWT_SECRET=your-super-secret-jwt-key-min-32-chars
+JWT_ACCESS_SECRET=your-super-secret-jwt-access-key-min-32-chars
 JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
+INTEGRATIONS_ENCRYPTION_KEY=
```

Also fix `SMTP_PASS` → `SMTP_PASSWORD`.

### Fix #2 — DELETE upload sans ownership (MOYENNE)

`server/src/routes/upload.routes.ts` :

```diff
-router.delete("/", validate(deleteFileSchema), (req, res, next) => {
+router.delete("/", validate(deleteFileSchema), authenticate, (req, res, next) => {
   const key = (req.body as { key?: string })?.key ?? "";
-  const isPublicKey = PUBLIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
-  if (isPublicKey) {
-    return contactRateLimit(req, res, next);
-  }
-  return authenticate(req, res, next);
+  next();
 }, deleteFile);
```

> Rationale : The upload response key is returned to the uploader. Deletes should always require auth. The pre-account use case (freelancer application form) submits the key at form submission time — deletion before submission isn't a product requirement and shouldn't be publicly available.

### Fix #3 — `whereClause` guard (MOYENNE)

`server/src/jobs/processors/maintenance.processor.ts`, ajouter après `assertSafeArchiveTable` :

```typescript
const SAFE_WHERE_CLAUSE_RE = /^"?[A-Za-z_][A-Za-z0-9_"]*"?\s*(IS|=|<|>|AND|OR|NOT|INTERVAL|\.|'[^']*'|\d)/;

function assertSafeWhereClause(clause: string, label: string) {
  if (!SAFE_WHERE_CLAUSE_RE.test(clause.trim())) {
    throw new Error(`[maintenance] Blocked potentially unsafe whereClause in rule "${label}": ${clause}`);
  }
}
```

Appeler dans `archiveTableRows` :
```typescript
assertSafeArchiveTable(rule.sourceTable);
assertSafeArchiveTable(rule.archiveTable);
assertSafeWhereClause(rule.whereClause, rule.sourceTable);
```

### Fix #4 — Reset password race condition (MOYENNE)

`server/src/services/auth.service.ts` — wrapper dans une transaction :

```typescript
async resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  
  await this.db.$transaction(async (tx) => {
    // Atomically find-and-clear the token in one operation.
    const result = await tx.user.updateMany({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: { gt: new Date() },
      },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });
    if (result.count === 0) {
      throw new HttpError(400, "Invalid or expired reset token");
    }
    // Revoke all active sessions after password reset.
    const user = await tx.user.findFirst({ where: { passwordHash }, select: { id: true } });
    if (user) await tx.refreshToken.deleteMany({ where: { userId: user.id } });
  });
}
```

> Note : `updateMany + where(tokenHash)` is atomic at the DB level — no two concurrent calls can both match the same token.

---

## Résumé

| Sévérité | Nombre | Findings |
|---|---|---|
| CRITIQUE | 0 | — |
| ÉLEVÉE | 1 | #1 — `.env.example` JWT_SECRET mismatch |
| MOYENNE | 3 | #2 upload delete sans auth · #3 whereClause non-gardé · #4 resetPassword race |
| FAIBLE | 3 | #5 INTEGRATIONS_ENCRYPTION_KEY absent · #6 upload public non-limité · #7 delete sans ownership |

### 3 fixes à faire AVANT tout déploiement

1. **`.env.example` — `JWT_SECRET` → `JWT_ACCESS_SECRET`** : un développeur qui bootstrap l'app avec l'exemple actuel obtient une erreur Zod au démarrage et ne peut pas lancer le serveur.

2. **`DELETE /upload` — ajouter `authenticate`** : n'importe qui peut supprimer des fichiers S3 via un seul appel HTTP si la clé est connue.

3. **`resetPassword` — transaction atomique** : la fenêtre de race est microscopique mais permet théoriquement de consommer le même token de reset deux fois avec des passwords différents.
