# Plan d'action — Audit Secritou (à donner à Claude Code)

Checklist consolidée à partir de l'audit exhaustif (12 domaines). Classée par priorité. Chaque item a : fichier(s), problème, sévérité, effort estimé.

---

## 🔴 PRIORITÉ 1 — Failles de sécurité exploitables (à corriger en premier)

- [ ] **IDOR — `summary.routes.ts`** : n'importe quel CLIENT/FREELANCER peut lire le résumé financier de n'importe quel client/projet (pas de vérification d'ownership).
  Fichiers : `server/src/routes/summary.routes.ts:14-15`, `summary.controller.ts`, `summary.repository.ts`
  Fix : ajouter un contrôle de scope (clientId/projectId doit correspondre à l'utilisateur) + `validate()` sur les params UUID.
  Effort : petit (~2-3h)

- [ ] **IDOR — `clientOnboarding` (lecture ET écriture)** : un CLIENT authentifié peut voir/modifier l'onboarding d'un autre client (paiements, contrats, questionnaires) en devinant un ID.
  Fichiers : `server/src/routes/clientOnboarding.routes.ts:37-152`, `clientOnboarding.controller.ts`, `clientOnboarding.service.ts:26-32`, `clientOnboarding.repository.ts`
  Fix : filtrer par `clientId` du user authentifié dans toutes les méthodes `findById`/`findByProjectId`/`update*`.
  Effort : moyen (~15 méthodes à toucher)

- [ ] **Bypass de scope silencieux — `proposal.service.ts` `getById`** : `await` manquant sur `assertProposalInScope`, un MANAGER restreint à un service peut lire des propositions d'un autre pôle.
  Fichier : `server/src/services/proposal.service.ts:148-152`
  Fix : ajouter `await`. Effort : trivial (1 ligne).

- [ ] **IDOR cross-pole — `serviceRequest` routes admin détail** : `adminGetServiceRequestById`/`adminUpdateServiceRequest`/`adminDeleteServiceRequest` ne filtrent pas par service/pôle du MANAGER (contrairement à la liste).
  Fichiers : `serviceRequest.controller.ts:52-78`, `serviceRequest.service.ts`, `serviceRequest.repository.ts:122-128`
  Fix : injecter le scope service dans `findById`/`findByIdSimple`. Effort : petit (~1-2h)

- [ ] **Escalade horizontale — MANAGER peut changer `serviceId`/`clientId` d'un projet** via `updateProject`, sortant ainsi de son pôle.
  Fichier : `server/src/services/project.service.ts:70-92`
  Fix : ignorer/écraser `serviceId` envoyé par un MANAGER, comme dans `createProject`. Effort : petit (~30 min)

- [ ] **Approval accept/reject rejouable indéfiniment** : aucun garde-fou de statut `PENDING`, contrairement à `update`/`delete`. Un statut `REJECTED` peut être re-flippé en `APPROVED` pour débloquer la clôture de projet.
  Fichier : `server/src/services/approval.service.ts:77-153`
  Fix : ajouter `if (approval.status !== "PENDING") throw 409` sur `approve()`/`reject()`. Effort : petit (~15 min)

- [ ] **`invoice.service.ts` `addPayment` ne vérifie pas le statut de la facture** : possible d'ajouter un paiement sur une facture `CANCELLED`/`DRAFT`.
  Fichier : `server/src/services/invoice.service.ts:195-235`
  Fix : `throw 409` si `status === "CANCELLED"` avant création du paiement. Effort : petit (~15-30 min)

- [ ] **Fuite lors de la révocation du hourlyRate freelance** : tout FREELANCER authentifié voit le taux horaire des autres via l'annuaire.
  Fichier : `server/src/controllers/freelancer.controller.ts:6-23`, `freelancer.repository.ts:24-30`
  Fix : étendre `redactEmail` pour aussi masquer `hourlyRate`/`bio` quand l'appelant est FREELANCER et que ce n'est pas son propre profil. Effort : petit (~30 min)

- [ ] **Cache cross-scope — `/analytics/summary`** : clé de cache ne contient pas le scope (userServiceId), un MANAGER peut voir les données d'un autre pôle (ou d'ADMIN) pendant 60s.
  Fichier : `server/src/routes/analytics.routes.ts:16-30`, `cache.middleware.ts:6-23`
  Fix : inclure le scope dans la clé de cache. Effort : petit (~30-45 min) — vérifier aussi les autres routes utilisant `httpCache`.

- [ ] **Clé HMAC OAuth (GSC) avec fallback silencieux vide** : si `INTEGRATIONS_ENCRYPTION_KEY` n'est pas configurée, la signature CSRF utilise une clé vide connue publiquement.
  Fichier : `server/src/services/gscConnection.service.ts:22-26`
  Fix : utiliser `env.INTEGRATIONS_ENCRYPTION_KEY` (validé) et `throw` si absent, comme `encryption.ts`. Effort : petit (~5 lignes)

- [ ] **Approval routes — pas de scope MANAGER par service** sur `GET/:id`, `PUT/:id`, `approve/reject/comment`.
  Fichier : `server/src/routes/approval.routes.ts:40-62`
  Fix : ajouter `buildServiceScope` + assertion, comme dans `proposal.service.ts`. Effort : moyen

---

## 🟠 PRIORITÉ 2 — Cohérence financière (silencieux mais impact réel)

- [ ] **Facture de solde incohérente avec le devis** : `balanceAmount` recalculé indépendamment (`0.7 * total`) au lieu du complément `total - deposit`, écart de ±0.001 TND sur la majorité des montants.
  Fichiers : `proposal.service.ts:371` (dépôt), `project.service.ts:221` (solde), comparer à `documentGenerator.service.ts:381-382` (PDF devis, cohérent)
  Fix : `balanceAmount = roundMoney(proposalAmount - depositAmount)`. Effort : petit (~15 min) + vérifier réconciliation des paires existantes.

- [ ] **Race condition — double paiement (`addPayment`)** : la dé-duplication est heuristique (fenêtre de 10s), pas de verrou DB ni clé d'idempotence.
  Fichier : `server/src/services/invoice.service.ts:198-235`
  Fix : clé d'idempotence côté client OU `SELECT ... FOR UPDATE` sur la facture. Effort : moyen (~1-2h)

- [ ] **Race condition — `creditNote.applyCredit`** : vérification `appliedAt` puis écriture sans verrou de ligne.
  Fichier : `server/src/services/creditNote.service.ts:89-139`
  Fix : verrou de ligne (`FOR UPDATE`) avant le check. Effort : moyen (~1h)

- [ ] **Doublon de facture de solde possible** en cas de double-clic sur `clientApprove` (pas de re-vérification dans la transaction).
  Fichier : `server/src/services/project.service.ts:190-249`
  Fix : re-vérifier `balanceAlreadyExists` dans la transaction ou contrainte unique DB `(projectId, invoiceType)`. Effort : moyen (~1-2h, migration incluse)

- [ ] **`addItem`/`updateItem` (invoice) sans `roundMoney`** — incohérent avec le reste du code (artefacts flottants masqués par la colonne Decimal(14,3) mais fragile).
  Fichier : `server/src/services/invoice.service.ts:280, 298`
  Fix : envelopper dans `roundMoney()`. Effort : trivial (~5 min)

- [ ] **`addPayment` — arithmétique flottante sans `roundMoney`** sur `amountPaid`/`overpaidBy`, contrairement à `applyCredit`.
  Fichier : `server/src/services/invoice.service.ts:208-218`
  Fix : envelopper dans `roundMoney()`. Effort : petit (~10 min)

- [ ] **`invoiceService.addPayment` — `throw new Error` au lieu de `HttpError(404)`** sur facture introuvable → probablement un 500 au lieu d'un 404.
  Fichier : `server/src/services/invoice.service.ts:200`
  Fix : utiliser `HttpError(404, ...)`. Effort : trivial

- [ ] **Code mort dangereux — `proposalService.accept()`** : version non-transactionnelle dupliquant `acceptWithCascade`, jamais appelée mais risque de mauvais branchement futur.
  Fichier : `server/src/services/proposal.service.ts:286-301`
  Fix : supprimer ou marquer clairement deprecated. Effort : trivial (~5 min)

---

## 🟡 PRIORITÉ 3 — Fiabilité opérationnelle / notifications manquantes

- [ ] **Commission : aucune notification à aucune étape du cycle de vie** (création, paiement). Aucun job ne scanne les commissions en attente.
  Fichier : `server/src/services/commission.service.ts`
  Fix : ajouter `COMMISSION_EARNED`/`COMMISSION_PAID`, enqueue notifications, ajouter un job `check-pending-commissions`. Effort : moyen

- [ ] **Lead : pas de notification de création, pas de job de relance ("stale lead")**.
  Fichier : `server/src/services/lead.service.ts:47-51`
  Fix : notification à la création + job `check-stale-leads` similaire à `check-stale-projects`. Effort : moyen

- [ ] **Connexion GSC révoquée : échec silencieux permanent**, aucune alerte admin (juste écrit dans `lastSyncError`, jamais affiché sauf visite manuelle).
  Fichiers : `googleOAuth.service.ts:49-54`, `searchConsole.service.ts:14-89`, `gscConnection.repository.ts:38-40`
  Fix : catch spécifique `invalid_grant`/401, notifier l'admin, envisager auto-déconnexion. Effort : moyen

- [ ] **`MEETING_REMINDER` sans icône dans la cloche de notification** — retombe sur l'icône générique.
  Fichier : `client/src/components/NotificationBell.tsx`
  Fix : ajouter un `case`. Effort : trivial

- [ ] **Échec email permanent visible seulement via Sentry**, pas de notification admin in-app.
  Fichiers : `jobs/index.ts:57-65`, `communication.processor.ts`
  Fix : optionnel — ajouter notification admin sur échec définitif. Effort : petit-moyen

- [ ] **`upload.service.ts` `deleteFile` avale toutes les erreurs silencieusement** (pas seulement "déjà supprimé").
  Fichier : `server/src/services/upload.service.ts:253-260`
  Fix : logger les erreurs réelles séparément du cas "déjà absent". Effort : petit

- [ ] **`clientSuccess` — `clientId` dans les routes imbriquées n'est jamais vérifié** (decoratif), latent si le scope MANAGER par client est introduit un jour.
  Fichiers : `clientSuccess.controller.ts:39-105`, `clientSuccess.service.ts:99-149`
  Fix : vérifier que l'objectif/métrique appartient bien au `clientId` de l'URL. Effort : petit

---

## 🟢 PRIORITÉ 4 — Performance

- [ ] **N+1 — `addItemsFromTimeEntries`** : une création séquentielle par entrée de temps dans une transaction (latence + contention de verrous).
  Fichier : `server/src/services/invoice.service.ts:317-363`
  Fix : remplacer par `createMany`, vérifier si les appelants ont besoin des IDs individuels. Effort : petit (~30 min)

---

## 🔵 PRIORITÉ 5 — Contrat front/back, dette de code, tests, i18n

- [ ] **Aucun test serveur n'existe** (`server/src/**/*.test.ts` = 0 résultat). Les tests client (7 fichiers) sont fiables et à jour — bonne nouvelle, à garder.
  Fix : prioriser des tests sur `invoice.service.ts` (paiements, cascade), `proposal.service.ts` (`acceptWithCascade`), `creditNote.service.ts`. Effort : gros chantier.

- [ ] **Gates de statut côté client non ré-validées côté serveur** dans certains cas (déjà couvert en P1/P2 pour Approval/Invoice) — vérifier aussi `AddPaymentDialog.tsx` (aucun check de statut avant `mutate`).
  Fichier : `client/src/features/invoices/components/AddPaymentDialog.tsx`
  Effort : petit, lié au fix Priorité 1/2 sur `addPayment`.

- [ ] **Pattern `t(key, "valeur française par défaut")` masquant des clés i18n manquantes** (fonctionnalité "corbeille/restaurer" ajoutée récemment) — apparaît hardcodé en anglais.
  Fichiers concernés : `InvoicesPage.tsx`, `ProjectsPage.tsx`, `ClientsPage.tsx` (clés `common.trash`, `common.restore`, `*.trashDesc`, `*.trashEmpty`, `invoices.resumeReminders`, `invoices.pauseReminders`, etc.)
  Fix : ajouter les clés manquantes en `fr`/`en` dans les deux fichiers de traduction. Effort : petit (~20 min)

- [ ] **Textes en dur (français) sur plusieurs pages malgré infrastructure i18n complète** :
  - `ClientDetailPage.tsx` : onglet entier "Avoirs" (Credit Notes) jamais traduit, + ~10 autres chaînes (lignes 258-665)
  - `ProjectsPage.tsx` : titre de page `<h1>Projets</h1>`, onglets, tri, toasts (lignes 77-644)
  - `LeadsPage.tsx` : toasts + dialogues de confirmation (delete/convert/reopen), + incohérence sur le dropdown "source" en édition qui affiche le français brut
  - `ClientsPage.tsx` : toasts + tri + dialogue suppression
  - `ProposalsPage.tsx` : dialogue "Générer une facture" entier non traduit
  - `ApplicationsPage.tsx` : mélange (bannière en français hardcodé + dialogue preview CV/Portfolio en anglais hardcodé)
  Fix : extraire en clés i18n. Effort total : moyen-gros (~15-20 items), mais le pattern du dialogue de suppression (`ConfirmDeleteDialog`) est dupliqué dans 4+ fichiers → factoriser une seule fois. Effort : moyen.

- [ ] **`fallbackLng: "fr"`** dans la config i18n — vérifier que c'est le comportement voulu (un anglophone verrait du français si une clé manquait, pas l'inverse).
  Fichier : `client/src/i18n/index.ts:24`
  Effort : décision produit, pas un bug en soi (actuellement 0 clé manquante).

- [ ] **Tâches (task comments) : pas de validation Zod sur le corps de la requête**.
  Fichier : `server/src/routes/task.routes.ts:26` (pas de `validate()`)
  Fix : ajouter un schema `addTaskCommentSchema` avec limite de longueur. Effort : petit (~20 min)

- [ ] **Commentaires de tâche non scopés par pôle pour MANAGER** (`existsInCompany` ne filtre pas par service, contrairement à `findById`/`findAll`).
  Fichier : `server/src/repositories/task.repository.ts:85-92`
  Fix : passer le scope service dans `existsInCompany`. Effort : petit (~20-30 min)

- [ ] **`updateUser` (ADMIN) permet à un admin de se retirer lui-même son propre rôle** sans garde-fou "dernier admin".
  Fichier : `server/src/controllers/user.controller.ts`
  Fix : optionnel, robustesse métier. Effort : petit

---

## Notes de méthodo à transmettre à Claude Code
- Les items Priorité 1 et 2 sont vérifiés avec citations fichier:ligne précises dans l'audit complet — les corrections peuvent être faites directement sans re-vérification longue.
- Toujours vérifier après correction : rejouer le scénario de repro donné dans l'audit (ex: double `POST /approvals/:id/respond`, facture annulée + paiement, etc.) avant de considérer le fix validé.
- Ne pas casser les protections déjà en place et confirmées saines : `aiConversation`, `permissionProfile`/`managerPermission` (ADMIN-only, pas d'auto-escalade), `upload.service.ts` (validation magic-byte), `search.repository.ts` (scope correct par rôle).
