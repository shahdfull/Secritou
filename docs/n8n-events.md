# Catalogue des événements n8n (`notifyN8n`)

Ce document liste tous les événements émis par Secritou vers n8n via `notifyN8n(event, payload)`
(`server/src/utils/webhook.ts`). Chaque appel est fire-and-forget, signé HMAC-SHA256
(header `X-Secritou-Signature`), timeout 5s, 2 tentatives — il ne bloque jamais l'opération
métier qui le déclenche.

Convention de payload commune : un `agencyEmail` (= `env.CONTACT_RECEIVER_EMAIL`) quand
l'événement concerne l'agence, un `adminUrl` vers l'écran back-office pertinent, et les IDs
nécessaires pour que le workflow n8n récupère plus de contexte si besoin via un callback
signé (voir `verifyN8nWebhook` middleware pour le sens inverse).

**Contrat du callback entrant (SEC-110)** : tout workflow n8n qui rappelle un `callbackUrl`
(`PATCH /freelancer-applications/:id/ai-summary`, `PATCH /projects/:id/ai-specs`) DOIT inclure
un champ `timestamp` (epoch millisecondes, `Date.now()` équivalent) dans le corps JSON avant de
le signer avec le secret partagé — `verifyN8nWebhook` rejette désormais (401
`STALE_WEBHOOK`) tout callback dont le `timestamp` est absent, malformé, ou en dehors d'une
fenêtre de fraîcheur de 5 minutes autour de l'heure serveur, indépendamment du garde-fou Redis
(qui reste une seconde barrière, fail-open si Redis est indisponible). Exemple de corps signé
attendu : `{ "aiSummary": "...", "timestamp": 1737360000000 }`.

---

## Événements déjà en place (avant ce lot de 12 hooks)

### `proposal.accepted`
- **Déclencheur** : `services/proposal.service.ts`, `acceptWithCascade` (après la transaction
  d'acceptation).
- **Payload** : `proposalId`, `title`, `amount`, `currency`, `clientId`, `clientName`,
  `projectId`, `adminUrl`, `agencyEmail`, `internalRecipients` (liste ADMIN + manager du pôle
  avec permission `proposals.read`, déjà résolue côté code).
- **Comportement attendu** : envoyer un email à l'agence + aux destinataires internes fournis.

### `invoice.overdue`
- **Déclencheur** : `jobs/processors/maintenance.processor.ts`, `markOverdueInvoices` (cron
  quotidien).
- **Payload** : `agencyEmail`, `invoices[]` (`invoiceId`, `number`, `amount`, `currency`,
  `clientName`, `adminUrl`).
- **Comportement attendu** : email récapitulatif des factures nouvellement en retard.

### `invoice.followup`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkInvoiceFollowup` (cron
  hebdomadaire, tous tiers FIRST/SECOND/FINAL).
- **Payload** : `agencyEmail`, `invoices[]` (`invoiceId`, `number`, `amount`, `currency`,
  `clientName`, `daysOverdue`, `adminUrl`).
- **Comportement attendu** : email de relance hebdomadaire.

### `invoice.paid`
- **Déclencheur** : `services/invoice.service.ts`, `addPayment` (quand un paiement est
  enregistré).
- **Payload** : `invoiceId`, `number`, `amountPaid`, `totalAmount`, `currency`, `fullyPaid`,
  `clientId`, `clientName`, `adminUrl`, `agencyEmail`.
- **Comportement attendu** : email de confirmation à l'agence.

### `project.stale`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkStaleProjects` (cron
  quotidien).
- **Payload** : `agencyEmail`, `projects[]` (`projectId`, `name`, `daysSince`, `adminUrl`).
- **Comportement attendu** : email récapitulatif des projets inactifs.

### `project.client_approved`
- **Déclencheur** : `services/project.service.ts`, `clientApprove`.
- **Payload** : `projectId`, `name`, `clientId`, `clientName`, `balanceInvoiceId`, `adminUrl`,
  `agencyEmail`.
- **Comportement attendu** : email à l'agence confirmant la validation client + génération de
  la facture de solde.

### `lead.created`
- **Déclencheur** : `services/lead.service.ts`, `createLead`.
- **Payload** : `leadId`, `name`, `email`, `phone`, `source`, `adminUrl`, `agencyEmail`.
- **Comportement attendu** : email de notification d'un nouveau lead.

### `serviceRequest.created`
- **Déclencheur** : `services/serviceRequest.service.ts`, `createServiceRequest`.
- **Payload** : `serviceRequestId`, `title`, `description`, `type`, `clientId`, `clientName`,
  `adminUrl`, `agencyEmail`.
- **Comportement attendu** : email récapitulant la nouvelle demande (Support / Nouveau projet).

### `freelancer.applied`
- **Déclencheur** : `services/freelancerApplication.service.ts`, `createApplication` (si le CV
  est un PDF texte-extractible).
- **Payload** : `applicationId`, `firstName`, `lastName`, `email`, `position`, `cvText`,
  `adminUrl`, `agencyEmail`, `callbackUrl` (→ `PATCH /freelancer-applications/:id/ai-summary`).
- **Comportement attendu** : générer un résumé IA du CV (Mistral) et le renvoyer via
  `callbackUrl`, signé.

### `project.brief_submitted`
- **Déclencheur** : `services/project.service.ts`, `submitBrief`.
- **Payload** : `projectId`, `projectName`, `serviceType`, `briefData` (JSON questionnaire),
  `callbackUrl` (→ `PATCH /projects/:id/ai-specs`), `agencyEmail`.
- **Comportement attendu** : générer les 6 sections du cahier des charges + la roadmap
  (estimations par étape) via Mistral, renvoyer `{ sections, roadmap }` signé via
  `callbackUrl`.

### `gsc.anomaly_detected`
- **Déclencheur** : `services/searchConsole.service.ts`, `syncAllConnectedClients` (après le
  cron de synchronisation quotidien).
- **Payload** : `agencyEmail`, `anomalies[]` (`clientId`, `clientName`, `latestClicks`,
  `baselineAverage`, `changePct`, `direction`, `adminUrl`).
- **Comportement attendu** : interprétation IA de chaque anomalie (Mistral) + email interne
  uniquement (pas envoyé au client directement).

### `ceo.weekly_report`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `weeklyCeoReport` (cron
  hebdomadaire, lundi).
- **Payload** : `agencyEmail`, `weekStart`, `weekEnd`, `newLeads`, `completedProjects`,
  `totalRevenue`, `currency`, `doneTasks`, `totalTasks`, `taskCompletionPct`, `dashboardUrl`.
- **Comportement attendu** : résumé narratif IA (Mistral) des chiffres + email.

---

## Nouveaux événements (ce lot)

### 1. `meeting.reminder_due`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkMeetingReminders` (cron
  quotidien, existant — notif in-app seule jusqu'ici).
- **Payload** : `{ projectId: string; projectName: string; clientName?: string;
  nextMeetingDate: Date; adminUrl: string; agencyEmail: string }`
- **Comportement attendu** : alerte externe (email/Slack) en plus de la notif in-app, pour ne
  pas dépendre de l'ouverture de l'app pour être notifié d'une réunion à venir.

### 2. `gsc.connection_revoked`
- **Déclencheur** : `services/searchConsole.service.ts`, `handleGscRevocation` (appelé sur
  token OAuth révoqué ou 401 Google).
- **Payload** : `{ clientId: string; clientName?: string; siteUrl?: string; adminUrl: string;
  agencyEmail: string }`
- **Comportement attendu** : alerte prioritaire — incident silencieux qui coupe le tracking
  SEO d'un client tant que personne ne reconnecte manuellement.

### 3. `proposal.expired`
- **Déclencheur** : `jobs/processors/maintenance.processor.ts`, `expireProposals` (cron
  horaire, existant — notif in-app seule jusqu'ici).
- **Payload** : `{ agencyEmail: string; proposals: Array<{ proposalId: string; title: string;
  clientId: string; clientName?: string; adminUrl: string }> }`
- **Comportement attendu** : email récapitulatif des propositions expirées sans réponse
  client, aligné sur le pattern déjà utilisé par `proposal.accepted`.

### 4. `invoice.final_notice`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkInvoiceFollowup` — sous-cas
  où une facture franchit le palier `FINAL` (30+ jours de retard) pour la première fois.
- **Payload** : `{ agencyEmail: string; invoices: Array<{ invoiceId: string; number: string;
  amount: number; currency: string; clientName?: string; daysOverdue: number; adminUrl:
  string }> }`
- **Comportement attendu** : escalade distincte de `invoice.followup` — déclenche une action
  plus forte (ex. transfert au service contentieux) uniquement au moment du franchissement du
  palier final, pas à chaque relance hebdomadaire.

### 5. `document.contract_signed`
- **Déclencheur** : `services/document.service.ts`, `signDocument` (signature client du
  contrat).
- **Payload** : `{ documentId: string; projectId?: string; clientId: string; clientName?:
  string; signedAt: Date; adminUrl: string }`
- **Comportement attendu** : alerte externe en plus de la notif in-app admin déjà existante —
  déclencheur naturel pour lancer un kick-off ou une checklist post-signature côté n8n.

### 6. `creditNote.issued`
- **Déclencheur** : `services/creditNote.service.ts`, `create`.
- **Payload** : `{ creditNoteId: string; number: string; amount: number; clientId: string;
  clientName?: string; adminUrl: string; agencyEmail: string }`
- **Comportement attendu** : notification comptable — permet un export vers un outil compta
  externe ou une alerte finance.

### 7. `commission.paid`
- **Déclencheur** : `services/commission.service.ts`, `markPaid`.
- **Payload** : `{ commissionId: string; freelancerId: string; freelancerEmail?: string;
  freelancerName?: string; amount: number; currency: string; adminUrl: string }`
- **Comportement attendu** : confirmation directe au partenaire (email/SMS) que sa commission
  a été versée, en plus de la notif in-app déjà existante.

### 8. `customQuestion.sla_breach`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkCustomQuestionSla`
  (**nouveau job**, cron quotidien 08h45). Cherche les `CustomQuestion` avec `status: OPEN`
  dont le dernier message n'est pas d'un `ADMIN`/`MANAGER` et dont l'ancienneté dépasse
  `CUSTOM_QUESTION_SLA_HOURS` (défaut 24h, `env.ts`).
- **Payload** : `{ agencyEmail: string; questions: Array<{ questionId: string; subject:
  string; clientName?: string; hoursSinceAsked: number; adminUrl: string }> }`
- **Comportement attendu** : escalade SLA — alerte Slack/email si une question client reste
  sans réponse staff au-delà du seuil.

### 9. `approval.sla_breach`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkApprovalSla` (**nouveau
  job**, cron quotidien 09h00). Cherche les `Approval` avec `status: PENDING` créées il y a
  plus de `APPROVAL_SLA_DAYS` (défaut 3 jours, `env.ts`).
- **Payload** : `{ agencyEmail: string; approvals: Array<{ approvalId: string; title: string;
  clientName?: string; daysSinceRequested: number; adminUrl: string }> }`
- **Comportement attendu** : escalade SLA sur les approbations en attente trop longtemps.

### 10. `contact.hot_lead`
- **Déclencheur** : `services/contact.service.ts`, `sendContactMessage` (formulaire de contact
  public — un email transactionnel `enqueueEmail` existe déjà et n'est pas dupliqué par ce
  hook).
- **Payload** : `{ contactRequestId: string; name: string; email: string; phone?: string;
  message: string; adminUrl: string; agencyEmail: string }`
- **Comportement attendu** : canal d'alerte instantané additionnel (Slack/WhatsApp) pour
  l'équipe commerciale, en complément de l'email déjà envoyé.

### 11. `healthBoard.weekly_digest`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `weeklyHealthBoardDigest`
  (**nouveau job**, cron hebdomadaire lundi 08h00). Réutilise
  `healthBoardService.getHealthBoard()` — même scoring (`red`/`orange`/`green`) que l'écran
  Health Board admin, pas de nouvelle logique de calcul.
- **Payload** : `{ agencyEmail: string; totalProjects: number; atRiskCount: number; projects:
  Array<{ projectId: string; name: string; clientName: string; healthScore: "red"|"orange"|
  "green"; progress: number; isOverdue: boolean; isStale: boolean; adminUrl: string }>;
  dashboardUrl: string }`
- **Comportement attendu** : digest hebdomadaire — résumé IA optionnel + email listant les
  projets à risque (score ≠ green).

### 12. `freelancerApplication.interview_requested`
- **Déclencheur** : `services/freelancerApplication.service.ts`, `requestInterview` (nouvelle
  méthode, appelée via `POST /freelancer-applications/:id/request-interview`, action manuelle
  ADMIN).
- **Payload** : `{ applicationId: string; candidateName: string; candidateEmail: string;
  position: string; adminUrl: string }`
- **Comportement attendu** : envoyer au candidat un email avec un lien de prise de
  rendez-vous (Calendly ou équivalent).
- **Note de conception** : `ApplicationStatus` (Prisma) ne modélise que l'issue terminale
  (`PENDING`/`ACCEPTED`/`REJECTED`) — un entretien proposé n'est pas un nouveau statut mais une
  action latérale qui ne change pas ce statut. Rien n'est persisté sur la ligne
  `FreelancerApplication` : le seul enregistrement de cette action est l'événement n8n
  lui-même et l'email qui en résulte. Si un futur besoin de suivi (« entretien proposé le
  X », relance si pas de réponse) apparaît, il faudra un champ dédié (ex.
  `interviewRequestedAt`) plutôt que de complexifier `ApplicationStatus`.

---

## Nouvelles variables d'environnement

| Variable | Défaut | Usage |
|---|---|---|
| `CUSTOM_QUESTION_SLA_HOURS` | `24` | Seuil d'ancienneté pour `customQuestion.sla_breach` |
| `APPROVAL_SLA_DAYS` | `3` | Seuil d'ancienneté pour `approval.sla_breach` |

Ajoutées dans `server/src/config/env.ts` et `server/.env.example`.

## Nouveaux jobs BullMQ

| Job (`jobNames.ts`) | Fonction | Planification |
|---|---|---|
| `checkCustomQuestionSla` | `checkCustomQuestionSla` | `45 8 * * *` (quotidien 08h45) |
| `checkApprovalSla` | `checkApprovalSla` | `0 9 * * *` (quotidien 09h00) |
| `weeklyHealthBoardDigest` | `weeklyHealthBoardDigest` | `0 8 * * 1` (lundi 08h00) |

Enregistrés dans `server/src/jobs/index.ts`, suivant le même pattern
(`recordBullMQJob` + branchement dans le worker `maintenance` + `maintenanceQueue.add`) que
les jobs existants.

---

## Nouveaux événements (partie 2 — audit des jobs restants + rating/comment)

### 13. `lead.stale`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkStaleLeads` (cron
  quotidien 08h15, existant — notif in-app seule jusqu'ici).
- **Payload** : `{ agencyEmail: string; leads: Array<{ leadId: string; name: string;
  daysSinceLastActivity: number; adminUrl: string }> }`
- **Comportement attendu** : alerte externe additionnelle pour les leads sans activité
  récente, en plus de la notif in-app déjà en place.

### 14. `commission.pending_approval`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkPendingCommissions` (cron
  quotidien 08h30, existant — notif in-app seule jusqu'ici).
- **Payload** : `{ agencyEmail: string; commissions: Array<{ commissionId: string;
  freelancerId: string; amount: number; daysPending: number; adminUrl: string }> }`
- **Comportement attendu** : rappel externe pour accélérer la validation des commissions en
  attente.

### 15. `project.deadline_soon`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkOverdueDeadlines` (cron
  quotidien 08h30, existant — notif in-app seule jusqu'ici).
- **Payload** : `{ agencyEmail: string; projects: Array<{ projectId: string; name: string;
  clientName?: string; deadline: Date; isOverdue: boolean; adminUrl: string }> }`
- **Comportement attendu** : alerte externe (Slack/email) pour les projets dont l'échéance
  approche ou est dépassée.

### 16. `task.deadline_soon`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkTaskDeadlines` (cron
  horaire, existant). Réutilise le mécanisme de dédup déjà en place (`sentSet`, basé sur les
  `Notification` de type `TASK_DEADLINE_SOON` déjà envoyées dans la fenêtre de 6h) — le hook
  n8n n'est déclenché que pour les tâches qui viennent de passer ce filtre de dédup pendant
  l'exécution courante, jamais à chaque cron pour une tâche déjà signalée.
- **Payload** : `{ tasks: Array<{ taskId: string; title: string; projectId: string; dueDate:
  Date; assigneeId: string; adminUrl: string }> }`
- **Comportement attendu** : alerte externe (WhatsApp/Slack) à l'assigné, complémentaire à la
  notif in-app.

### 17. `task.overdue`
- **Déclencheur** : `jobs/processors/ceoAlerts.processor.ts`, `checkOverdueTasks` (cron
  quotidien 09h00, existant). Même logique de dédup que ci-dessus, appliquée au filtre
  existant `sentTaskIds` (une notif `TASK_OVERDUE` par jour calendaire max).
- **Payload** : `{ tasks: Array<{ taskId: string; title: string; projectId: string;
  assigneeId: string | null; daysOverdue: number; adminUrl: string }> }`
- **Comportement attendu** : escalade externe pour les tâches en retard non traitées.

### 18. `task.assigned`
- **Déclencheur** : `services/task.service.ts`, `createTask` et `updateTask` (au moment où la
  notif in-app « Nouvelle tâche assignée » / « Tâche assignée » est créée).
- **Payload** : `{ taskId: string; title: string; projectId: string; assigneeId: string;
  assigneeEmail?: string; dueDate?: Date; adminUrl: string }`
- **Comportement attendu** : alerte externe (WhatsApp/Slack) à l'assigné — utile en particulier
  pour les freelances qui ne consultent pas l'app en continu.

### 19. `booking.confirmed`
- **Déclencheur** : `services/booking.service.ts`, `bookSlot`. Un email transactionnel est déjà
  envoyé directement (`bookingCustomerConfirmedTemplate` / `bookingAdminNotificationTemplate`)
  — ce hook n'est pas un doublon, c'est un canal distinct.
- **Payload** : `{ bookingId: string; customerName: string; customerEmail: string;
  customerPhone?: string; startTime: Date; endTime: Date; adminUrl: string }`
- **Comportement attendu** : synchronisation calendrier externe (Google Calendar) et/ou rappel
  WhatsApp avant l'appel.

### 20. `freelancer.rating_alert`
- **Déclencheur** : `services/rating.service.ts`, `addRating`. Service qui n'avait **aucune**
  notification (ni in-app, ni n8n) avant ce lot.
- **Payload** : `{ freelancerId: string; score: number; comment?: string; ratedByUserId?:
  string; adminUrl: string }`
- **Comportement attendu** : escalade qualité immédiate (Slack) quand une note ≤
  `LOW_RATING_ALERT_THRESHOLD` (constante = `2`, définie dans `rating.service.ts` — aucun seuil
  existant dans le code, choisi comme « clairement négatif sur une échelle de 1 à 5 »).
- **Note de conception** : une notif in-app standard (`enqueueNotifications`, vers tous les
  ADMIN) est désormais envoyée pour **chaque** nouvelle note, indépendamment du score ; seul le
  hook n8n est conditionné au seuil.

### 21. `comment.new`
- **Déclencheur** : `services/comment.service.ts`, `createComment`. Service qui n'avait
  **aucune** notification (ni in-app, ni n8n) avant ce lot.
- **Payload** : `{ commentId: string; taskId: string; authorId: string; authorName?: string;
  excerpt: string; adminUrl: string }` (`excerpt` = contenu tronqué à 150 caractères).
- **Comportement attendu** : alerte externe (Slack/WhatsApp) aux personnes concernées par la
  tâche commentée.
- **Note de conception** : `task.service.ts` ne dispose pas d'un résolveur générique « qui est
  concerné par cette tâche » (il ne notifie que l'assigné à la création/réassignation). La
  résolution des destinataires réutilise donc le pattern le plus proche déjà existant dans
  `ceoAlerts.processor.ts` (`checkOverdueTasks`) : assigné de la tâche + `ADMIN`/managers du
  pôle du projet via `userRepository.findAdminsAndPoleManagers`, moins l'auteur du commentaire
  lui-même. La notif in-app et le hook n8n partagent cette même résolution.

### 22. `clientSuccess.score_dropped`
- **Déclencheur** : `jobs/processors/maintenance.processor.ts`, `recalculateClientScores`
  (cron quotidien 02h00, existant — recalculait déjà chaque score sans jamais le comparer à
  l'ancien).
- **Payload** : `{ agencyEmail: string; clients: Array<{ clientId: string; clientName?:
  string; previousScore: number; newScore: number; adminUrl: string }> }`
- **Comportement attendu** : alerte quand un client vient de franchir le seuil à risque —
  déclenche un point de suivi commercial/relation client.
- **Note de conception** : aucun seuil « à risque » n'existait pour `ClientSuccess.score`
  (échelle 0-100) — à ne pas confondre avec le score `red`/`orange`/`green` de
  `healthBoard.repository.ts`, qui est un concept différent au niveau projet, pas client.
  Introduction de `CLIENT_SUCCESS_AT_RISK_THRESHOLD = 50` (constante documentée dans
  `maintenance.processor.ts`, milieu de l'échelle 0-100, à ajuster avec le recul). Le hook ne
  se déclenche que sur le **franchissement** (score qui passe de `> 50` à `<= 50` pendant cette
  exécution), jamais pour un client déjà sous le seuil lors des runs précédents — dédup
  naturelle par la condition de transition elle-même, sans mécanisme séparé.

---

## Nouvelles notifications in-app (partie 2)

Contrairement au premier lot, deux services n'avaient aucune notification préexistante ; une
notif in-app a donc été ajoutée en plus du hook n8n, suivant le pattern `enqueueNotifications`
déjà utilisé ailleurs (`userId`, `title`, `message`, `type: "GENERAL"`, `entityId`, `link`) :

| Service | Déclencheur | Destinataires |
|---|---|---|
| `rating.service.ts` | `addRating` (toute nouvelle note) | Tous les `ADMIN` |
| `comment.service.ts` | `createComment` | Assigné de la tâche + `ADMIN`/managers du pôle, moins l'auteur |

## Nouvelles constantes de seuil (partie 2)

Aucune nouvelle variable d'environnement n'a été ajoutée pour ce lot — les deux seuils
introduits sont des constantes documentées en code (suivant le même choix que
`CUSTOM_QUESTION_SLA_HOURS`/`APPROVAL_SLA_DAYS` l'étaient via env var, mais ici jugées plus
proches de règles métier internes que de config d'environnement) :

| Constante | Fichier | Valeur | Usage |
|---|---|---|---|
| `LOW_RATING_ALERT_THRESHOLD` | `services/rating.service.ts` | `2` | Seuil pour `freelancer.rating_alert` |
| `CLIENT_SUCCESS_AT_RISK_THRESHOLD` | `jobs/processors/maintenance.processor.ts` | `50` | Seuil de franchissement pour `clientSuccess.score_dropped` |

Si un besoin de configuration par environnement apparaît (ex. staging vs prod), ces deux
constantes peuvent être migrées vers `env.ts` sans changement d'API.

---

## Nouveaux événements (audit de cohérence Projets/Tâches)

Un audit du module Projets/Tâches a révélé une asymétrie : create/update avaient des hooks
n8n mais aucune des deux entités n'était notifiée à la suppression, et `createProject`
n'avait aucun hook contrairement à `submitBrief`/`clientApprove`. Trois événements comblent
cet écart.

### 23. `project.created`
- **Déclencheur** : `services/project.service.ts`, `createProject`.
- **Payload** : `{ projectId: string; name: string; clientId?: string; adminUrl: string;
  agencyEmail: string }`
- **Comportement attendu** : symétrique à `project.client_approved` — permet à un workflow de
  réagir à la naissance d'un projet (ex. créer un dossier partagé, notifier une équipe).

### 24. `project.deleted`
- **Déclencheur** : `services/project.service.ts`, `deleteProject` (suppression physique,
  seulement possible si le projet n'a ni facture émise ni onboarding — voir les gardes déjà
  en place dans cette fonction).
- **Payload** : `{ projectId: string; name: string; clientId?: string; agencyEmail: string }`
- **Comportement attendu** : permet à un workflow externe (ex. synchronisation Slack/Trello)
  de retirer l'état correspondant plutôt que de garder un fantôme indéfiniment.

### 25. `task.deleted`
- **Déclencheur** : `services/task.service.ts`, `deleteTask`.
- **Payload** : `{ taskId: string; title: string; projectId: string; adminUrl: string }`
- **Comportement attendu** : même besoin que `project.deleted`, à l'échelle de la tâche.

## Correctifs de cohérence (pas de nouvel événement, comportement existant corrigé)

- **`task.overdue`** (événement 17) — le payload de chaque tâche inclut désormais `dueDate`,
  qui manquait alors que l'événement analogue `task.deadline_soon` l'envoie déjà. Un
  consommateur n8n traitant les deux événements de façon uniforme n'a plus besoin de gérer
  un champ absent sur l'un des deux.
- **`project.deadline_soon`** (événement 15) — recalcule désormais `isOverdue` et la fenêtre
  de sélection via `healthBoardRepository.getActiveProjectsHealth()` (même source que l'écran
  Health Board et `healthBoard.weekly_digest`) au lieu d'une requête et d'un seuil
  indépendants. Élimine un cas réel où un projet pouvait déclencher l'alerte cron
  "⏰ Délai imminent" sans jamais apparaître à risque dans le Health Board affiché en direct.
- **`checkStaleProjects`** (événement `project.stale`, pré-existant) — corrige un bug où
  `tasks: { every: { updatedAt: { lt: cutoff } } }` est vrai par vacuité pour un projet sans
  aucune tâche, signalant à tort tout projet IN_PROGRESS fraîchement créé comme inactif dès le
  lendemain. La requête exige désormais `tasks: { some: {} }` en plus, alignée sur
  `healthBoardRepository.isStale` qui exclut déjà ce cas (`daysSinceLastActivity !== null`).

## Garde métier ajoutée (hors n8n)

`taskService.createTask`/`updateTask` et `projectTemplateService.applyToProject` refusent
désormais toute création/modification de tâche sur un projet `COMPLETED` ou archivé
(`HttpError 409`, codes `PROJECT_COMPLETED`/`PROJECT_ARCHIVED`). Auparavant rien n'empêchait
d'ajouter des tâches sur un projet déjà clôturé via `clientApprove`.
