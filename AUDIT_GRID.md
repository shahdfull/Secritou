# AUDIT_GRID.md — Grille CRUD exhaustive des 24 entités (REFERENTIEL.md §3)

Document de référence, pas un audit. Construit par inspection directe du code
(grep + lecture, jamais devinée) pour les futures passes d'audit module par
module. Voir CLAUDE.md pour la procédure d'audit et REFERENTIEL.md pour le
contexte métier complet.

**Méthode** : pour chaque entité, localisation des fichiers réels par
`Grep`/`Glob` sur `server/src/{repositories,services,controllers,routes}/`,
puis lecture directe des méthodes trouvées. `verifie:` suit le vocabulaire de
REFERENTIEL.md §3 : `code_direct` (méthode lue ligne à ligne), `code_grep`
(chaîne trouvée, logique non lue), `schema_seul` (schema.prisma uniquement).
Toute case incertaine est marquée `[À VÉRIFIER — non lu en détail]` plutôt que
devinée.

**Génération** : ce document a été produit par 5 passes de lecture directe en
parallèle (3.1–3.5, 3.6–3.9, 3.10–3.14, 3.15–3.18, 3.19–3.24), chacune
listant ses fichiers réellement ouverts. Une 6e passe de compilation finale a
été interrompue par une limite de session avant d'écrire ce fichier — la
compilation ci-dessous reprend fidèlement le contenu déjà produit par les 5
passes de recherche, sans reformulation qui en altérerait le sens.

---

## 3.1 Company

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create | — | Non (API) | — (aucun module dédié) | aucune | code_grep — aucun `prisma.company.create` dans `server/src/`. Seul `server/prisma/seed.ts:38` (`prisma.company.upsert`), script dev hors chemin API |
| Read | `server/src/services/documentGenerator.service.ts:458` (`prisma.company.findUnique`) | Oui | non applicable | aucune | code_direct — unique lecture réelle, utilisée pour générer les PDF (nom/logo/matricule fiscal). Aucun endpoint GET dédié |
| Update | — | Non (API) | — | aucune | code_grep — aucun `prisma.company.update` hors seed |
| Delete | — | Non | — | aucune | code_grep — cohérent avec `singleton: true` |
| Confirmation/statut | — | Non | — | — | Aucun controller/service/routes dédié à Company (`company.controller.ts` etc. n'existent pas) |

## 3.2 User

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (admin invite) | `server/src/services/user.service.ts:137-151` (`inviteUser`) → `user.repository.ts:90-102` | Oui | Oui (4.14) | aucune | code_direct |
| Create (register public) | `server/src/services/auth.service.ts:79-92` → `auth.repository.ts:24-34` | Oui | Oui (4.14) | aucune | code_direct — rôle forcé `CLIENT` en dur ligne 89 |
| Create (invitation client) | `server/src/services/client.service.ts:80-96` (`inviteClientUser`) | Oui | Oui (4.14, cf. auth.repository.ts) | aucune | code_direct |
| Create (acceptation candidature freelance) | `server/src/services/freelancerApplication.service.ts:119-140` (`acceptApplication`, ligne 124) | Oui | **Non** — voir écarts | aucune | code_direct |
| Read (self) | `user.service.ts:67-71` (`getMe`) | Oui | Oui (4.14) | aucune | code_direct |
| Read (liste) | `user.service.ts:117-131` (`getUsersByCompany`) | Oui | Oui (4.14) | aucune | code_direct |
| Update (self nom/téléphone) | `user.service.ts:73-82` (`updateMe`) | Oui | Oui (4.14) | SEC-006 | code_direct |
| Update (email différé) | `user.service.ts:84-115` (`requestEmailChange`/`confirmEmailChange`) | Oui | Oui (4.14) | aucune | code_direct |
| Update (admin nom/rôle) | `user.service.ts:153-172` (`updateUser`) | Oui | Oui (4.14) | RG-019, RG-021 | code_direct |
| Update (mot de passe) | `auth.service.ts:182-217` | Oui | Oui (4.14) | aucune | code_direct |
| Delete | `user.service.ts:174-199` (`deleteUser`) → `user.repository.ts:155-162` (`prisma.user.delete`, hard) | Oui | Oui (4.14) | RG-021 | code_direct |
| Confirmation/statut : heartbeat | `user.service.ts:133-135` (`recordHeartbeat`) | Oui | Oui (4.14) | RG-020 | code_direct — alimente `UserSession`, pas un champ User direct |

## 3.3 Service (Pôle)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create | — | Non (API) | — (aucun module dédié) | aucune | code_grep — seul `server/prisma/seed.ts:56` (`prisma.service.upsert`), script dev |
| Read (liste) | `server/src/services/service.service.ts:17-19` → `service.controller.ts:4-11` | Oui | non applicable | aucune | code_direct — `GET /services`, ADMIN only |
| Read (résolution par type) | `service.service.ts:10-15` (`resolveServiceIdForType`) | Oui | non applicable | aucune | code_direct — utilisé par `contact.service.ts` |
| Update | — | Non (API) | — | aucune | code_grep |
| Delete | — | Non | — | aucune | code_grep |
| Confirmation/statut | — | Non | — | — | Aucun CRUD complet exposé — lecture seule uniquement |

## 3.4 Lead

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create | `server/src/services/lead.service.ts:62-88` (`createLead`) → `lead.repository.ts:84-93` | Oui | Oui (4.1) | aucune | code_direct |
| Create (formulaire contact, find-or-create) | `server/src/services/contact.service.ts:14-39` (`sendContactMessage`) | Oui | **Non** — voir écarts | aucune | code_direct |
| Create (conversion contact→lead manuelle) | `contact.service.ts:85-109` (`convertToLead`) | Oui | **Non** — voir écarts | aucune | code_direct |
| Read (liste/détail) | `lead.service.ts:52-60` → `lead.repository.ts:30-82` | Oui | Oui (4.1) | aucune | code_direct — scoping MANAGER par `serviceId`/`assignedManagerId` |
| Update (générique + transition statut) | `lead.service.ts:90-127` (`updateLead`) | Oui | Oui (4.1) | aucune | code_direct — machine à états `LEAD_NEXT_STATUSES` |
| Delete (réel) | `lead.service.ts:129-140` (`deleteLead`) → `lead.repository.ts:106-108` (`prisma.lead.delete`) | Oui | Oui (4.1) | aucune | code_direct — bloqué si `convertedClientId` existe |
| Delete (archivage auto, hors API) | `server/src/jobs/processors/maintenance.processor.ts:135-169` (`archiveTableRows`/`archiveColdData`) | Oui | **Non** — voir écarts | aucune | code_direct — **suspect, voir Constat hors mandat ci-dessous** |
| Confirmation/statut : archive/reopen | `lead.service.ts:99-104` (`archive`, appel non confirmé), `142-153` (`reopenLead`) | Oui | Oui (4.1) | aucune | code_direct |
| Confirmation/statut : convertLeadToClient | `lead.service.ts:155-217` | Oui | Oui (4.1) | aucune | code_direct — crée le Client associé en transaction |

**Constat hors mandat (non résolu, signalé pour ANOMALIES.yaml)** : `maintenance.processor.ts` référence des tables `LeadArchive`, `ContactRequestArchive`, `NotificationArchive`, `DocumentArchive` qui **n'existent dans aucun modèle de `schema.prisma`** ni dans aucune migration (grep vide). Le job `archiveColdData` est pourtant planifié (cron quotidien `30 3 * * *`, `jobs/index.ts:234-238`). Si exécuté, l'étape `CREATE TABLE ... PARTITION OF "LeadArchive"` échouerait — soit le job échoue silencieusement à chaque exécution, soit il n'a jamais tourné. **Ceci relève de la règle CLAUDE.md « enregistrement immédiat de tout écart constaté » — à créer en ANOMALIES.yaml dans une prochaine session, pas fait ici (ce tour ne modifie pas ANOMALIES.yaml par contrainte explicite de la tâche).**

## 3.5 Client

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (direct) | `server/src/services/client.service.ts:34-38` → `client.repository.ts:83-89` | Oui | Oui (4.1, via schema) | aucune | code_direct — `POST /clients`, ADMIN only |
| Create (conversion lead) | `lead.service.ts:168-192` (`convertLeadToClient`, `tx.client.create`) | Oui | Oui (4.1) | aucune | code_direct |
| Read (liste/détail) | `client.service.ts:17-32` → `client.repository.ts:54-81` | Oui | Oui (4.1) | aucune | code_direct — scoping MANAGER par pôle |
| Read (corbeille) | `client.service.ts:22-25` → `client.repository.ts:115-129` | Oui | Oui (4.1) | aucune | code_direct |
| Update | `client.service.ts:40-46` (`updateClient`) | Oui | Oui (4.1) | aucune | code_direct — `ADMIN only` |
| Delete (soft, `deletedAt`) | `client.service.ts:48-62` → `client.repository.ts:107-109` | Oui | Oui (4.1) | aucune | code_direct — **pas une suppression réelle**, bloqué si factures existantes |
| Delete (réel) | — | Non trouvé | — | — | code_grep — aucun `prisma.client.delete` hard |
| Confirmation/statut : restore | `client.service.ts:64-70` | Oui | Oui (4.1) | aucune | code_direct |
| Confirmation/statut : archive | `client.service.ts:72-78` | Oui | Oui (4.1) | aucune | code_direct — distinct du delete, `archivedAt` |
| Confirmation/statut : activation portail | `server/src/services/invoice.service.ts:246-254` (dans `addPayment`) | Oui | Oui (4.4/4.6) | RG-018 | code_direct — **confirme RG-018 : activation à `DEPOSIT` PAID, pas à l'acceptation proposition** (cf. SEC-002) |

---

## 3.6 Proposal (Proposition/Devis)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Read (liste/filtres) | `server/src/repositories/proposal.repository.ts:7-44` | Oui | Oui (4.1) | aucune | code_direct |
| Read (par client) | `proposal.repository.ts:46-68` | Oui | Oui (4.1) | aucune | code_direct |
| Read (par id, client) | `proposal.repository.ts:70-78` | Oui | Oui (4.1) | aucune | code_direct |
| Read (par id, admin, avec sections/history/invoice) | `proposal.repository.ts:80-91` | Oui | Oui (4.1) | aucune | code_direct |
| Create (repo) | `proposal.repository.ts:93-109` | Oui | Oui (4.1) | aucune | code_direct |
| Create (service, tx avec vérif ServiceRequest/Lead) | `server/src/services/proposal.service.ts:174-207` | Oui | Oui (4.1) | aucune | code_direct — bloque si `serviceRequestId` déjà lié, lead `WON`/mismatch |
| Update (repo) | `proposal.repository.ts:111-113` | Oui | Oui (4.1) | aucune | code_direct |
| Update (service — révoque à DRAFT si contenu modifié en SENT/VIEWED) | `proposal.service.ts:209-235` | Oui | Oui (4.1) | aucune | code_direct |
| Delete (repo) | `proposal.repository.ts:127-129` | Oui | Oui (4.1) | aucune | code_direct |
| Delete (service — bloque si linkedProject/invoice existants) | `proposal.service.ts:237-247` | Oui | Oui (4.1) | aucune | code_direct |
| Confirmation/statut : send (→SENT) | `proposal.service.ts:249-304` | Oui | Oui (4.1) | aucune | code_direct — génère PDF, notifie client |
| Confirmation/statut : acceptWithCascade (→ACCEPTED) | `proposal.service.ts:306-480` | Oui | Oui (4.1) | RG-010, RG-004a | code_direct — dépôt 30% ligne 377, invoice via `createDepositInvoiceTx` ligne 379 |
| Confirmation/statut : reject (→REJECTED) | `proposal.service.ts:482-538` | Oui | Oui (4.1) | aucune | code_direct — cascade ServiceRequest → CANCELLED |
| Confirmation/statut : markViewed (SENT→VIEWED) | `proposal.service.ts:138-161` | Oui | Oui (4.1) | aucune | code_direct — pas de route explicite trouvée dans proposal.routes.ts, `[À VÉRIFIER — déclencheur exact non confirmé]` |
| Confirmation/statut : expireProposals (job cron, SENT/VIEWED→EXPIRED) | `server/src/jobs/processors/maintenance.processor.ts:183-239` | Oui | **Non** — voir écarts (déjà signalé côté 4.13/jobs) | aucune | code_direct |
| addSection/updateSection/deleteSection | `proposal.repository.ts:131-142`, `proposal.service.ts:540-560` | Oui | Oui (4.1) | aucune | code_direct — révoque à DRAFT si live |
| addHistory | `proposal.repository.ts:144-146`, `proposal.service.ts:562-564` | Oui | Oui (4.1) | aucune | code_direct |

## 3.7 Project (Mission)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Read (findAll/findDeleted, scoping rôle) | `server/src/repositories/project.repository.ts:55-78, 156-189` | Oui | Oui (4.2) | aucune | code_direct |
| Read (findById/findByIdAdmin) | `project.repository.ts:80-113` | Oui | Oui (4.2) | aucune | code_direct |
| Create (repo) | `project.repository.ts:115-126` | Oui | Oui (4.2) | aucune | code_direct |
| Create (service, exige proposition ACCEPTED) | `server/src/services/project.service.ts:52-79` | Oui | Oui (4.2) | aucune | code_direct |
| Update (repo) | `project.repository.ts:128-134` | Oui | Oui (4.2) | aucune | code_direct |
| Update (service, bloque COMPLETED, valide transitions) | `project.service.ts:81-141` | Oui | Oui (4.2) | RG-013 | code_direct — confirmé lignes 99-101 |
| Delete (soft, repo) | `project.repository.ts:136-138` | Oui | Oui (4.2) | aucune | code_direct |
| Delete (service, bloque si factures non-DRAFT/onboarding) | `project.service.ts:143-173` | Oui | Oui (4.2) | aucune | code_direct |
| Confirmation/statut : archive/restore | `project.repository.ts:140-154`, `project.service.ts:175-195` | Oui | Oui (4.2) | aucune | code_direct |
| Confirmation/statut : getBrief/submitBrief | `project.service.ts:197-269` | Oui | Oui (4.2) | aucune | code_direct |
| Confirmation/statut : clientApprove (→COMPLETED, facture solde 70%) | `project.service.ts:271-457` | Oui | Oui (4.2, 4.6) | RG-013, RG-004b | code_direct — confirmé lignes 306-308, 346 |
| Confirmation/statut : getTimelineStatus | `project.service.ts:459-502` | Oui | Oui (4.2) | aucune | code_direct |

## 3.8 Task (+ Comment liée)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Read (findAll, scoping rôle) | `server/src/repositories/task.repository.ts:44-62` | Oui | Oui (4.2) | aucune | code_direct |
| Read (findById/findByIdAdmin/existsInCompany) | `task.repository.ts:64-96` | Oui | Oui (4.2) | aucune | code_direct |
| Create (repo) | `task.repository.ts:98-100` | Oui | Oui (4.2) | aucune | code_direct |
| Create (service, vérifie scope/projet ouvert/assignee/conflits) | `server/src/services/task.service.ts:120-161` | Oui | Oui (4.2) | aucune | code_direct |
| Update (repo) | `task.repository.ts:102-108` | Oui | Oui (4.2) | aucune | code_direct |
| Update (service, restreint FREELANCER, valide transitions) | `task.service.ts:163-264` | Oui | Oui (4.2) | aucune | code_direct — `ALLOWED_TASK_TRANSITIONS` |
| Delete (repo, hard) | `task.repository.ts:110-115` | Oui | Oui (4.2) | aucune | code_direct |
| Delete (service, restreint FREELANCER à ses propres tâches) | `task.service.ts:266-303` | Oui | Oui (4.2) | aucune | code_direct — audit log |
| Confirmation/statut : getFreelancerAvailability | `task.service.ts:78-103, 110-112` | Oui | Oui (4.2) | aucune | code_direct |
| Comment — Create | `server/src/repositories/comment.repository.ts:18-27`, `comment.service.ts:12-60` | Oui | **Non** — voir écarts | aucune | code_direct |
| Comment — Read (par tâche) | `comment.repository.ts:29-35`, `comment.service.ts:62-64` | Oui | **Non** — voir écarts | aucune | code_direct |
| Comment — Update/Delete | — | **Non — aucune méthode trouvée** | — | — | code_direct (absence confirmée par lecture complète repo+service+controller) |

## 3.9 ClientOnboarding + sous-étapes (Contract, Payment, Questionnaire, Specifications, KickoffMeeting, ProductionProgress, Delivery)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Read (findAll, scoping client/manager) | `server/src/repositories/clientOnboarding.repository.ts:63-93` | Oui | Oui (4.3) | aucune | code_direct |
| Read (findById/findByProjectId) | `clientOnboarding.repository.ts:95-115` | Oui | Oui (4.3) | aucune | code_direct |
| Create (repo) | `clientOnboarding.repository.ts:117-132` | Oui | Oui (4.3) | aucune | code_direct |
| Create (service, 8 steps par défaut) | `server/src/services/clientOnboarding.service.ts:34-54` | Oui | Oui (4.3) | aucune | code_direct |
| Update (repo, `assignedUserId` seul champ) | `clientOnboarding.repository.ts:134-141` | Oui | Oui (4.3) | aucune | code_direct |
| Delete (repo, hard) | `clientOnboarding.repository.ts:143-149` | Oui | Oui (4.3) | aucune | code_direct |
| Confirmation/statut : addStep/updateStep (repo) | `clientOnboarding.repository.ts:151-173` | Oui | Oui (4.3) | aucune | code_direct |
| Confirmation/statut : updateStep (service, notifie admins) | `clientOnboarding.service.ts:68-106` | Oui | Oui (4.3) | aucune | code_direct |

**Sous-étapes — Create + Update uniquement, aucun Delete pour chacune (code_direct, confirmé) :**

| Sous-modèle | Create | Update | Delete |
|---|---|---|---|
| Contract | `clientOnboarding.repository.ts:175-185` | `clientOnboarding.repository.ts:187-197` | Non — aucune méthode |
| Payment (onboarding, distinct de 3.11) | `clientOnboarding.repository.ts:199-209` | `clientOnboarding.repository.ts:211-221` | Non — aucune méthode |
| Questionnaire | `clientOnboarding.repository.ts:223-245` | `clientOnboarding.repository.ts:247-266` | Non — aucune méthode |
| Specifications | `clientOnboarding.repository.ts:268-278` | `clientOnboarding.repository.ts:280-290` | Non — aucune méthode |
| KickoffMeeting | `clientOnboarding.repository.ts:292-302` | `clientOnboarding.repository.ts:304-314` | Non — aucune méthode |
| ProductionProgress | `clientOnboarding.repository.ts:316-326` | `clientOnboarding.repository.ts:328-338` | Non — aucune méthode |
| Delivery | `clientOnboarding.repository.ts:340-350` | `clientOnboarding.repository.ts:352-362` | Non — aucune méthode |

**Constat important** : `createContract`/`updateContract`/`createPayment`/`updatePayment` etc. sont des passthroughs génériques du service vers le repository (`clientOnboarding.service.ts:108-121`), **sans logique de validation de statut ni déclenchement d'activation de portail**. Le modèle `Payment` de l'onboarding (`OnboardingStep.payment`) est un enregistrement manuel séparé, **sans lien constaté vers l'activation du portail** — celle-ci passe exclusivement par `Invoice.addPayment` (voir 3.5, RG-018). Point de vigilance factuelle pour REFERENTIEL.md, non tranché ici.

---

## 3.10 Invoice (+ InvoiceItem, InvoiceCounter, InvoiceReminder)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (numéro auto) | `server/src/services/invoice.service.ts:64-90` | Oui | Oui (4.4) | RG-012 | code_direct — `InvoiceCounter.upsert` dans la même tx (76-88), gapless confirmé chemin nominal |
| Create (numéro manuel) | `invoice.service.ts:121-131` (`create`) | Oui | Oui (4.4) | RG-012 | code_direct — **bypass complet du compteur si `data.number` fourni, brèche potentielle au gapless, hors périmètre de vérification complète ici** |
| Create (depuis Proposal) | `invoice.service.ts:440-463` (`createFromProposal`) | Oui | Oui (4.4) | aucune | code_direct |
| Create (dépôt/solde tx) | `invoice.service.ts:467-491` | Oui | Oui (4.4) | RG-004a, RG-004b | code_direct |
| Read (liste/par client/par service/corbeille) | `server/src/repositories/invoice.repository.ts:44-197` | Oui | Oui (4.4) | aucune | code_direct — filtre OVERDUE effectif même si statut DB pas encore flippé |
| Read (par id) | `invoice.repository.ts:141-151` | Oui | Oui (4.4) | aucune | code_direct |
| Update (champs) | `invoice.service.ts:133-147` | Oui | Oui (4.4) | aucune | code_direct — bloqué si non-DRAFT ou PDF généré |
| Update (reminderPaused) | `invoice.service.ts:149-155` | Oui | Oui (4.4) | aucune | code_direct |
| Confirmation/statut : send (→SENT) | `invoice.service.ts:182-209` | Oui | Oui (4.4) | aucune | code_direct |
| Confirmation/statut : addPayment (→PARTIAL/PAID) | `invoice.service.ts:211-321` | Oui | Oui (4.4, 4.5) | RG-008, RG-018 | code_direct — idempotencyKey + fallback 10s, cap au montant, overpay→CreditNote, activation portail, commission déclenchée |
| Confirmation/statut : cancel (→CANCELLED) | `invoice.service.ts:159-166` | Oui | Oui (4.4) | aucune | code_direct — refuse si PAID/CANCELLED |
| Delete (soft) | `invoice.service.ts:168-174` + `invoice.repository.ts:161-163` | Oui | Oui (4.4) | aucune | code_direct — numérotation gapless préservée |
| Confirmation/statut : restore | `invoice.service.ts:176-180` + `invoice.repository.ts:165-167` | Oui | Oui (4.4) | aucune | code_direct |
| addItem/updateItem/deleteItem | `invoice.service.ts:343-384` | Oui | Oui (4.4) | aucune | code_direct — tous bloqués hors DRAFT/PDF non généré |
| addItemsFromTimeEntries | `invoice.service.ts:386-438` | Oui | Oui (4.4) | aucune | code_direct |
| addReminder → InvoiceReminder.create | `invoice.service.ts:323-341` + `invoice.repository.ts:230-233` | Oui | Oui (4.4) | aucune | code_direct |
| Confirmation/statut : markOverdueInvoices (SENT/PARTIAL→OVERDUE) | `server/src/jobs/processors/maintenance.processor.ts:246-315` | Oui | **Non** — voir écarts | aucune | code_direct — filtre `dueDate < now`, correct |
| Confirmation/statut : checkInvoiceFollowup (relances tiered) | `server/src/jobs/processors/ceoAlerts.processor.ts:160-244` | Oui | **Non** — voir écarts | aucune | code_direct — **SEC-014 confirmé** (paliers sur `createdAt` pas `dueDate`, ligne 191) ; **SEC-015 confirmé** (filtre `status IN ["SENT","PARTIAL"]`, jamais OVERDUE, lignes 164-169) |
| VAT (RG-003) | `server/src/utils/vat.ts:1-28` | Oui | Oui (4.4) | RG-003 | code_direct — `TVA_RATE=0.19` fixe |

**Observation incidente** : `invoice.repository.ts:addPayment` (lignes 212-228) semble être du **code mort** — `invoiceService.addPayment` fait `tx.payment.create` directement (ligne 232) sans jamais appeler cette méthode repository. À vérifier séparément.

## 3.11 Payment

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (via addPayment) | `invoice.service.ts:232` (`tx.payment.create`) | Oui | Oui (4.4) | RG-008 | code_direct |
| Read (idempotency lookup) | `invoice.service.ts:221` | Oui | Oui (4.4) | aucune | code_direct |
| Read (fallback dedup 10s) | `invoice.service.ts:228` | Oui | Oui (4.4) | aucune | code_direct |
| Read (liste par invoice, incluse) | `invoice.repository.ts:95` | Oui | Oui (4.4) | aucune | code_direct |
| Update/Delete | — | **Non trouvé** | — | — | code_direct (absence confirmée) — paiement immuable une fois enregistré |
| Create/Update (onboarding, entité distincte — voir 3.9) | `server/src/repositories/clientOnboarding.repository.ts:199-221` | Oui | Oui (4.3) | aucune | code_direct — `onboardingStepId` FK, pas `invoiceId`, ne touche ni Commission ni InvoiceCounter |

## 3.12 CreditNote

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (tx réutilisable) | `server/src/services/creditNote.service.ts:23-31` (`createCreditNoteTx`) | Oui | Oui (4.4) | aucune | code_direct — incrémente `Client.creditBalance` |
| Create (endpoint explicite) | `creditNote.service.ts:36-66` | Oui | Oui (4.4) | aucune | code_direct — refuse `amount<=0` ou `>amountPaid`, notifie admins+n8n |
| Read (par invoice/client/tout) | `creditNote.service.ts:68-92` | Oui | Oui (4.4) | aucune | code_direct |
| Confirmation/statut : applyCredit | `creditNote.service.ts:103-180` | Oui | Oui (4.4) | aucune | code_direct — update conditionnel anti-double-application, `applicable = min(cn.amount, remaining, clientBalance)` |
| Update/Delete direct | — | **Non trouvé** | — | — | code_direct (absence confirmée) — avoir immuable hors application |

**Constat structure** : pas de `creditNote.controller.ts`/`.routes.ts`/`.repository.ts` dédiés — les endpoints sont dans `invoice.controller.ts:117-141`/`invoice.routes.ts:57,128-150`, déjà dans le perimetre_code 4.4. Le service appelle `prisma`/`tx` directement (pattern différent des autres modules). **Pas un écart de périmètre** — le périmètre actuel couvre déjà 100% du code CreditNote réel.

## 3.13 ProjectCommissionSplit

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Read (par projet, tous partners) | `server/src/repositories/commission.repository.ts:10-16` | Oui | Oui (4.5) | aucune | code_direct |
| Read (par projet, tx) | `commission.repository.ts:18-20` | Oui | Oui (4.5) | aucune | code_direct |
| Read (un seul partner) | `commission.repository.ts:24-26` | Oui | Oui (4.5) | RG-011 | code_direct |
| Create/Update/Delete (remplacement complet) | `server/src/services/commission.service.ts:26-43` + `commission.repository.ts:28-37` (`setSplits`, tx `deleteMany`+`createMany`) | Oui | Oui (4.5) | RG-006 | code_direct — validation complète confirmée : `ratePct<=0` rejeté, somme>100 rejetée, doublon partnerId rejeté, unicité DB `@@unique([projectId,partnerId])` |

## 3.14 Commission

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (computeForPaymentTx) | `commission.service.ts:50-74` + `commission.repository.ts:41-55` | Oui | Oui (4.5) | RG-007, RG-008 | code_direct — `basis=amountReceived`, `amount=roundMoney(basis*ratePct/100)` ; appelée uniquement depuis `invoice.service.ts:263` |
| Read (liste, filtres) | `commission.repository.ts:57-81` | Oui | Oui (4.5) | aucune | code_direct |
| Read (résumé dû par partner) | `commission.repository.ts:83-89` + `commission.service.ts:82-106` | Oui | Oui (4.5) | RG-011 | code_direct |
| Read (par id) | `commission.repository.ts:91-96` | Oui | Oui (4.5) | aucune | code_direct |
| Confirmation/statut : markPaid (→PAID) | `commission.service.ts:108-136` + `commission.repository.ts:98-104` | Oui | Oui (4.5) | RG-009 | code_direct — refuse si déjà PAID (409), non rejouable confirmé |
| Update (autre que markPaid) | — | **Non trouvé** | — | — | code_direct (absence confirmée) |
| Delete | — | **Non trouvé** | — | — | code_direct (absence confirmée) |

---

## 3.15 FreelancerProfile / Skill / PortfolioItem / Rating / FreelancerApplication

### FreelancerProfile / Skill

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (self) | `server/src/repositories/freelancer.repository.ts:73-97` → `freelancer.service.ts:28-41` | Oui | Oui (4.7) | aucune | code_direct — réservé FREELANCER, refuse si profil déjà existant |
| Create (via acceptation candidature) | `server/src/services/freelancerApplication.service.ts:126-128` | Oui | Oui (4.7) | aucune | code_direct — sans bio/skills |
| Read (liste, avec redaction) | `freelancer.repository.ts:32-54`, `freelancer.controller.ts:21-33` | Oui | Oui (4.7) | aucune | code_direct |
| Read (par id) | `freelancer.repository.ts:56-59` | Oui | Oui (4.7) | aucune | code_direct |
| Read (par userId/`/me`) | `freelancer.repository.ts:61-71` | Oui | Oui (4.7) | aucune | code_direct |
| Update (self) | `freelancer.repository.ts:99-134`, `freelancer.service.ts:43-56` | Oui | Oui (4.7) | aucune | code_direct — vérifie ownership |
| Delete (self) | `freelancer.repository.ts:136-144`, `freelancer.service.ts:58-67` | Oui | Oui (4.7) | aucune | code_direct — **aucune route admin pour créer/modifier/supprimer le profil d'un autre freelancer** |
| Skill (liste) | `freelancer.controller.ts:44-52` | Oui | Oui (4.7) | aucune | code_direct — pas de repository dédié, Prisma direct dans le contrôleur |

### PortfolioItem

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create | `server/src/routes/portfolio.routes.ts:44-58` | Oui | Oui (4.7) | aucune | code_direct — **`prisma.portfolioItem.create` écrit directement dans le fichier de routes, aucun controller/service/repository dédié** |
| Read (liste) | `portfolio.routes.ts:34-42` | Oui | Oui (4.7) | aucune | code_direct |
| Update | `portfolio.routes.ts:60-79` | Oui | Oui (4.7) | aucune | code_direct — vérifie ownership |
| Delete | `portfolio.routes.ts:81-91` | Oui | Oui (4.7) | aucune | code_direct — vérifie ownership |

**Anomalie architecture signalée (pas corrigée ici)** : viole la convention `routes → controllers → services → repositories → Prisma` documentée dans CLAUDE.md. Pas de `portfolio.controller.ts` ni `portfolio.service.ts` (absence confirmée par Glob).

### Rating

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create | `server/src/services/rating.service.ts:15-49` (`addRating`) | Oui | Oui (4.7) | aucune | code_direct — score 1-5, met à jour la moyenne, alerte n8n si score≤2 |
| Read | `rating.service.ts:51-57`, `rating.controller.ts:8-25` | Oui | Oui (4.7) | aucune | code_direct — **incohérence signalée : contrôle sur `req.user!.id` alors que le reste du code utilise `req.user!.sub`** |
| Update/Delete | — | **Non trouvé** | — | — | code_direct (absence confirmée) |

**Anomalie architecture signalée** : pas de `rating.repository.ts` — `rating.service.ts` appelle `prisma.rating.*` directement (absence confirmée par Glob).

### FreelancerApplication

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create | `server/src/repositories/freelancerApplication.repository.ts:42-44`, `freelancerApplication.service.ts:54-96` | Oui | Oui (4.7) | aucune | code_direct — publique, upload CV, honeypot anti-bot, résumé IA via n8n |
| Read (liste/par id/pending) | `freelancerApplication.repository.ts:25-40,54-56` | Oui | Oui (4.7) | aucune | code_direct |
| Confirmation/statut : reject | `freelancerApplication.repository.ts:46-48`, `service.ts:109-117` | Oui | Oui (4.7) | aucune | code_direct — motif ≥10 caractères exigé |
| Confirmation/statut : accept (→User+FreelancerProfile) | `service.ts:119-147` | Oui | Oui (4.7) | aucune | code_direct |
| Confirmation/statut : setAiSummary (webhook n8n) | `service.ts:105-107` | Oui | Oui (4.7) | aucune | code_direct — HMAC `verifyN8nWebhook`, pas d'auth utilisateur |
| Confirmation/statut : requestInterview | `service.ts:36-52` | Oui | Oui (4.7) | aucune | code_direct — n'écrit rien sur l'entité, exige PENDING |
| Delete | `freelancerApplication.repository.ts:50-52` | Existe (repo) | Oui (4.7) | aucune | code_grep pour l'usage — **méthode repository orpheline, aucun contrôleur/route ne l'appelle** |

## 3.16 ServiceRequest (+ Comment, History)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (client) | `server/src/repositories/serviceRequest.repository.ts:142-149`, `serviceRequest.service.ts:44-65` | Oui | **Non** — voir écarts | aucune | code_direct |
| Read (client, liste) | repo `64-88`, service `29-31` | Oui | **Non** — voir écarts | aucune | code_direct |
| Read (admin, liste filtrée, scope MANAGER par pôle) | repo `90-120`, service `33-35` | Oui | **Non** — voir écarts | aucune | code_direct |
| Read (admin, par id) | repo `122-128`, service `37-42` | Oui | **Non** — voir écarts | aucune | code_direct |
| Update (admin/manager, statut/priorité/assignation) | repo `151-155`, service `68-100` | Oui | **Non** — voir écarts | aucune | code_direct — machine à états `ALLOWED_TRANSITIONS`, `type` immuable, historise |
| Delete (admin) | repo `157-162`, service `102-111` | Oui | **Non** — voir écarts | aucune | code_direct — bloque si Proposal liée |
| Comment create/delete | repo `164-176,178-183`, service `113-126,128-130` | Oui | **Non** — voir écarts | aucune | code_direct |
| History (append-only) | repo `185-187` | Oui | **Non** — voir écarts | aucune | code_direct |

**Écart confirmé** : REFERENTIEL.md §4.6 ne liste que `server/src/services/serviceRequest.service.ts` — les 4 autres couches (`serviceRequest.repository.ts`, `.controller.ts`, `.routes.ts`, `.validator.ts`) sont réelles, actives, montées indépendamment à `/api/v1/service-requests` mais **absentes du perimetre_code**. La note existante dans REFERENTIEL.md §4.6 (« contrairement à serviceRequest.* qui a ses 5 couches ») est donc **factuellement inexacte** — les 5 couches existent mais ne sont pas déclarées.

## 3.17 Approval (+ ApprovalAttachment, ApprovalTimeline)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (admin/manager) | `server/src/repositories/approval.repository.ts:80-89`, `approval.service.ts:48-79` | Oui | Oui (4.6, déjà corrigé) | aucune | code_direct |
| Read (client) | repo `38-67`, service `30-36` | Oui | Oui (4.6) | aucune | code_direct |
| Read (admin) | repo `6-36,69-78`, service `38-46` | Oui | Oui (4.6) | aucune | code_direct — `assertApprovalInScope` restreint MANAGER par pôle |
| Update | repo `91-93`, service `81-89` | Oui | Oui (4.6) | aucune | code_direct — refuse si statut≠PENDING |
| Delete | repo `95-97`, service `91-99` | Oui | Oui (4.6) | aucune | code_direct — refuse si statut≠PENDING |
| Confirmation/statut : approve | service `101-141` | Oui | Oui (4.6) | aucune | code_direct |
| Confirmation/statut : reject | service `143-183` | Oui | Oui (4.6) | aucune | code_direct |
| Confirmation/statut : comment | service `185-191` | Oui | Oui (4.6) | aucune | code_direct |
| Confirmation/statut : respond (client, dispatch approve/reject/comment) | `approval.controller.ts:24-45`, route `/:id/respond` | Oui | Oui (4.6, déjà ajouté) | RG-013 (indirect) | code_direct |
| Attachment add/delete | repo `99-102,104-106`, service `193-197,199-206` | Oui | Oui (4.6) | aucune | code_direct |
| Timeline add | repo `108-110` | Oui | Oui (4.6) | aucune | code_direct — appelé en interne, pas de route directe (attendu) |

Aucun écart perimetre_code supplémentaire — module déjà corrigé en session antérieure.

## 3.18 Document (+ DocumentAccessLog)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create | `server/src/repositories/document.repository.ts:95-115`, `document.service.ts:24-26` | Oui | **Non — aucun module ne le revendique** | aucune | code_direct — ADMIN/MANAGER seulement |
| Read (liste, scopée par rôle) | repo `6-18,21-73`, service `16-18` | Oui | **Non** | aucune | code_direct — scope FREELANCER par tâches assignées, `redactStorageUrl` retire `url`/`fileUrl` |
| Read (par id) | repo `75-93`, service `20-22` | Oui | **Non** | aucune | code_direct — log accès `VIEW` |
| Update | repo `117-119`, service `28-30` | Oui | **Non** | aucune | code_direct — ADMIN/MANAGER |
| Delete | repo `121-123`, service `32-44` | Oui | **Non** | aucune | code_direct — nettoie S3/MinIO seulement si aucun autre document ne référence le même `fileKey` |
| Confirmation/statut : createVersion | service `46-70` | Oui | **Non** | aucune | code_direct — incrémente `version`, log `VERSION_CREATED` |
| Confirmation/statut : sign (client) | service `77-105` | Oui | **Non** | aucune | code_direct — restreint type `CONTRACT`, refuse re-signature (409), notifie n8n |
| Confirmation/statut : download (URL signée) | service `107-113` | Oui | **Non** | aucune | code_direct — URL S3 pré-signée à la demande |
| DocumentAccessLog | repo `134-137` (`addAccessLog`) | Oui | **Non** | aucune | code_direct — pas d'endpoint de lecture du journal lui-même |

**Écart majeur confirmé** : `document.service.ts`, `document.repository.ts`, `document.controller.ts`, `document.routes.ts` sont montés indépendamment dans `server/src/routes/index.ts` mais **ne figurent dans le perimetre_code d'AUCUN module 4.1–4.14** de REFERENTIEL.md — recherche exhaustive des en-têtes `### 4.x` sans résultat. §3.18 documente l'entité au niveau schéma seulement. **Décision à demander à l'utilisateur** : nouveau module dédié, ou rattachement à 4.6 (Portail client, le Client y signe/télécharge) ou 4.2 (Gestion de projet) ?

---

## 3.19 GscConnection (+ MetricSnapshot)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create/Update (upsert) | `server/src/repositories/gscConnection.repository.ts:12-28` | Oui | Oui (4.8) | aucune | code_direct — appelé depuis `completeConnect` |
| Update accessToken | `gscConnection.repository.ts:30-32` | Oui | Oui (4.8) | aucune | code_direct |
| Update sync success/error | `gscConnection.repository.ts:34-40` | Oui | Oui (4.8) | aucune | code_direct |
| Read (findByClientId, findAll) | `gscConnection.repository.ts:4-10` | Oui | Oui (4.8) | aucune | code_direct |
| Delete (disconnect) | `gscConnection.repository.ts:42-44` | Oui | Oui (4.8) | aucune | code_direct |
| Confirmation/statut : flux OAuth (start/list/complete) | `gscConnection.service.ts:54-108` | Oui | Oui (4.8) | aucune | code_direct — état signé HMAC, tokens Google en Redis TTL 10min avant persistance chiffrée |
| Confirmation/statut : getStatus/disconnect | `gscConnection.service.ts:110-125` | Oui | Oui (4.8) | aucune | code_direct |
| Create/Update MetricSnapshot (upsertMany) | `metricSnapshot.repository.ts:20-40` | Oui | Oui (4.8) | aucune | code_direct — idempotent, appelé par `searchConsole.service.ts:113` |
| Read MetricSnapshot | `metricSnapshot.repository.ts:42-54` | Oui | Oui (4.8) | aucune | code_direct — utilisé aussi par `clientPortal.controller.ts:37` (portail client) |
| Delete MetricSnapshot | — | **Non trouvé** | — | — | code_direct (absence confirmée) — pas de purge/rétention |
| Route metricSnapshot | `metricSnapshot.controller.ts:5-15`, montée dans `gscConnection.routes.ts:27` | Oui | Oui (4.8) | aucune | code_direct — **pas de fichier `metricSnapshot.routes.ts` séparé, montage croisé à documenter** |
| Confirmation/statut : googleOAuth (consent/exchange/refresh) | `googleOAuth.service.ts:1-67` | Oui | Oui (4.8) | aucune | code_direct — scope unique `webmasters.readonly` |
| Confirmation/statut : syncClient/syncAllConnectedClients (cron) | `searchConsole.service.ts:85-174` | Oui | Oui (4.8) | aucune | code_direct — via `maintenance.processor.ts:364-370`, lag J-3 |
| Confirmation/statut : detectClickAnomalies | `metricAnomaly.service.ts:20-58` | Oui | Oui (4.8) | aucune | code_direct — seuil `env.GSC_ANOMALY_THRESHOLD_PCT` vs moyenne mobile 7j |

**Écart critique — code potentiellement mort, candidat ANOMALIES.yaml** : `executiveMetrics.*` (service/repository/controller) et `revenueForecast.*` (service/repository/controller) existent, sont listés dans le perimetre_code 4.8, mais **grep exhaustif sur `server/src/routes/index.ts` = 0 résultat pour `executiveMetrics` et `revenueForecast`**. Ces fichiers ne sont accessibles par **aucune route HTTP**. Non lus en détail (`code_grep` seulement) — signalé, pas créé en ANOMALIES.yaml (hors contrainte de ce tour).

## 3.20 ClientSuccess (+ SuccessObjective, SuccessMetric, MetricHistory, SuccessRecommendation, SuccessTimeline)

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Read/Create-if-missing | `server/src/services/clientSuccess.service.ts:5-12` | Oui | Oui (4.9, GELÉ) | aucune | code_direct — score=0 si absent |
| Update (score) | `clientSuccess.service.ts:14-17` | Oui | Oui (4.9) | aucune | code_direct |
| Confirmation/statut : calculateScore | `clientSuccess.service.ts:37-92` | Oui | Oui (4.9) | aucune | code_direct — composite manuel+auto, plafonné à 100 |
| Confirmation/statut : recalcAndPersist/recalcForSuccess | `clientSuccess.service.ts:19-35` | Oui | Oui (4.9) | aucune | code_direct — non-fatal, erreurs avalées |
| Objective CRUD | service `94-107`, repo `30-51` | Oui | Oui (4.9) | aucune | code_direct — **delete ne recalcule pas le score** |
| Metric CRUD + History | service `109-125`, repo `53-83` | Oui | Oui (4.9) | aucune | code_direct — **delete ne recalcule pas le score** |
| Recommendation CRUD | service `127-140`, repo `85-106` | Oui | Oui (4.9) | aucune | code_direct — **delete ne recalcule pas le score** |
| Timeline Create/Delete (pas d'Update) | service `142-149`, repo `108-122` | Oui | Oui (4.9) | aucune | code_direct — append-only+delete, pas d'update |
| Confirmation/statut : job recalculateClientScores (cron) | `maintenance.processor.ts:317-362` | Oui | **Non** — voir écarts (jobs/**) | aucune | code_direct — seuil "at-risk"=50 codé en dur, notifie n8n seulement sur franchissement à la baisse |
| Trigger externe (après paiement) | `invoice.service.ts:301` | Oui | Oui (4.4) | aucune | code_direct — `void clientSuccessService.recalcAndPersist(...)` |

Aucun écart perimetre_code au-delà de `jobs/**` (déjà signalé transversalement) — module 4.9 correct.

## 3.21 PermissionProfile / ManagerPermission

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Confirmation/statut : resolvePermissions (cache+fusion) | `server/src/services/managerPermission.service.ts:50-71` | Oui | Oui (4.10) | aucune | code_direct — cache Redis clé `cache:manager:permissions:${userId}` **TTL 300s (5min) confirmé**, corrobore README |
| Confirmation/statut : deepMerge (fusion profil+overrides) | `managerPermission.service.ts:33-47` | Oui | Oui (4.10) | aucune | code_direct — `overrides` gagne sur `profile.permissions` |
| Confirmation/statut : invalidateCache | `managerPermission.service.ts:73-76` | Oui | Oui (4.10) | aucune | code_direct |
| ManagerPermission Read/Update (upsert, pas de Create séparé) | service `78-86`, repo `5-39` | Oui | Oui (4.10) | aucune | code_direct — `update()` fait un upsert |
| PermissionProfile CRUD complet | `managerPermission.service.ts:89-109` (objet `permissionProfileService`) | Oui | Oui (4.10, fichier partagé) | aucune | code_direct — **défini dans le même fichier que ManagerPermission, pas de `permissionProfile.service.ts` séparé — écart de structure, pas de fonctionnalité manquante** |
| PermissionProfile repository CRUD | `permissionProfile.repository.ts:1-45` | Oui | Oui (4.10) | aucune | code_direct |

## 3.22 AiConversation / AiMessage

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (conversation+1er message+appel LLM) | `server/src/services/aiConversation.service.ts:25-38`, repo `34-47` | Oui | **Non** — voir écarts | aucune | code_direct — tx (create AiMessage + touch updatedAt) |
| Read (liste paginée) | `aiConversation.repository.ts:6-25` | Oui | **Non** — voir écarts | aucune | code_direct |
| Read (détail avec messages) | repo `27-32`, service `19-23` | Oui | **Non** — voir écarts | aucune | code_direct — scope par `userId` |
| Update (ajout message+réponse LLM) | service `40-56` | Oui | **Non** — voir écarts | aucune | code_direct |
| Delete (1) / Delete all | repo `49-55` | Oui | **Non** — voir écarts | aucune | code_direct — **`deleteAll` existe côté repo mais aucune route ne l'expose** |
| Confirmation/statut : importFromLocalStorage | service `64-78` | Oui | **Non** — voir écarts | aucune | code_direct — migration ponctuelle localStorage→DB |
| Persistance depuis agentOrchestrator | `agentOrchestrator.service.ts:132-137` | Oui | Oui (4.11) | RG-014 | code_direct — **relance un appel Ollama supplémentaire en interne sur du contenu déjà généré, inefficacité constatée non corrigée (module GELÉ)** |

**Écart confirmé** : `aiConversation.controller.ts`, `aiConversation.repository.ts`, `aiConversation.routes.ts` forment la totalité de la couche CRUD réelle de AiConversation/AiMessage mais sont **absents du perimetre_code de 4.11**, qui ne liste que `aiConversation.service.ts`.

## 3.23 SiteContent

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Read (public, flat par locale) | `server/src/services/siteContent.service.ts:36-49`, repo `25-40` | Oui | Oui (4.12) | aucune | code_direct — fallback locale "fr" |
| Read (admin, groupé par section) | service `57-60`, repo `42-53` | Oui | Oui (4.12) | aucune | code_direct |
| Update (upsertOne) | service `68-85`, repo `59-72` | Oui | Oui (4.12) | aucune | code_direct — **update-only en pratique : 404 explicite si clé absente** |
| Create | — | **Non exposé via API** | — | — | code_direct (absence confirmée) — clés créées uniquement via seed ; `upsertMany` (repo 74-91) supporte techniquement la création mais **zéro appelant, code mort confirmé par grep** |
| Delete | — | **Non trouvé** | — | — | code_direct (absence confirmée) |

## 3.24 AuditLog

| Opération | Fichier:ligne | Existe | Dans perimetre_code du module ? | RG associée | Vérifié comment |
|---|---|---|---|---|---|
| Create (record) | `server/src/services/auditLog.service.ts:15-35` | Oui | Oui (4.14) | aucune | code_direct — seule méthode exportée, try/catch avale les erreurs, append-only |
| Read | — | **Non trouvé** | — | — | code_direct (absence confirmée) — aucun repository/controller/routes dédié, **aucun consommateur côté client** (grep=0), pas d'écran d'audit trail |
| Update | — | **Non trouvé** | — | — | code_direct (absence confirmée) — cohérent avec append-only |
| Delete | — | **Non trouvé** | — | — | code_direct (absence confirmée) — pas de purge/rétention |
| Appelants confirmés | `user.service.ts:165-169,193-197`, `project.service.ts:163,182,193`, `task.service.ts:292` | Oui | Oui (4.14) | aucune | code_direct — couvre `USER_ROLE_CHANGED`, `USER_DELETED`, `project.delete/restore/archive`, `task.delete`. **Ne couvre pas** création/update Project/Task, ni Client/Invoice/Lead — confirme le statut PARTIEL de REFERENTIEL.md §3.24 comme exact |

---

## Écarts perimetre_code trouvés

Fichiers réellement utilisés/appelés en production mais absents du `perimetre_code:` de leur module en REFERENTIEL.md §4 :

### Module 4.1 — CRM & Pipeline commercial
- `server/src/services/contact.service.ts` — crée/met à jour des `Lead` réels (`sendContactMessage`, `convertToLead`) et référence `Service`. A un contrôleur/validator associés (`contact.controller.ts`, `contact.validator.ts`), probablement aussi des routes — à confirmer.

### Module 4.2 — Gestion de projet
- `server/src/repositories/comment.repository.ts` — CRUD réel de `Comment` (liée à `Task`).
- `server/src/services/comment.service.ts` — idem.
- `server/src/controllers/comment.controller.ts` — idem, monté dans `task.routes.ts` (pas de fichier `comment.routes.ts` séparé).

### Module 4.4 — Facturation & Paiements
- `server/src/jobs/processors/maintenance.processor.ts` — contient `markOverdueInvoices` (transition SENT/PARTIAL→OVERDUE), logique métier réelle de facturation.
- `server/src/jobs/processors/ceoAlerts.processor.ts` — contient `checkInvoiceFollowup` (relances tiered, SEC-014/SEC-015).
  *(Note : le dernier commit du dépôt, `ed5f3a9`, suggère que `jobs/**` a déjà commencé à être ouvert ailleurs dans REFERENTIEL.md — à vérifier/aligner spécifiquement pour le module 4.4.)*

### Module 4.6 — Portail client
- `server/src/repositories/serviceRequest.repository.ts` — absent, alors que `serviceRequest.service.ts` y figure déjà.
- `server/src/controllers/serviceRequest.controller.ts` — absent.
- `server/src/routes/serviceRequest.routes.ts` — absent.
- `server/src/validators/serviceRequest.validator.ts` — absent.

### Module 4.7 — Freelances
- `server/src/jobs/processors/maintenance.processor.ts` — voir aussi 3.4 (archivage Lead) ; à vérifier s'il touche aussi Freelancer/FreelancerApplication.

### Module 4.8 — Analytics & Performance
- Aucun écart de fichier manquant (tous présents), mais **anomalie fonctionnelle candidate** : `executiveMetrics.*` et `revenueForecast.*` (6 fichiers) sont dans le perimetre_code mais **ne sont montés sur aucune route** (`server/src/routes/index.ts` grep = 0 résultat pour ces deux noms) — code potentiellement mort ou fonctionnalité inachevée.

### Module 4.9 — Client Success
- `server/src/jobs/processors/maintenance.processor.ts` — contient `recalculateClientScores` (cron quotidien), non listé.

### Module 4.10 — RBAC & Permissions granulaires
- Aucun écart de fichier — tous présents. Écart de structure signalé (PermissionProfile et ManagerPermission partagent le même fichier service), pas un écart de périmètre.

### Module 4.11 — Module IA (agent-service)
- `server/src/controllers/aiConversation.controller.ts` — absent, alors que c'est la couche HTTP réelle de AiConversation/AiMessage.
- `server/src/repositories/aiConversation.repository.ts` — absent.
- `server/src/routes/aiConversation.routes.ts` — absent.

### Aucun module (3.18 Document)
- `server/src/services/document.service.ts`
- `server/src/repositories/document.repository.ts`
- `server/src/controllers/document.controller.ts`
- `server/src/routes/document.routes.ts`

Ces 4 fichiers forment un CRUD complet et actif (create/read/update/delete/createVersion/sign/download), montés indépendamment dans `server/src/routes/index.ts`, mais ne sont revendiqués par **aucun** module `### 4.x` de REFERENTIEL.md — recherche exhaustive des en-têtes de section, aucune mention. Décision à soumettre à l'utilisateur (nouveau module vs rattachement à 4.6 ou 4.2).

---

## Constats hors mandat, signalés pour une prochaine passe ANOMALIES.yaml

Ce tour ne modifie pas ANOMALIES.yaml (contrainte explicite de la tâche). Les constats suivants, rencontrés incidemment pendant cette recherche, sont à enregistrer dans une prochaine session conformément à la règle CLAUDE.md « enregistrement immédiat de tout écart constaté » :

1. **Tables d'archive inexistantes en base, job cron potentiellement cassé** — `server/src/jobs/processors/maintenance.processor.ts` (fonction `archiveColdData`/`archiveTableRows`, lignes ~39-44, 69-94, 135-169) référence des tables `LeadArchive`, `ContactRequestArchive`, `NotificationArchive`, `DocumentArchive` absentes de `schema.prisma` et de toute migration (grep vide). Le job est planifié quotidiennement (cron `30 3 * * *`, `jobs/index.ts:234-238`). Si exécuté, l'étape `CREATE TABLE ... PARTITION OF "LeadArchive"` échouerait — soit échec silencieux à chaque run, soit le job n'a jamais tourné en production.
2. **Code potentiellement mort — `executiveMetrics.*`/`revenueForecast.*` non routés** (module 4.8, détaillé ci-dessus).
3. **Code mort — `invoice.repository.ts:addPayment`** (lignes 212-228), jamais appelé par `invoiceService.addPayment`.
4. **Code mort — `siteContentRepository.upsertMany`** (`siteContent.repository.ts:74-91`), zéro appelant.
5. **Code mort — `aiConversationRepository.deleteAll`** (`aiConversation.repository.ts:53-55`), sans route/controller l'exposant.
6. **Code mort — `freelancerApplicationRepository.delete`** (`freelancerApplication.repository.ts:50-52`), jamais appelé par aucun contrôleur/route.
7. **Incohérence RBAC signalée** — `rating.controller.ts` restreint via `req.user!.id`, alors que le reste du code utilise `req.user!.sub` (`JwtPayload`) — à vérifier si `id` existe réellement sur ce type ou si c'est un bug silencieux.

---

## Fichiers réellement lus (agrégation des 5 passes de recherche)

Cette section liste, par lot, les chemins effectivement ouverts et lus (pas grep seul) pendant la construction de cette grille.

**Lot 3.1–3.5** : `server/prisma/schema.prisma` (intégral), `service.service.ts`, `user.repository.ts`, `user.service.ts`, `client.repository.ts`, `client.service.ts`, `lead.repository.ts`, `lead.service.ts`, `lead.controller.ts`, `client.controller.ts`, `service.controller.ts`, `service.routes.ts`, `user.controller.ts`, `auth.repository.ts`, `auth.service.ts` (70-225), `freelancerApplication.service.ts` (100-140), `contact.service.ts` (intégral), `invoice.service.ts` (220-265), `proposal.service.ts` (380-424), `jobs/processors/maintenance.processor.ts` (1-190), `jobs/index.ts` (220-244), `lead.routes.ts`, `prisma/seed.ts` (38-145).

**Lot 3.6–3.9** : `schema.prisma` (478-598, 810-1054), `proposal.repository.ts`, `proposal.controller.ts`, `proposal.routes.ts`, `proposal.service.ts` (intégral, 566 lignes), `jobs/processors/maintenance.processor.ts`, `invoice.service.ts` (190-290, 460-492), `project.service.ts`, `project.controller.ts`, `project.routes.ts`, `project.repository.ts`, `task.service.ts`, `task.repository.ts`, `task.controller.ts`, `task.routes.ts`, `comment.controller.ts`, `comment.service.ts`, `comment.repository.ts`, `clientOnboarding.repository.ts`, `clientOnboarding.controller.ts`, `clientOnboarding.routes.ts`, `clientOnboarding.service.ts`, `rbac.middleware.ts` (extrait).

**Lot 3.10–3.14** : `schema.prisma`, `invoice.service.ts`, `invoice.repository.ts`, `invoice.controller.ts`, `invoice.routes.ts`, `invoice.validator.ts`, `creditNote.service.ts`, `commission.service.ts`, `commission.repository.ts`, `commission.controller.ts`, `commission.routes.ts`, `commission.validator.ts`, `utils/vat.ts`, `jobs/processors/maintenance.processor.ts` (235-315), `jobs/processors/ceoAlerts.processor.ts` (140-240), `clientOnboarding.repository.ts` (195-224).

**Lot 3.15–3.18** : `schema.prisma`, `freelancer.repository.ts`, `freelancer.service.ts`, `freelancer.controller.ts`, `freelancer.routes.ts`, `portfolio.routes.ts`, `rating.service.ts`, `rating.controller.ts`, `rating.routes.ts`, `freelancerApplication.repository.ts`, `freelancerApplication.service.ts`, `freelancerApplication.controller.ts`, `freelancerApplication.routes.ts`, `serviceRequest.repository.ts`, `serviceRequest.service.ts`, `serviceRequest.controller.ts`, `serviceRequest.routes.ts`, `serviceRequest.validator.ts`, `approval.repository.ts`, `approval.service.ts`, `approval.controller.ts`, `approval.routes.ts`, `document.repository.ts`, `document.service.ts`, `document.controller.ts`, `document.routes.ts`, `routes/index.ts` (extraits).

**Lot 3.19–3.24** : `schema.prisma` (348-392, 1324-1454, 1487-1507, 1565-1594), `gscConnection.service.ts`, `gscConnection.repository.ts`, `gscConnection.controller.ts`, `gscConnection.routes.ts`, `metricSnapshot.controller.ts`, `metricSnapshot.repository.ts`, `googleOAuth.service.ts`, `searchConsole.service.ts`, `metricAnomaly.service.ts`, `clientPortal.controller.ts` (1-50), `jobs/processors/maintenance.processor.ts` (300-378), `clientSuccess.service.ts`, `clientSuccess.repository.ts`, `clientSuccess.controller.ts`, `clientSuccess.routes.ts`, `invoice.service.ts` (extrait), `managerPermission.service.ts`, `managerPermission.repository.ts`, `permissionProfile.repository.ts`, `managerPermission.controller.ts`, `permissionProfile.controller.ts`, `managerPermission.routes.ts`, `permissionProfile.routes.ts`, `rbac.middleware.ts`, `auth.middleware.ts`, `types/auth.ts` (extrait), `managerPermission.validator.ts`, `permissionProfile.validator.ts`, `cache/cacheKeys.ts` (extrait), `proposal.service.ts` (extraits 20-24,76-80), `aiConversation.repository.ts`, `aiConversation.service.ts`, `aiConversation.controller.ts`, `aiConversation.routes.ts`, `agentOrchestrator.service.ts` (115-152), `ai.controller.ts` (grep, 0 résultat), `siteContent.service.ts`, `siteContent.repository.ts`, `siteContent.controller.ts`, `siteContent.routes.ts`, `siteContent.validator.ts`, `auditLog.service.ts`, `user.service.ts` (165-197), `project.service.ts` (163-193), `task.service.ts` (292).

## Fichiers trouvés par grep mais NON lus en détail — surface de travail restante

`[À VÉRIFIER — non lu en détail]` pour tout le contenu de ces fichiers (existence confirmée par grep/Glob uniquement) :

`client.service.ts`/`client.repository.ts` (relations Invoice/Payment), `dashboard.service.ts`, `summary.repository.ts`/`summary.controller.ts`, `executiveMetrics.repository.ts`/`.service.ts`/`.controller.ts`, `clientProfitability.repository.ts`, `documentGenerator.service.ts` (sauf ligne 458), `clientPortal.service.ts`/`.repository.ts` (sauf extraits), `emailTemplates/index.ts`, `jobs/jobNames.ts`, `jobs/index.ts` (hors extraits cités), `jobs/queues.ts`, `jobs/redisConnection.ts`, `utils/documentNumber.ts`, `swagger.ts`/`swagger-schemas.ts`, `analytics.repository.ts`, `search.repository.ts`, `revenueForecast.repository.ts`/`.service.ts`/`.controller.ts`, `routes/analytics.routes.ts`, `constants/serviceMapping.ts`, `constants/briefQuestions.ts`, `types/entities.ts`, `projectTemplate.service.ts`/`.repository.ts`/`.controller.ts`, `projectMeeting.service.ts`/`.repository.ts`/`.controller.ts`, `projectSpecs.service.ts`, `timeEntry.service.ts`/`.repository.ts`, `middlewares/upload.middleware.ts`, `controllers/upload.controller.ts`, `validators/freelancer.validator.ts`, `validators/document.validator.ts`, `validators/approval.validator.ts`, `validators/freelancerApplication.validator.ts`, `validators/proposal.validator.ts`, `validators/project.validator.ts`, `validators/task.validator.ts`, `validators/clientOnboarding.validator.ts`, `jobs/processors/documents.processor.ts`, `jobs/processors/ceoAlerts.processor.ts` (hors extrait 140-240 et fonctions déjà citées dans EXPLORATION.md), `env.ts` (sauf grep ciblé).
