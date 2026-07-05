# Rapport d'audit sécurité — Secritou SaaS

> Référentiels : OWASP Top 10 2021 · ASVS Niveau 1  
> Date : 2026-07-05 · Périmètre : code source complet (client + server, commit `eaea9f5`)  
> Auditeur : analyse statique outillée, lecture intégrale des fichiers

---

## Tableau des constats

| # | Sévérité | Fichier : ligne | Constat | Exploitation possible | Correctif précis |
|---|----------|----------------|---------|----------------------|------------------|
| 1 | **HAUTE** | `server/.env` : 14-15 | Mot de passe Gmail applicatif (`auic rigb ineg xwdp`) en clair sur disque | Si le dépôt est cloné ou le serveur compromis, accès complet à la boîte e-mail de l'agence | Révoquer immédiatement le mot de passe d'application Google, en générer un nouveau, le stocker dans un gestionnaire de secrets (Vault, Doppler, etc.) — ne jamais laisser en `.env` |
| 2 | **HAUTE** | `server/.env` : 4-5 | Secrets JWT encore à la valeur placeholder `your-super-secret-jwt-key-min-32-chars` | N'importe qui connaissant cette chaîne peut forger un JWT valide et usurper n'importe quel compte (y compris ADMIN) | Générer deux secrets aléatoires ≥ 64 octets (`openssl rand -hex 64`) et les injecter avant tout déploiement |
| 3 | **HAUTE** | `client/src/features/auth/LoginPage.tsx` : 22, 31 | Open redirect — le paramètre `?redirect=` est transmis sans validation à `navigate()` | `GET /login?redirect=//evil.com` → après login, l'utilisateur est redirigé vers un site externe (phishing, vol de token) | Valider que `redirectTo` commence par `/` et ne contient pas `//` avant utilisation : `const safe = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null;` |
| 4 | **HAUTE** | `client/src/components/layout/AdminLayout.tsx` : 78-86 | Historique de chat IA stocké dans `localStorage` (clé `ai_chat_history`) | XSS sur n'importe quelle page admin → lecture de tout l'historique de conversation IA incluant potentiellement des données métier sensibles (noms clients, montants, etc.) | Stocker l'historique en mémoire React uniquement (state), ou chiffrer avec la Web Crypto API — supprimer la persistance localStorage |
| 5 | **HAUTE** | `server/src/routes/index.ts` : 95-129 | Endpoint `/health/ready` public expose l'état de la base de données et du cache Redis sans authentification | Divulgation de l'architecture interne (PostgreSQL up/down, Redis up/down) ; facilite la reconnaissance avant attaque | Protéger avec un token statique ou limiter aux IPs internes : `router.get('/health/ready', validate(healthTokenSchema), ...)` — ou retirer Redis du check public |
| 6 | **HAUTE** | `server/src/app.ts` : 87-93 | Swagger UI (`/api-docs`) et `/openapi.json` actifs si `NODE_ENV !== 'production'` — mais la condition dépend d'une variable non validée | Si `NODE_ENV` n'est pas défini en staging/preprod, l'API complète est documentée publiquement avec exemples de requêtes | Supprimer la condition `if` et désactiver Swagger en dehors du poste dev local (contrôle via env explicite `SWAGGER_ENABLED=true`) |
| 7 | **MOYENNE** | `server/src/middlewares/upload.middleware.ts` : 5 | Taille max upload (`UPLOAD_MAX_BYTES`) lue depuis `process.env` avec fallback à 20 MB — s'applique à tous contextes y compris CV (devrait être 10 MB) | Un candidat peut uploader un portfolio de 20 MB là où le cahier des charges spécifiait 10 MB pour les CV ; DoS partiel (mémoire multer) | Définir des limites par contexte : `cv: 10 MB`, `portfolio: 20 MB`, `document: 10 MB`, `image: 5 MB` dans un objet de config dans `upload.service.ts` |
| 8 | **MOYENNE** | `server/src/services/upload.service.ts` : 164-183 | La détection magic bytes (`fileTypeFromBuffer`) ne vérifie pas le contenu ZIP — un ZIP malformé ou un ZIP contenant un chemin traversant passe sans erreur | Les fichiers ZIP de portfolio ne sont jamais décompressés côté serveur (stockés tels quels sur S3), donc le zip-slip n'est pas exploitable actuellement. Mais si un futur traitement extrait le ZIP, la vulnérabilité deviendra critique | Ajouter une note de code bloquant l'extraction future sans sanitisation ; envisager de bannir ZIP et n'accepter que PDF pour les portfolios |
| 9 | **MOYENNE** | `server/src/middlewares/upload.middleware.ts` : 16 | La validation MIME du multer fileFilter repose sur `file.mimetype` fourni par le client HTTP, pas sur les magic bytes | Un attaquant peut envoyer `Content-Type: application/pdf` pour un fichier `.exe` et passer le filtre multer (la vérification magic bytes arrive ensuite dans `upload.service.ts`) — la défense en profondeur fonctionne mais l'ordre des contrôles laisse une fenêtre | Déplacer la vérification magic bytes en premier (avant le stockage mémoire multer, via un stream transform), ou documenter explicitement que fileFilter est un pré-filtre non suffisant |
| 10 | **MOYENNE** | `server/src/routes/upload.routes.ts` : 38-44 | `DELETE /upload` autorisé sans authentification si la clé S3 commence par `cv/` ou `portfolio/` | Un attaquant peut supprimer le CV ou le portfolio d'un candidat en devinant la clé S3 (format `cv/<uuid>.pdf` — UUID v4 est non énumérable mais pas secret) | Exiger au minimum le `sensitiveWriteRateLimit` plus stricte (3/h) pour les suppressions publiques, ou désactiver la suppression publique et gérer via un job de nettoyage |
| 11 | **MOYENNE** | `server/src/config/env.ts` : 23 | `OPENAI_API_KEY` déclaré comme variable d'environnement optionnelle mais inutilisée (le LLM client utilise Ollama) | Fuite possible si une clé OpenAI est placée par erreur dans `.env` et que la variable est loggée ou exposée par `/health` | Supprimer la variable de `envSchema` ou la déplacer dans un commentaire si réservée à une future intégration |
| 12 | **MOYENNE** | `server/src/routes/auth.routes.ts` : 77 | `POST /auth/register` public avec rate limit partagé de 30 req/15 min (partagé avec login/forgot-password) | Création de comptes indésirables en masse si l'enregistrement public reste ouvert ; pas de validation d'e-mail confirmée visible | Soit désactiver le register public (seul l'admin invite), soit ajouter un captcha et une confirmation par e-mail avant activation du compte |
| 13 | **MOYENNE** | `server/src/middlewares/rateLimit.middleware.ts` : 7-13 | Rate limit login : 30 requêtes / 15 min par IP+user — trop généreux pour un endpoint d'authentification | Attaque par dictionnaire lente (30 essais = brute-force 4 char password en quelques heures si pas de complexité requise) | Réduire à 5 tentatives / 15 min et implémenter un lockout progressif (délai exponentiel) côté service |
| 14 | **MOYENNE** | `server/src/validators/auth.validator.ts` : 7 | Le schéma `registerSchema` exige `password` ≥ 8 caractères mais sans contrainte de complexité (majuscule, chiffre, caractère spécial) | Mots de passe `12345678` ou `aaaaaaaa` acceptés | Ajouter `.regex(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/)` ou utiliser `zxcvbn` pour estimer la force |
| 15 | **MOYENNE** | `server/src/app.ts` : 72-76 | CORS configuré avec `origin: env.FRONTEND_URL` (mono-origine) et `credentials: true` | Si `FRONTEND_URL` est mal configuré en production (ex. `http://localhost:5173`), n'importe quel navigateur peut effectuer des requêtes cross-origin authentifiées | Valider que `FRONTEND_URL` est une URL HTTPS en production dans `envSchema` : `z.string().url().refine(v => !v.startsWith('http://') || env.NODE_ENV !== 'production')` |
| 16 | **BASSE** | `server/src/utils/authCookies.ts` : 8-14 | Cookie refresh `sameSite: "strict"` — correct en soi, mais `path: "/"` expose le cookie à toutes les routes du domaine y compris `/api-docs`, `/metrics` | Si un tiers sous-domaine partage l'origine, le cookie peut être lu ; en mode développement `secure: false` expose le token en HTTP clair | En production, restreindre `path: "/api/v1/auth"` pour limiter la surface d'exposition |
| 17 | **BASSE** | `server/src/routes/index.ts` : 105 | `/health/ready` lit `process.env.REDIS_URL` directement (pas via `env.REDIS_URL`) — doublon avec le schéma Zod validé | Incohérence de config : si `REDIS_URL` est renommée, le check health continuera à utiliser l'ancienne variable | Remplacer par `env.REDIS_URL` (déjà parsé et validé) |
| 18 | **BASSE** | `client/src/store/auth.store.ts` | `user` et `status` persistés dans `localStorage` via Zustand persist | En cas de XSS, l'attaquant lit le rôle et l'identité de l'utilisateur (pas le token d'accès, qui reste en mémoire) | Limiter la persistance à un flag de session (`wasAuthenticated: boolean`) sans stocker l'objet `user` complet |
| 19 | **BASSE** | Absence | Aucun header `Permissions-Policy` configuré dans Helmet | Accès potentiel à des API navigateur (caméra, micro, géolocalisation) depuis des scripts injectés | Ajouter `permissionsPolicy: { features: { camera: [], microphone: [], geolocation: [] } }` dans la config Helmet |
| 20 | **BASSE** | Absence | Absence de protection CSRF explicite sur les mutations sensibles | Les cookies `httpOnly` + `sameSite: strict` atténuent le CSRF de façon native, mais si `sameSite` est abaissé ou qu'un sous-domaine est compromis, les mutations restent vulnérables | Ajouter un header custom obligatoire (`X-Requested-With: XMLHttpRequest`) vérifié côté serveur comme double-submit implicite |
| 21 | **BASSE** | Données personnelles | CV (nom, e-mail, téléphone, adresse), portfolios, e-mails de contact collectés sans durée de rétention ni politique de suppression visible | Non-conformité loi tunisienne 2004-63 (art. 12 : finalité + durée) et RGPD si prospect européen | Définir une rétention explicite (ex. 12 mois), ajouter un job BullMQ de suppression automatique dans `maintenance.processor.ts` (déjà présent), afficher la politique sur le formulaire |

---

## Analyse détaillée par thème

### 1. Authentification et sessions

**Vérification des identifiants** — Aucun credential en dur dans le code source. Les mots de passe sont générés aléatoirement pour les comptes invités (`crypto.randomBytes(16)` dans `client.service.ts:74` et `freelancerApplication.service.ts:66`). Les JWT sont signés avec HS256 + issuer/audience. **Constat positif.**

**Stockage token côté client** — Le token d'accès (15 min) est stocké en mémoire Zustand (non persisté). Le refresh token est en cookie `httpOnly; sameSite=strict; secure` (prod). **Pattern sécurisé.** Seuls `user` et `status` sont dans localStorage, sans token (cf. constat #18).

**Logout effectif** — `POST /auth/logout` efface le cookie et invalide le refresh token côté serveur + cache Redis (`cacheDel`). **Correct.**

**Forgot password** — La réponse est volontairement générique : `"If an account exists, a reset email has been sent"` (`auth.controller.ts:88`). Pas de timing attack visible (la réponse est identique qu'un compte existe ou non). **Conforme.**

**Brute force** — Rate limit global 30 req/15 min sur login (constat #13 pour le seuil). Pas de lockout compte après N échecs. Le rate limit est IP+user-based, ce qui est correct mais insuffisant seul.

---

### 2. Autorisation (RBAC)

**Protection côté serveur confirmée** — Toutes les routes `/app/*` ont `authenticate` appliqué côté serveur. Exemples vérifiés :

| Route API | Middleware observé |
|-----------|-------------------|
| `GET /api/v1/leads` | `authenticate + authorize("ADMIN","MANAGER") + requirePermission("leads","read")` |
| `GET /api/v1/invoices` | `authenticate + authorize("ADMIN","MANAGER") + requirePermission` |
| `GET /api/v1/clients` | `authenticate + authorize("ADMIN","MANAGER") + requirePermission` |
| `GET /api/v1/analytics/*` | `authenticate + authorize("ADMIN","MANAGER")` |
| `GET /api/v1/analytics/revenue-forecast` | `authenticate + authorize("ADMIN")` seulement |
| `POST /api/v1/freelancer-applications` | Public + `sensitiveWriteRateLimit` |
| `GET /api/v1/freelancer-applications` | `authenticate + authorize("ADMIN")` |

**Un freelancer peut-il accéder aux données admin ?** Non — le middleware `authorize()` vérifie `req.user.role` (extrait du JWT vérifié côté serveur). Un freelancer appelant `GET /api/v1/leads` reçoit 403. Les routes Freelancer autorisées côté front (`ProtectedRoute.tsx:45`) reflètent correctement les autorisations serveur.

**IDOR** — Les IDs des ressources sont des UUID v4 (Prisma par défaut), non séquentiels, non prédictibles. Les contrôleurs filtrent par ownership (ex. `clientController.getMyClient` → `authorize("CLIENT")` retourne seulement le client lié à `req.user`). **Pas d'IDOR évident.**

**Note** : le `requirePermission` du `rbac.middleware.ts:32` laisse passer silencieusement les rôles non-MANAGER sans vérification de permission granulaire — ce comportement est documenté (`// non-MANAGER roles pass through`) et repose sur `authorize()` en amont pour filtrer par rôle. La logique est correcte mais fragile si une route omettait l'`authorize()` préalable.

---

### 3. Uploads de fichiers

**Validation type** — Double validation : MIME déclaré (multer fileFilter) puis magic bytes (`fileTypeFromBuffer`). Un `.exe` renommé `.pdf` serait détecté au niveau magic bytes (signature `%PDF` attendue). **Défense en profondeur effective.**

**Taille** — Limite globale unique de `UPLOAD_MAX_BYTES` (défaut 20 MB) pour tous contextes. Un CV devrait être limité à 10 MB séparément (constat #7).

**Stockage** — Fichiers en mémoire multer → S3/MinIO directement. Aucun écrit sur le système de fichiers local. ACL `private` par défaut, accès via URL pré-signée (TTL 7 jours). **Sécurisé.**

**ZIP slip** — Les ZIP ne sont pas extraits, uniquement stockés. Pas de risque immédiat (constat #8).

**URLs devinables** — Les clés S3 suivent le pattern `<context>/<uuid-v4><ext>` (ex. `cv/3f2504e0-...-.pdf`). UUID v4 = 122 bits d'entropie = non énumérable. **Pas de risque d'accès non autorisé par URL.**

**Suppression publique** — `DELETE /upload` sans auth pour les clés `cv/` et `portfolio/` (constat #10). Un attaquant ayant récupéré une clé S3 (ex. via log serveur ou réponse JSON) peut supprimer le fichier sans être authentifié.

---

### 4. Injections et XSS

**`dangerouslySetInnerHTML`** — Aucune occurrence dans tout `client/src/`. **Pas de risque XSS direct.**

**`innerHTML`** — Aucune occurrence dans `client/src/`. **Pas de risque.**

**`eval`** — Non recherché explicitement mais aucun usage dans les fichiers relus. Framework React n'utilise pas `eval` en production.

**SQL injection** — Toutes les requêtes passent par Prisma ORM (requêtes paramétrées). Les seules requêtes raw SQL (`$executeRawUnsafe`) sont dans `maintenance.processor.ts` et n'utilisent que des valeurs hardcodées (constantes ARCHIVE_RULES + calculs de dates). **Pas d'injection SQL possible.**

**Open redirect** — Constat #3 ci-dessus.

---

### 5. Secrets et configuration

**Bundle front** — Aucun secret dans `client/.env` (VITE_*). `VITE_WHATSAPP_NUMBER` est un numéro public. `VITE_SENTRY_DSN` sera visible dans le bundle mais c'est normal pour un DSN public. **Pas de secret exposé dans le bundle.**

**`.env` commité** — Le fichier `server/.env` n'est PAS dans git (testé avec `git log -- server/.env` → vide). Mais le fichier sur disque contient un App Password Gmail réel (constat #1) et les secrets JWT placeholders (constat #2).

**Headers de sécurité (Helmet)** — Bien configuré :
- CSP : `defaultSrc 'self'`, `scriptSrc 'self'`, `frameAncestors 'none'`
- HSTS : activé en prod (`maxAge: 31536000, includeSubDomains, preload`)
- X-Frame-Options : `DENY`
- X-Content-Type-Options : activé
- Manque : `Permissions-Policy` (constat #19)

**CORS** — Mono-origine `env.FRONTEND_URL` + `credentials: true`. Correct en prod si `FRONTEND_URL` est bien une URL HTTPS. Risque si la variable pointe vers `http://localhost` en staging (constat #15).

---

### 6. Données personnelles

Les données collectées via les formulaires publics (candidature freelancer, contact) :

| Donnée | Formulaire | Stockage | Rétention |
|--------|-----------|---------|-----------|
| Nom, email, téléphone | Candidature (`/rejoindre`) | PostgreSQL (`FreelancerApplication`) | Non définie |
| CV PDF | Candidature | S3/MinIO | Non définie |
| Portfolio PDF/ZIP | Candidature | S3/MinIO | Non définie |
| Nom, email, téléphone, message | Contact public | PostgreSQL (`ContactRequest`) | Non définie |

**Absence de politique de rétention** — La loi tunisienne 2004-63 (art. 12) et le RGPD (art. 5.1.e) exigent une durée de conservation déterminée. `maintenance.processor.ts` contient déjà un système d'archivage/suppression (`ARCHIVE_RULES`) mais aucune règle pour `FreelancerApplication` ou `ContactRequest`.

**Chiffrement** — Les données sont en clair en base PostgreSQL. Les CV/portfolios sont privés sur S3. Pas de chiffrement colonne visible pour les données PII.

**Qui y accède** — Seul `ADMIN` accède aux candidatures (`authorize("ADMIN")`). Le formulaire de contact est lu par les managers (`authorize("ADMIN","MANAGER")`).

---

## Correctifs BLOQUANTS avant mise en ligne

Les éléments suivants doivent être corrigés **avant tout déploiement en production** :

### BLOQUANT 1 — Révoquer et remplacer les secrets JWT (constat #2)

```bash
# Générer deux secrets robustes
openssl rand -hex 64  # JWT_ACCESS_SECRET
openssl rand -hex 64  # JWT_REFRESH_SECRET
```

Injecter dans l'environnement de production via un gestionnaire de secrets. Ne jamais laisser les valeurs placeholder dans un `.env` déployé.

### BLOQUANT 2 — Révoquer le mot de passe Gmail (constat #1)

1. Aller sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Révoquer l'App Password `auic rigb ineg xwdp`
3. Générer un nouveau mot de passe d'application
4. Le stocker dans un gestionnaire de secrets (jamais dans `.env` sur disque si le serveur est accessible)

### BLOQUANT 3 — Corriger l'open redirect (constat #3)

```tsx
// client/src/features/auth/LoginPage.tsx, ligne 22-31
const redirectTo = searchParams.get("redirect");
// Valider que le redirect est interne
const safeRedirect = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
  ? redirectTo
  : null;
// ...
navigate(safeRedirect || getRedirectPathForRole(response.user.role));
```

### BLOQUANT 4 — Supprimer ou protéger `/health/ready` (constat #5)

```ts
// server/src/routes/index.ts — ajouter un token de protection simple
apiRoutes.get("/health/ready", (req, _res, next) => {
  const token = req.headers["x-health-token"];
  if (process.env.NODE_ENV === "production" && token !== env.METRICS_TOKEN) {
    return next(new HttpError(401, "Unauthorized"));
  }
  next();
}, async (_req, res) => {
  // ... reste du handler
});
```

### BLOQUANT 5 — Désactiver Swagger en dehors du dev local (constat #6)

```ts
// server/src/app.ts — remplacer la condition
if (env.SWAGGER_ENABLED === true) {
  app.use("/api-docs", swaggerUi.serve);
  app.get("/api-docs", swaggerUi.setup(swaggerSpec));
  app.get("/openapi.json", (_req, res) => res.send(swaggerSpec));
}
```

Ajouter `SWAGGER_ENABLED=false` dans `.env.example` et ne jamais activer en production.

### BLOQUANT 6 — Supprimer l'historique IA du localStorage (constat #4)

```tsx
// client/src/components/layout/AdminLayout.tsx
// Supprimer lignes 78-79, 86, 90 (persistance localStorage)
// Initialiser l'état à [] directement :
const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
// L'historique sera perdu au refresh — c'est acceptable pour des données potentiellement sensibles
// ou implémenter via AiConversation API (déjà présente dans le backend)
```

---

## Récapitulatif par OWASP Top 10

| OWASP 2021 | Statut | Constats |
|-----------|--------|---------|
| A01 — Broken Access Control | ✅ Correct | RBAC serveur en place, UUID non prédictibles |
| A02 — Cryptographic Failures | ⚠️ Partiel | JWT secrets placeholder (#2), App Password en clair (#1) |
| A03 — Injection | ✅ Correct | Prisma ORM, pas de concaténation SQL utilisateur |
| A04 — Insecure Design | ⚠️ Partiel | Pas de rétention données (#21), suppression publique S3 (#10) |
| A05 — Security Misconfiguration | ⚠️ Partiel | Swagger non protégé (#6), health endpoint public (#5) |
| A06 — Vulnerable Components | — | Non audité (dépendances npm) — lancer `npm audit` |
| A07 — Auth Failures | ⚠️ Partiel | Rate limit login trop généreux (#13), pas de lockout (#13) |
| A08 — Software Integrity | — | Non audité (CI/CD, supply chain) |
| A09 — Logging Failures | ✅ Correct | Pino logger en place, Sentry configuré |
| A10 — SSRF | ✅ Correct | LLM via Ollama local (`env.OLLAMA_URL`), pas d'URL utilisateur dans les requêtes serveur |
