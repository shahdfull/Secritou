# Audit Round 5 — Domaine B2 (reconstruction round 3) — Secritou

> Contexte : ce rapport reconstruit six domaines du round 3 disparu, sur définition explicite fournie en amont de cette session (aucune extrapolation de périmètre). Style et méthode alignés sur `audit/11-round4-security-integrity.md` : chaque verdict découle d'une lecture directe du code au 2026-07-11, avec citation fichier+ligne systématique.

---

## Tâche 1 — Cycle de vie session/token

| Point | Fichier + ligne | Constat | Statut |
|---|---|---|---|
| **Durée access token** | `server/src/config/env.ts:13` (`JWT_ACCESS_EXPIRES_IN: z.string().default("15m")`), utilisé `server/src/services/auth.service.ts:47` | 15 minutes par défaut, configurable via env. Cohérent avec les bonnes pratiques (courte durée de vie). | ✅ |
| **Durée refresh token** | `server/src/config/env.ts:14` (`JWT_REFRESH_EXPIRES_IN: z.string().default("7d")`), utilisé `auth.service.ts:56, 222` | 7 jours par défaut. Stocké en base (`RefreshToken.expiresAt`, `schema.prisma:726`), donc borne réellement appliquée côté serveur (pas seulement dans le JWT). | ✅ |
| **Rotation + détection de réutilisation** | `auth.service.ts:97-132` | Implémentation correcte : chaque `refresh()` (a) vérifie la signature JWT et `tokenType==="refresh"` (ligne 100-108) ; (b) recherche le hash du token en base (`findRefreshToken`, ligne 113-114) ; (c) **si absent** (déjà consommé/rotate ou jamais émis) → `revokeTokenFamily(decoded.familyId)` révoque **toute la famille** de tokens issue de ce login, puis 401 (ligne 116-122, commentaire explicite "Reuse detected - revoke entire family!") ; (d) si présent mais `revokedAt` ou expiré → même révocation de famille + 401 (ligne 124-128) ; (e) sinon, révoque l'ancien token (ligne 131) et émet un nouveau couple access+refresh dans la **même famille** (`issueTokens(stored.user, stored.familyId)`, ligne 132, 210-229). Un refresh token volé et rejoué après avoir déjà été utilisé légitimement invalide toute la session — protection anti-vol correcte. | ✅ |
| **Logout invalide bien le refresh token côté serveur** | `auth.service.ts:141-147` | `logout()` retrouve le token par son hash et appelle `revokeTokenFamily(stored.familyId)` (ligne 145) — donc pas seulement une suppression client-side : la famille entière est marquée `revokedAt` en base (`auth.repository.ts:51-56`), un replay après logout échoue au prochain `refresh()` (branche `stored.revokedAt` ligne 124-128). | ✅ |
| **Changement de mot de passe invalide les autres sessions** | `auth.service.ts:195-208` (`changePassword`), ligne 207 : `await this.db.user.update(...); await this.db.refreshToken.deleteMany({ where: { userId } })` | Toutes les refresh tokens de l'utilisateur sont supprimées (pas seulement révoquées, `deleteMany`) après un changement de mot de passe — toute session existante ne peut plus rafraîchir son access token, qui expire naturellement sous 15 min max. | ✅ |
| **Changement de rôle invalide les sessions** | `server/src/services/user.service.ts:54-61` (`updateUser`) | **Aucun appel** à `refreshToken.deleteMany`/`revokeTokenFamily` après un changement de `role`. Un access token JWT déjà émis contient le rôle (`auth.service.ts:41`, `role: user.role` signé dans le payload) et reste valide **jusqu'à ses 15 minutes d'expiration naturelle** — fenêtre courte mais réelle où un utilisateur rétrogradé (ex. MANAGER → CLIENT) conserve les autorisations de son ancien rôle via son access token déjà émis, tant que le middleware d'auth ne revalide pas le rôle en base à chaque requête (à vérifier séparément, hors périmètre de ce point précis — probablement non revalidé puisque le rôle vient du JWT signé). | ⚠️ Partiel — fenêtre de 15 min max, pas d'invalidation explicite au changement de rôle |
| **Reset password — re-vérification rapide** | `auth.service.ts:149-193` | Confirmé conforme au round 4 : token aléatoire 32 bytes (`randomBytes(32)`, ligne 153), jamais stocké en clair (`hashToken` SHA-256, ligne 154, 175), TTL 1h (ligne 155), vérifié via `resetTokenExpiry: { gt: new Date() }` (ligne 179), usage unique (mis à `null` après consommation, ligne 190). Bonus trouvé cette session : `resetPassword` **révoque aussi toutes les refresh tokens** (`refreshToken.deleteMany`, ligne 192) — protection supplémentaire non mentionnée explicitement au round 4. | ✅ |

---

## Tâche 2 — Audit des dépendances (supply chain)

Commandes exécutées dans `server/` et `client/` (4 commandes, réseau npm disponible, pas d'échec) :

```
npm audit --omit=dev   (server)  → 3 vulnérabilités (1 low, 2 moderate)
npm audit               (server)  → 3 vulnérabilités (1 low, 2 moderate) — identique
npm audit --omit=dev   (client)  → 3 vulnérabilités (1 low, 2 moderate)
npm audit               (client)  → 3 vulnérabilités (1 low, 2 moderate) — identique
```

Note méthodologique : les 4 commandes retournent un résultat identique parce que ce dépôt est un **npm workspace** (racine `SaaS@`, `node_modules` partagé) — `npm ls exceljs` confirmé en pointant `SaaS@ -> server`. Les 4 exécutions ont bien été lancées séparément (répertoires vérifiés via `pwd`), le résultat identique reflète l'arbre de dépendances réel, pas une erreur de commande.

| Paquet | Sévérité | Avis | Exploitabilité réelle ici |
|---|---|---|---|
| `esbuild` 0.27.3–0.28.0 (via `vite`) | Low | GHSA-g7r4-m6w7-qqqr — lecture arbitraire de fichier via le dev server esbuild **sur Windows** | ✅ Non exploitable en prod : c'est une faille du **serveur de dev** Vite/esbuild, jamais exposé publiquement (build de prod = fichiers statiques servis par nginx/CDN, pas par `vite dev`). Risque uniquement pour un poste de dev exposant `vite dev --host` sur un réseau non fiable — déjà le cas ici (`client/package.json:6`, `dev` script utilise `--host 0.0.0.0`), donc à ne lancer que sur réseau de confiance. |
| `uuid` <11.1.1 (transitif via `exceljs`) | Moderate | GHSA-w5hq-g745-h8pq — dépassement de tampon quand un `buf` est fourni explicitement à `v3()/v5()/v6()` | ✅ Non exploitable ici : grep exhaustif de `exceljs` dans `server/src/**/*.ts` → **0 résultat**. Le paquet est déclaré en dépendance directe (`npm ls exceljs` confirme `exceljs@4.4.0` dans l'arbre) mais n'est appelé nulle part dans le code applicatif — code mort du point de vue de ce risque. De plus la faille ne se déclenche que si l'appelant fournit lui-même un buffer en paramètre, ce qu'`exceljs` ne fait pas en interne pour un usage normal (génération de xlsx). Sévérité réelle : négligeable. |

**Correctif recommandé** : `npm audit fix` (non-breaking) résorbe l'avis esbuild via mise à jour de `vite`. Pour `uuid`, soit retirer `exceljs` du `package.json` si vraiment inutilisé (à confirmer avec l'équipe — peut-être prévu pour une fonctionnalité future d'export), soit `npm audit fix --force` (breaking, `uuid@14`).

---

## Tâche 3 — Trace d'audit pour actions sensibles

Recherche exhaustive dans `server/prisma/schema.prisma` : aucun modèle `AuditLog`, `ActivityLog`, `EventLog` ou équivalent. **Confirmé absent.**

| Action | Fichier + ligne | Trace au-delà d'un log applicatif générique ? |
|---|---|---|
| Suppression client | `server/src/services/client.service.ts:48-62` (`deleteClient`) | ❌ Aucune. `clientRepository.delete(id)` (ligne 59) effectue l'opération (soft-delete, cf. round 4 B1d) puis seule une invalidation de cache a lieu (ligne 60) — pas de ligne écrite dans une table de trace, pas même un `logger.info` observé dans ce fichier. |
| Changement de rôle | `server/src/services/user.service.ts:54-61` (`updateUser`) | ❌ Aucune. `userRepository.update(id, { name, role })` (ligne 61) — aucune écriture parallèle, aucun log. Seule garde métier : protection du dernier ADMIN (ligne 57-59), pas de traçabilité de qui a changé quoi. |
| Annulation de facture | `server/src/services/invoice.service.ts:161-162` (`cancelInvoice` déduit du contexte) | ❌ Aucune. `invoiceRepository.update(id, { status: "CANCELLED" })` (ligne 162) — pas de ligne d'historique de statut, pas de raison de l'annulation persistée. |
| Commission marquée payée | `server/src/services/commission.service.ts:107-125` (`markPaid`) | ⚠️ Partiel. `commissionRepository.markPaid(id)` fait la transition d'état, et une **notification** est envoyée au partenaire (`enqueueNotifications`, ligne 115-122) — ceci crée une ligne `Notification` en base, donc une trace indirecte existe (destinataire, montant, date), mais ce n'est pas un journal d'audit immuable : la ligne `Notification` peut être marquée lue/supprimée par le destinataire et n'enregistre pas *qui* (quel ADMIN) a déclenché le paiement. |
| Changement de permission MANAGER | `server/src/services/managerPermission.service.ts:80-84` (`update`) | ❌ Aucune. `managerPermissionRepository.update(userId, data)` (ligne 81) puis invalidation de cache (ligne 82) — aucune trace de l'ancien vs nouveau jeu de permissions, ni de qui (quel ADMIN) a fait le changement. |

**Constat global** : aucune des 5 actions sensibles définies n'a de trace immuable dédiée (table `AuditLog` ou équivalent). Seule la commission bénéficie d'une trace indirecte via `Notification`, insuffisante pour une reconstitution forensique (pas d'auteur, pas de valeur avant/après, mutable par le destinataire). C'est un manque structurel identique pour les 5 actions — recommandation : ajouter un modèle `AuditLog` (acteur, action, entité, avant/après JSON, timestamp, IP) et l'appeler depuis ces 5 handlers au minimum.

---

## Tâche 4 — Données personnelles / vie privée

**Export/suppression sur demande (GDPR-like)** — grep exhaustif de `export`, `gdpr`, `rgpd`, `anonymize` (insensible à la casse) sur tout `server/src` : aucun mécanisme applicatif trouvé. Seule mention du sujet dans tout le dépôt est un **commentaire de données de démo** (`server/prisma/seed.ts:429` : commentaire de tâche fictive *"Revue juridique en cours pour le transfert des données (RGPD tunisien)"* — texte de contenu seedé, pas un mécanisme réel). ❌ Aucune fonctionnalité d'export ou d'anonymisation sur demande n'existe dans le code applicatif.

**Fuite de champs sensibles dans les logs** — grep de `logger.error`/`logger.info`/`logger.warn`/`console.log` à proximité de `password`, `token`, `hourlyRate`, `secret` sur tout `server/src` : un seul résultat, `server/src/services/auth.service.ts:169` :
```
logger.error({ err: error }, "[auth] Failed to enqueue password reset email");
```
Ce log capture l'objet `error` (échec d'envoi d'email), pas le token ni le mot de passe eux-mêmes — le `resetToken` en clair n'est jamais passé au logger (seul son hash SHA-256 va en base, ligne 154/159). ✅ Aucune fuite de secret en clair trouvée dans les logs applicatifs après grep exhaustif.

**Rétention des leads/candidatures rejetés** — `server/src/jobs/processors/maintenance.processor.ts` lu intégralement (289 lignes) : les seules purges/archivages automatiques concernent `refreshToken` (ligne 10-19, expirés/révoqués), `Lead`/`ContactRequest`/`Notification`/`Document` **archivés** (pas supprimés — déplacés vers des tables `*Archive` via `ARCHIVE_RULES`, lignes 35-60) selon des seuils (`Lead`: 30j après `archivedAt`, `ContactRequest`: 180j, `Notification`: 90j, `Document`: 365j), et `analyticsEvent` purgé après 13 mois (ligne 283-288, `pruneOldEvents(13)`). **Aucune règle spécifique aux candidatures freelancer rejetées** (`FreelancerApplication`, modèle mentionné en fin de `seed.ts:735` "Freelancer Application model") n'apparaît dans `ARCHIVE_RULES` (lignes 35-60) — pas de purge, conservées indéfiniment. ⚠️ Les leads sont archivés (pas effacés) après 30 jours ; les candidatures rejetées n'ont aucune politique de rétention/purge du tout.

---

## Tâche 5 — Accessibilité WCAG du site public

Fichiers lus intégralement : `client/src/features/landing/pages/ContactPage.tsx` (340 lignes), `client/src/features/landing/components/BookingCalendar.tsx` (331 lignes).

| Vérification | Fichier + ligne | Constat | Statut |
|---|---|---|---|
| `alt` sur `<img>` | Les deux fichiers | Aucune balise `<img>` native dans ces deux composants (icônes via `lucide-react`, composants SVG qui héritent d'`aria-hidden` par défaut de la lib) — pas de risque d'`alt` manquant ici faute d'`<img>`. | ✅ Non applicable |
| Association `<label>`/input | `ContactPage.tsx:154-157` (`htmlFor="contact-serviceType"` / `id="contact-serviceType"`), `:186-189` (`contact-budget`), `:211,216` (`contact-message`), `:296,302` (helper `Field`, `id` généré dynamiquement `contact-${registration.name}`, ligne 293) | Toutes les associations `htmlFor`/`id` sont correctes et cohérentes. `BookingCalendar.tsx:301-302, 306-307, 311-312, 316-317` (`booking-name`, `booking-email`, `booking-phone`, `booking-notes`) — mêmes paires `Label htmlFor` / `Input id` correctement appariées. | ✅ |
| Erreurs de formulaire annoncées | `ContactPage.tsx:172, 204, 224` (`role="alert"` sur les messages d'erreur), `:161-162, 192-193, 218-219` (`aria-invalid`, `aria-describedby` reliant le champ à son message d'erreur) | Bon pattern d'accessibilité, au-delà du strict WCAG basique demandé. | ✅ |
| Bloqueurs de navigation clavier | `BookingCalendar.tsx:224-236` (bouton jour en vue semaine), `:257-269` (bouton créneau) | Les deux éléments interactifs critiques (sélection de jour, sélection de créneau) sont des `<button type="button">` natifs, pas des `<div onClick>` — navigables et activables au clavier nativement (Tab + Enter/Espace), avec `disabled` correctement posé quand non applicable (ligne 229). | ✅ |
| Calendrier mensuel (`UiCalendar`) | `BookingCalendar.tsx:209-217` | Composant `Calendar` interne (`@/components/ui/calendar`, non lu dans cette session — hors des deux fichiers ciblés par la tâche) — probablement basé sur `react-day-picker` (accessible par défaut) vu l'usage (`mode="single"`, `modifiers`), mais non vérifié directement ; à confirmer séparément si un audit clavier strict du calendrier est requis. | ⚠️ Non vérifié (composant tiers hors périmètre des 2 fichiers ciblés) |
| Honeypot anti-bot | `ContactPage.tsx:117-124` | Champ caché `website` avec `tabIndex={-1}`, `aria-hidden="true"`, positionné hors écran plutôt que `display:none` — bonne pratique qui évite qu'un lecteur d'écran mal configuré ne le lise, et qui ne casse pas la tabulation (bien que `tabIndex={-1}` suffise déjà à l'exclure du flux). | ✅ |

Aucun bloqueur de navigation clavier trouvé dans les deux composants ciblés ; tous les champs de formulaire ont un label correctement associé.

---

## Tâche 6 — Hygiène secrets/config

Grep exhaustif de `process\.env\.\w+\s*(\?\?|\|\|)` sur tout `server/src` — 10 correspondances, **aucune ne concerne une variable sensible** (JWT, clé de chiffrement, clé API, secret webhook, secret de session, identifiants DB/admin, secret OAuth) :

| Fichier + ligne | Fallback | Sensible ? |
|---|---|---|
| `server/src/observability/collectors.ts:38-39,42` | `REDIS_HOST ?? "127.0.0.1"`, `REDIS_PORT ?? 6379`, `REDIS_DB ?? 0` | Non — config réseau locale par défaut, pas un secret |
| `server/src/middlewares/upload.middleware.ts:5` | `UPLOAD_MAX_BYTES ?? 20*1024*1024` | Non — limite de taille |
| `server/src/utils/logger.ts:14` | `LOG_LEVEL || "info"` | Non |
| `server/src/utils/dateRange.ts:12` | `BUSINESS_TIMEZONE ?? "Africa/Tunis"` | Non |
| `server/src/routes/index.ts:117-118,122` | Mêmes défauts Redis que ci-dessus | Non |

**Vérification ciblée des variables réellement sensibles** (`server/src/config/env.ts`, lu intégralement, 119 lignes) : `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` sont déclarées `z.string().min(32)` **sans `.default(...)`** (ligne 9-10) — donc **obligatoires**, le serveur refuse de démarrer si absentes (zod lève au parse, ligne 78). `INTEGRATIONS_ENCRYPTION_KEY`, `S3_SECRET_ACCESS_KEY`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SMTP_PASSWORD` sont toutes `.optional()` **sans fallback hardcodé** (lignes 20, 50, 64, 67) — leur absence cause soit un échec fonctionnel explicite plus tard (comportement déjà documenté au round 4 pour `INTEGRATIONS_ENCRYPTION_KEY`), soit une garde de démarrage dédiée (`env.ts:99-118`, throw explicite si Google OAuth configuré sans clé de 32 bytes valide). ✅ **Aucun secret sensible n'a de valeur par défaut hardcodée qui fonctionnerait silencieusement en production.**

Bonus trouvé : `env.ts:80-93` définit `KNOWN_PLACEHOLDER_SECRETS` (valeurs `"your-super-secret-jwt-key-min-32-chars"` etc.) et **refuse de démarrer en production** si les secrets JWT correspondent à ces placeholders connus (ligne 85-93) — garde-fou explicite contre un oubli de configuration en prod. ✅

**`server/prisma/seed.ts`** (743 lignes, lu en quasi-intégralité) : identifiants de démo hardcodés en clair — `admin123`/`manager123`/`client123`/`freelancer123` (lignes 90-93), comptes `admin@secritou.tn`, `manager@secritou.tn`, `client1@example.tn` etc. Le fichier prévoit un garde-fou partiel : `SEED_DEMO=false` (ligne 108) saute les données de démo (clients, projets, factures fictifs Carrefour/Monoprix/etc.) mais **ne saute PAS la création du compte `admin@secritou.tn` / `admin123`** (ligne 97-101, en dehors du bloc `if (seedDemo)` qui commence ligne 111) — ce compte admin à mot de passe faible et connu publiquement (présent dans le code source) serait créé **même en mode "production-ready"** (`SEED_DEMO=false`). ⚠️ Aucun mécanisme n'empêche techniquement d'exécuter `prisma db seed` contre une base de production (pas de vérification `NODE_ENV`, pas de confirmation interactive, pas de check "la base contient déjà des données réelles" au-delà du `skipIf` qui ne s'applique qu'aux données de démo, pas au compte admin). Recommandation : forcer un mot de passe admin aléatoire généré (et affiché une seule fois) plutôt qu'un hardcodé, ou bloquer l'exécution du seed si `NODE_ENV==="production"` sans variable d'override explicite.

---

## Synthèse des nouveaux constats (Round 5 / B2)

### Sévérité Moyenne
1. Changement de rôle ne révoque pas les sessions existantes — fenêtre de 15 min max avec l'ancien rôle actif (`user.service.ts:54-61`).
2. Aucune trace d'audit immuable pour les 5 actions sensibles définies (suppression client, changement de rôle, annulation facture, commission payée, permission MANAGER) — `client.service.ts:59`, `user.service.ts:61`, `invoice.service.ts:162`, `commission.service.ts:111`, `managerPermission.service.ts:81`.
3. Compte admin de seed (`admin@secritou.tn` / `admin123`) créé même avec `SEED_DEMO=false`, aucun garde-fou empêchant l'exécution en prod — `server/prisma/seed.ts:97-101, 108-111`.
4. Aucune politique de rétention/purge pour les candidatures freelancer rejetées (conservées indéfiniment, contrairement aux leads archivés à 30j) — absence dans `maintenance.processor.ts:35-60`.

### Sévérité Faible
5. Aucun mécanisme GDPR-like d'export/suppression sur demande pour client ou freelancer.
6. `esbuild`/`uuid` : 3 vulnérabilités npm audit (1 low, 2 moderate), toutes deux non exploitables dans le contexte actuel (dev-server only / dépendance non utilisée dans le code).

### Points confirmés sains
- Rotation de refresh token avec détection de réutilisation et révocation de famille — implémentation correcte (`auth.service.ts:97-132`).
- Logout révoque réellement côté serveur (pas seulement client-side) — `auth.service.ts:141-147`.
- Changement de mot de passe et reset password invalident toutes les sessions actives — `auth.service.ts:192, 207`.
- Aucun secret sensible avec fallback hardcodé silencieux — `env.ts` entièrement revu.
- Formulaires publics (contact, booking) : labels correctement associés, pas de bloqueur clavier, erreurs annoncées via `role="alert"`.
- Aucune fuite de secret en clair dans les logs applicatifs après grep exhaustif.

---

## Zones d'ombre
- Composant `Calendar` interne (`@/components/ui/calendar`) utilisé par `BookingCalendar.tsx:209` non audité directement (hors des deux fichiers explicitement ciblés par la tâche 5).
- Le comportement exact du middleware d'authentification quant à une revalidation du rôle en base à chaque requête (au-delà du rôle signé dans le JWT) n'a pas été vérifié dans cette session — pertinent pour évaluer précisément la fenêtre d'exposition du point 1 ci-dessus.
- `FreelancerApplication` (modèle mentionné `seed.ts:735`) : schéma Prisma non relu en détail dans cette session pour confirmer l'absence totale de champ de rétention/expiration au niveau du modèle lui-même (le constat repose sur l'absence de job de purge, pas sur une relecture du schéma).
