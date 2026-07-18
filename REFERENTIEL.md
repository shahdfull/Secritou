# REFERENTIEL — Secritou

## 0. Métadonnées

| Champ | Valeur |
|---|---|
| Version | 0.2.1 |
| Date | 2026-07-16 |
| Statut | Draft — passera à `Validated`/`Approved` après revue fonctionnelle et validation métier |

### Documents du projet

En cas de conflit entre documents, l'ordre ci-dessous fait foi — un document
`dérivé` ou `historique` qui contredit REFERENTIEL.md est une anomalie à
enregistrer dans ANOMALIES.yaml, pas un arbitrage à trancher à la volée
(voir CLAUDE.md).

| Document | Rôle | Statut | Qui l'emporte en cas de conflit |
|---|---|---|---|
| REFERENTIEL.md | Description du SI cible, règles métier, statuts vérifiés | **source de vérité** | Ce document |
| CLAUDE.md | Règles opérationnelles pour l'assistant, résumé de REFERENTIEL.md | dérivé | REFERENTIEL.md |
| ANOMALIES.yaml | Registre des écarts entre REFERENTIEL.md et le code/les autres documents | dérivé | REFERENTIEL.md (les anomalies décrivent des écarts, n'en créent pas) |
| EXPLORATION.md | Couverture de la lecture de code ayant produit REFERENTIEL.md | dérivé | REFERENTIEL.md |
| PISTES.md | Affirmations non vérifiées extraites de documents `historique`, à trancher plus tard sur le code | dérivé, aucune valeur probante seule | REFERENTIEL.md |
| README.md | Présentation du projet (public/onboarding dev) | **historique** — contient des affirmations non vérifiées (ex. « multi-tenant », middleware `tenant` inexistant, voir SEC-004) | REFERENTIEL.md |
| `Secritou_Cadrage.docx`, `Secritou_CahierDesCharges_Site.docx` | Cadrage produit/business d'origine | **historique** — citable comme intention, jamais comme preuve d'implémentation | REFERENTIEL.md |
| `audit/*.md`, `plan d'action.md`, `WORKFLOW_AUDIT_REPORT.md` | Rapports d'audit antérieurs (LLM, périmètre non garanti) | **historique** — citable comme piste (voir PISTES.md), jamais comme source de vérité | REFERENTIEL.md |

---

## 1. Objet et périmètre du SI

Secritou est double : **une agence** (services de conseil/exécution digitale,
en lancement, 0 client actif) **et un logiciel** (SaaS interne mono-tenant de
pilotage opérationnel de cette agence — voir §7 pour l'arbitrage tranchant la
question multi-tenant). Ce référentiel décrit le SI **cible** tel
qu'observable dans le dépôt (code + documents de cadrage), pas une
spécification aspirationnelle non ancrée dans le projet.

Le détail de ce qui est couvert, gelé, ou hors périmètre est donné en
**§6 uniquement** (liste unique, module par module) — voir §4 pour la
classification ACTIF/GELÉ/HORS PÉRIMÈTRE de chaque module.

---

## 2. Glossaire canonique

| Terme (FR — forme exacte) | EN | Définition |
|---|---|---|
| Pôle | Pole / Service | Département métier de l'agence, porté par un associé. Modélisé en base par l'entité `Service`. |
| **Management & Performance** | Management & Performance | Pôle : audit, KPI, OKR, tableaux de bord, reporting, analyse financière. |
| **Croissance digitale** | Digital Growth | Pôle : community management, contenu, SEO, Meta/Google Ads, email. |
| **Technologie** | Technology | Pôle : sites, e-commerce, CRM, gestion de stock, solutions métiers. Porté par le même associé que le pôle IA & Automatisation. |
| **IA & Automatisation** | AI & Automation | Pôle : chatbots, automatisation des flux, intégrations. |
| Cible | Target segment | Segment commercial d'entrée. Concept métier confirmé **absent de toute donnée structurée** (recherche exhaustive dans `schema.prisma`, `client/`, `server/`, aucun enum/champ/table — v0.1.0, non revérifiée mais portant sur une absence, pas une présence hypothétique). Classé HORS PÉRIMÈTRE en §6 — une absence vérifiée est un fait, pas un doute à rétrograder. |
| **Entreprise & Startup** | Business & Startup | Cible B2B, entrée par le pôle Management & Performance, canal LinkedIn. |
| **Commerce & Marque** | Commerce & Brand | Cible B2C, entrée par le pôle Croissance digitale, canal Instagram. |
| Associé | Partner | Un des 3 associés, chacun responsable d'un pôle (le Responsable Technologie porte aussi le pôle IA & Automatisation). Modélisé par `User` (aucun rôle `Role` dédié « Associé » — un associé se connecte via `Role.MANAGER`). |
| Mission | Mission / Project | Engagement contractuel avec un client, correspondant à un `Project`. |
| Devise | Currency | Dinar tunisien, code `TND`, noté DT. |
| TVA | VAT | Taxe sur la valeur ajoutée, taux fixe 19% (`TVA_RATE` dans le code). |
| Commission | Commission | Part de revenu due à un associé sur un paiement reçu pour une mission qu'il a exécutée. |
| Client | Client | Entité payante, distincte de son Lead d'origine. |
| Lead | Lead | Prospect en amont du pipeline commercial. |
| Proposition | Proposal | Devis envoyé à un lead/client, source de la mission si acceptée. |
| Portail client | Client portal | Accès externe du Client à son projet, factures, brief, validations. |

---

## 3. Entités

Pour chaque entité : définition, attributs clés, relations, cycle de vie,
statut, et **provenance du statut** (`verifie:`).

Valeurs possibles de `verifie:` — `code_direct` (fichier(s) ouvert(s) et lu(s)
en entier cette session ou la précédente, chemin cité), `code_grep` (chaîne
trouvée par recherche, logique environnante non lue), `test` (assertion
vérifiée par un test automatisé existant, cité), `schema_seul` (établi à
partir de `schema.prisma` uniquement), `audit_anterieur` (repris d'un rapport
d'audit, non revérifié), `document` (repris d'un README/docx/cadrage, non
revérifié).

**`verifie: test` exige un test qui IMPORTE ET APPELLE le code réel.** Un
test qui réimplémente sa cible, recopie une condition ou teste une fonction
locale équivalente ne prouve rien : il resterait vert si le code réel
dérivait. Un tel test vaut `code_grep` au mieux (voir RG-019 : le test initial
recopiait la condition de `user.service.ts` sans jamais importer ni appeler
`userService.updateUser`).

**Règle stricte (voir CLAUDE.md) : un statut `IMPLÉMENTÉ` n'est autorisé que
si `verifie: code_direct` ou `verifie: test`.** Tout statut établi par
`code_grep`, `schema_seul`, `audit_anterieur` ou `document` est
`[À CONFIRMER]`, quelle que soit sa plausibilité.

**Cas particulier `schema_seul` vs `code_direct` sur `schema.prisma`** : citer
`schema.prisma` vaut `code_direct` uniquement quand l'affirmation porte sur la
**structure** de la base (existence d'un champ, d'une contrainte
`@@unique`, d'un type singleton). Quand l'affirmation porte sur un
**comportement** (ce que le code fait avec ce champ), le schéma seul ne
suffit pas — une colonne prouve qu'un champ existe, pas qu'une valeur est
imposée ou qu'une logique s'applique. Dans ce second cas : `schema_seul`.

**Règle des affirmations négatives** : une règle qui énonce une interdiction
ou une exclusivité (« ne peut que… », « ne doit jamais… », « uniquement
par… ») ne peut pas être établie par `code_grep` ni par la seule lecture du
chemin nominal — un grep ou une lecture du chemin qui fonctionne prouve qu'un
chemin existe, jamais qu'aucun autre chemin ne le contourne. Elle exige
`verifie: test` (un test qui assère le refus/l'exclusivité elle-même). À
défaut : statut `[À CONFIRMER]`, `verifie: code_grep` ou `code_direct` selon
le cas, avec en note le test qui la trancherait.

**Une règle métier (§5) énonce une seule affirmation testable.** Une règle
dont deux parties ont des statuts de vérification différents doit être
scindée en sous-règles (`RG-004a`, `RG-004b`, etc.), jamais résolue au statut
le plus favorable.

### 3.1 Company
Enregistrement unique (singleton) représentant l'agence Secritou elle-même
(nom, matricule fiscal tunisien, branding). `singleton Boolean @default(true)`
+ `@@unique([singleton])` — aucun `companyId`/`tenantId` sur aucun autre
modèle du schéma (recherche exhaustive dans `schema.prisma`).
**Statut : IMPLÉMENTÉ. `verifie: code_direct` (schema.prisma, intégral).**

### 3.2 User
Compte de connexion à la plateforme. Attributs clés : email, rôle,
`clientId` (si Client), `serviceId` (pôle d'affectation, pertinent pour
Manager), `phone` (String?, ajouté par migration `20260716120000_add_phone_to_user`
— décision produit du 2026-07-16, voir §7). `phone` est accepté en écriture,
persisté, relu par l'API (`userPublicFields`, `toAuthUser`) et affiché/
modifiable dans le portail Client — correctif du 2026-07-16 (SEC-006,
`en_cours` : correctif écrit et testé, non encore commité/passé en CI au
moment de la rédaction). `verifie: code_direct` (schema.prisma:150 pour la
structure ; server/src/repositories/user.repository.ts:6-17 et
server/src/services/auth.service.ts:25-37 pour la lecture, session du
2026-07-16).
Rôles réellement implémentés (`enum Role`) :

| Rôle | Description |
|---|---|
| Admin | Accès total. |
| Manager | Gère leads, projets, tâches, clients — scopé à son pôle (`serviceId`) sauf permissions étendues. Représente un associé. |
| Client | Portail externe (projet, factures, brief, validation). |
| Freelancer | Missions et profil. |

Un cinquième profil, **Visiteur** (utilisateur non authentifié du site
public), existe fonctionnellement mais n'est pas un `Role` en base.

**Note d'écart documentaire** : le cahier des charges du site
(`Secritou_CahierDesCharges_Site.docx`, historique) ne mentionne que 4 profils
(Visiteur/Client/Associé/Admin) et pas de rôle Freelancer distinct.

**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (schema.prisma pour la
structure des rôles — lecture intégrale ; le chemin `updateMe`/`phone` est
documenté séparément en SEC-006, sourcé sur une lecture intégrale ligne par
ligne de `users.api.ts` → `user.routes.ts` → `user.validator.ts` →
`user.controller.ts` → `user.service.ts` → `user.repository.ts`, session du
2026-07-16 — le verdict sur le comportement précis de Prisma au runtime reste
une inférence technique à partir du code lu, non une observation d'exécution
réelle).

### 3.3 Service (Pôle)
Un des 4 pôles métier. Attributs : `name` (unique, une des 4 valeurs
canoniques §2). Relations : `leads`, `projects`, `users` (managers),
`clients`, `templates`.
**Statut : IMPLÉMENTÉ. `verifie: code_direct` (schema.prisma + `seed.ts`,
grep ciblé confirmant les 4 noms canoniques).**

### 3.4 Lead
Prospect commercial. Cycle de vie :
`NEW → CONTACTED → QUALIFIED → PROPOSAL → WON/LOST`. Rattaché à un pôle
(`serviceId`), optionnellement à un manager assigné.
**Statut : IMPLÉMENTÉ. `verifie: code_direct` (schema.prisma ; grep ciblé sur
`lead.service.ts`, non lu intégralement — voir EXPLORATION.md).**

### 3.5 Client
Entité payante. Attributs : `creditBalance`, `portalActivatedAt` (portail
débloqué), `serviceId` (pôle hérité du lead d'origine).
**Statut : IMPLÉMENTÉ. `verifie: schema_seul` — le service `client.service.ts`
n'a pas été lu directement (voir EXPLORATION.md, module 4.1 : partiel).**

### 3.6 Proposal (Proposition/Devis)
Devis adressé à un lead ou client. Cycle de vie :
`DRAFT → SENT → VIEWED → ACCEPTED/REJECTED/EXPIRED`. Montant en TND.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`server/src/services/proposal.service.ts` lignes 1-80 et 306-465, session
précédente).**

### 3.7 Project (Mission)
Unité d'exécution d'une mission pour un client. Cycle de vie :
`PLANNING → IN_PROGRESS → REVIEW → COMPLETED`.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`server/src/services/project.service.ts` lignes 1-100 et grep ciblé
194-346, session précédente).** **SEC-033 trouvée et corrigée (session du
2026-07-18)** : la lecture partielle d'origine n'avait jamais couvert
`project.repository.ts#findById`/`projectListSelect`, où résidait un bug
bloquant — la relation `tasks` n'était jamais sélectionnée, donc le
détail d'un projet n'affichait jamais ses tâches côté client, malgré un
type client (`Project.tasks?: Task[]`) qui laissait croire le contraire.
Corrigé : `tasks` (id/title/status uniquement) ajouté au `baseSelect` de
`findById`, jamais à `projectListSelect` lui-même (partagé avec `findAll`,
éviterait une régression de performance sur la liste paginée). Voir
SEC-033.

### 3.8 Task
Tâche au sein d'un projet. Cycle de vie :
`TODO → IN_PROGRESS → REVIEW → DONE`.
**Statut : IMPLÉMENTÉ. `verifie: schema_seul` — `task.service.ts` non lu
intégralement (grep ciblé AuditLog seulement, voir EXPLORATION.md).**

### 3.9 ClientOnboarding et sous-étapes
Suivi structuré du démarrage d'une mission, en 7 étapes : Contract, Payment,
Questionnaire, Specifications, KickoffMeeting, ProductionProgress, Delivery.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (session du 2026-07-17 :
`clientOnboarding.service.ts` (122 lignes), `.repository.ts` (363 lignes),
`.controller.ts` (388 lignes) lus intégralement — les 3 fichiers cœur du
module. CRUD complet sur l'onboarding et les 7 sous-étapes, scoping
Client (`userClientId`) et Manager par pôle (`managerServiceId`, note du
repository confirmant une correction antérieure — « previously
unscoped »). `createOnboarding` initialise les 8 étapes par défaut
(welcome + les 7 citées). `updateStep` notifie les admins par email
quand une étape passe COMPLETED (best-effort, erreurs avalées).
Repository déjà entièrement typé sur les types Prisma générés
(`Prisma.<Model>UncheckedUpdateInput`/`CreateInput`), pas de trace de la
classe de défaut SEC-012 ici. Aucune anomalie fonctionnelle trouvée.

### 3.10 Invoice (Facture)
Facture émise à un client. Types : `STANDARD`, `DEPOSIT` (acompte, 30% de la
proposition), `BALANCE` (solde, 70%). Numérotation séquentielle mensuelle
sans trou (`INV-YYYYMM-NNNN`). Porte le détail TVA réel (`amountHT`,
`tvaRate`, `tvaAmount`). Devise `TND`.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`server/src/utils/vat.ts` intégral ; `invoice.service.ts` grep ciblé
`addPayment`, non lu intégralement — voir EXPLORATION.md, la partie TVA/RG-003
est `code_direct`, le reste du cycle de vie facture est `schema_seul`).**

### 3.11 Payment
Paiement enregistré contre une facture. Déclenche le calcul de commission
(RG-008) dans la même transaction.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`server/src/services/commission.service.ts`, qui documente et consomme ce
déclenchement, intégral).**

### 3.12 CreditNote (Avoir)
Note de crédit pour trop-perçu ou correction, incrémente
`Client.creditBalance`.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (session du 2026-07-17 :
`creditNote.service.ts` lu intégralement, 183 lignes — pas de repository/
controller/routes dédiés, les endpoints vivent dans `invoice.controller.ts`/
`invoice.routes.ts` (déjà confirmé par AUDIT_GRID.md). `create`,
`listByInvoice`, `listByClient`, `getAll`, `applyCredit`, et le chemin
automatique `createCreditNoteTx` (déclenché par un trop-perçu dans
`invoice.service.ts#addPayment`) tous lus. Une anomalie trouvée et corrigée
dans la même passe — voir SEC-022 : le garde-fou anti-double-application
d'`applyCredit` ne se déclenchait jamais (Prisma lève `P2025` au lieu de
retourner `null`, jamais catché, remontait en 500 générique au lieu du 409
prévu). Reproduit réellement contre la base, corrigé, testé
(`server/test/creditNoteApply.test.ts`).

### 3.13 ProjectCommissionSplit
Répartition manuelle, par projet, du pourcentage de commission attribué à
chaque associé (`partnerId`, `ratePct`).
**Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`commission.service.ts` intégral, `commission.validator.ts` grep ciblé).**

### 3.14 Commission
Montant dû à un associé pour un paiement précis reçu. Statuts :
`PENDING → PAID` (transition manuelle, déclenchée par un Admin).
**Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`commission.service.ts` intégral, `analyticsCommissionScope.test.ts`
intégral).**

### 3.15 FreelancerProfile / Skill / PortfolioItem / Rating
Profil freelance, compétences, portfolio, évaluations.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** — resynchronisation avec
le statut déjà établi pour le module 4.7 Freelances (9 fichiers lus
intégralement, session 2026-07-17, mêmes fichiers exacts que cette
entité), jamais répercuté sur l'entité elle-même. Pas de nouvelle lecture
nécessaire, seule une incohérence de statut corrigée. **La fuite de
`hourlyRate` mentionnée dans `plan d'action.md` (audit antérieur,
historique) est infirmée par cette lecture directe** — voir §4.7.

### 3.16 ServiceRequest
Demande de support ou de nouveau projet initiée côté client. Statuts :
`NEW → IN_REVIEW → IN_PROGRESS → WAITING_CLIENT → COMPLETED/CANCELLED`.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (session du 2026-07-17 :
`serviceRequest.service.ts` (130 l.), `.repository.ts` (188 l.),
`.controller.ts` (105 l.) lus intégralement. Machine à états
`ALLOWED_TRANSITIONS` confirmée, `type` immuable après création
(`SERVICE_REQUEST_TYPE_IMMUTABLE`), historique append-only sur
statut/priorité/assignation, scoping Manager par pôle vérifié sur
`getServiceRequestById`/`adminUpdateServiceRequest`/
`deleteServiceRequest`/`addComment` (via `client.projects.some.serviceId`).
`deleteComment` ne vérifie que la propriété du commentaire
(`authorId`), pas le scope pôle — vérifié que ce n'est pas exploitable :
un Manager hors-pôle ne peut jamais être auteur d'un commentaire sur une
demande hors de son pôle, puisque `addComment` applique déjà le scope à
la création. Aucune anomalie fonctionnelle trouvée.

### 3.17 Approval
Élément soumis à validation du client. Statuts :
`PENDING → APPROVED/REJECTED`.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** — `approval.service.ts`,
`.repository.ts`, `.controller.ts`, `.routes.ts`, `.validator.ts` lus
intégralement (EXPLORATION.md, module 4.6 marqué `lu`, sessions
2026-07-16/17). Statut de l'entité resynchronisé avec celui déjà établi
pour le module — RG-013 (clôture de mission par validation client)
vérifié directement sur ce chemin (`respondToApproval`). Aucune anomalie
trouvée sur Approval spécifiquement (AUDIT_GRID.md, session 2026-07-17,
confirme le CRUD complet : create/read/update/delete/approve/reject/
comment/attachments, sans écart).

### 3.18 Document
Fichier versionné rattaché à un client/projet/facture, avec niveaux d'accès
et journal d'accès (`DocumentAccessLog`). Rattaché au module 4.2 Gestion de
projet (décision du porteur du projet, 2026-07-17, voir §7).
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (session du 2026-07-17 :
`document.service.ts` (114 l.), `.repository.ts` (138 l.),
`.controller.ts` (103 l.) lus intégralement — 355 lignes. CRUD complet,
versioning, journal d'accès, URL de téléchargement signée à la demande
(jamais l'URL longue durée exposée directement au client). **SEC-023
trouvée et corrigée dans la même passe, gravité `bloquant`** : la
signature électronique de contrat (citée dans README.md) ne fonctionnait
JAMAIS, y compris sur le chemin normal (document lié à un projet) —
`Document.signedByClientId` est en réalité une clé étrangère vers
`User.id`, pas `Client.id`, malgré son nom ; le code y écrivait l'id du
Client, violant systématiquement la contrainte FK. Un second défaut
distinct empêchait en plus la signature de tout document `CONTRACT` créé
sans `projectId` (chemin pourtant autorisé par le validateur). Reproduit
réellement (les deux chemins), corrigé, testé
(`server/test/documentSignContract.test.ts`, 4 cas). **SEC-034 trouvée et
corrigée (session du 2026-07-18)** : le scope FREELANCER de
`documentRepository.findAll` (`where.project = { tasks: { some: {...} } }`,
introduit par un correctif de sécurité antérieur — voir commentaire dans
le code) rend invisible tout document dont `projectId` est `null`,
vérifié empiriquement contre une base réelle. `ProjectDetailPage.tsx`
créait ses livrables sans jamais renseigner `projectId`/`clientId`,
rendant chaque livrable invisible pour le freelance qui venait de le
déposer. Corrigé côté client (transmission de `projectId`/`clientId` à
la création et à la lecture) — le service/repository lui-même
fonctionnait déjà correctement une fois les champs fournis. Voir SEC-034.

### 3.19 GscConnection / MetricSnapshot
Connexion OAuth à Google Search Console par client, et stockage générique de
métriques externes.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (session du 2026-07-17 :
`gscConnection.service.ts` (126 l.), `.repository.ts` (45 l.),
`googleOAuth.service.ts` (66 l.), `searchConsole.service.ts` (174 l.),
`metricSnapshot.repository.ts` (55 l.), `metricAnomaly.service.ts` (58 l.),
`gscConnection.controller.ts` (55 l.), `metricSnapshot.controller.ts`
(15 l.) lus intégralement — 594 lignes cumulées, les 9 fichiers déjà
identifiés par grep. Flux OAuth complet et sécurisé (state signé HMAC,
CSRF, tokens jamais transmis en clair au client, `prompt=consent` pour
garantir un `refresh_token`), révocation gérée à deux points d'entrée
(échec de refresh + 401 sur requête), détection d'anomalie de trafic
(moyenne mobile 7 jours). Aucune anomalie fonctionnelle trouvée.
**Le statut PARTIEL de la v0.1.0 (« restitution admin-only, absence côté
client »), repris d'un audit antérieur (voir PISTES.md), est infirmé par
lecture directe** : `clientPortal.controller.ts#getClientPortalSeoMetrics`
expose bien une lecture des métriques scopée au client authentifié
(`req.user!.clientId`, jamais un paramètre d'URL arbitraire) — le portail
Client a bien accès à ses propres métriques SEO, distinct du chemin
ADMIN/MANAGER de `/integrations/gsc` qui gère connexion/déconnexion.

### 3.20 ClientSuccess (et sous-entités)
Suivi de la réussite client, score 0-100.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (session du 2026-07-17 :
`clientSuccess.service.ts` (151 l.), `.repository.ts` (123 l.),
`.controller.ts` (108 l.), `.routes.ts` (135 l.) lus intégralement — 517
lignes. Score calculé (`calculateScore`) : 50% manuel (objectifs 20%,
métriques 15%, recommandations 15%) + 50% auto (ponctualité paiement 20%,
délai paiement 15%, projet actif 10%, ancienneté 5%), plafonné à 100.
Recalcul déclenché après tout changement pertinent (`recalcAndPersist`,
non-fatal — une erreur de scoring n'interrompt jamais l'action
déclenchante). Repository vérifie l'ownership par `clientId` sur chaque
mutation quand fourni par le portail (jamais exposé au rôle CLIENT
lui-même — `clientSuccess.routes.ts` est intégralement ADMIN/MANAGER,
confirmé aucune fuite vers `clientPortal.controller.ts`, cohérent avec la
nature interne de cet outil de pilotage). Aucune anomalie trouvée.

### 3.21 PermissionProfile / ManagerPermission
Système de permissions granulaires par manager.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`** (session du 2026-07-17 :
`managerPermission.service.ts` (109 l.), `.repository.ts` (39 l.),
`permissionProfile.repository.ts` (44 l.), `.controller.ts` ×2 (34 + 41 l.),
`.routes.ts` ×2 (19 + 25 l.), `rbac.middleware.ts` (73 l.) lus
intégralement — 411 lignes cumulées sur 8 fichiers. Confirme le texte de
README.md : cache Redis clé `cache:manager:permissions:${userId}`, TTL
**300s (5 min) exact**, fusion `deepMerge(profil, overrides)` où
`overrides` gagne. Fail-closed confirmé : un Manager sans
`ManagerPermission` row reçoit `DEFAULT_MANAGER_PERMISSIONS` (tous modules
à `false`) ; un Manager avec row mais sans `profileId` reçoit `{}`, qui
produit le même résultat de rejet côté `requirePermission`
(`permissions[module]?.[action]` sur `undefined` → falsy → 403) — deux
représentations différentes, même comportement de sécurité, pas une
divergence. `permissionProfileService` défini dans le même fichier que
`managerPermissionService` (pas de `permissionProfile.service.ts` séparé)
— écart de structure déjà noté par AUDIT_GRID.md, pas une anomalie
fonctionnelle. `/me` accessible à tout rôle authentifié,
`/:userId`/gestion des profils : ADMIN uniquement. Aucune anomalie
fonctionnelle trouvée.

### 3.22 AiConversation / AiMessage
Historique des échanges avec les personas IA, par utilisateur.
**Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`agentOrchestrator.service.ts` intégral, qui persiste ces entités).**

### 3.23 SiteContent
Contenu éditable du site vitrine public, bilingue (FR/EN).
**Statut : IMPLÉMENTÉ. `verifie: code_direct`**
(`server/src/routes/index.ts:218-219` — enregistrement des routes publiques
et admin ; `LandingCmsProvider.tsx` lignes 1-40 — confirme que le site public
de ce même dépôt consomme réellement `SiteContent`, pas de build séparé ;
`siteContent.service.ts` lui-même non lu — le statut porte sur le fait que
le contenu est bien servi, pas sur le détail de sa logique interne).

### 3.24 AuditLog
Modèle Prisma (acteur, action, entité, avant/après).
**Statut : PARTIEL. `verifie: code_direct`** — grep confirmant l'appel
depuis 3 services (`project.service.ts`, `task.service.ts`,
`user.service.ts`), session courante. **Ceci contredit le `[À CONFIRMER]` de
la v0.1.0, qui reprenait d'un audit antérieur l'hypothèse d'un modèle
possiblement inutilisé — voir §7, journal des décisions.** Le contenu de
`auditLog.service.ts` lui-même (ce qui est réellement enregistré, couverture
des actions sensibles) n'a pas été lu — reste `[À CONFIRMER]` pour le détail,
mais l'usage de base est `code_direct`.

---

## 4. Modules

Classification à 3 états (voir §6 pour le détail et le journal §7 pour
l'arbitrage) :
- **ACTIF** : audité, maintenu, on y investit.
- **GELÉ** : le code reste et tourne. Zéro développement, **zéro audit**,
  sauf si une anomalie bloque le chemin de l'argent — auquel cas c'est le
  statut du module qui se rediscute, pas l'anomalie qui se documente en
  routine.
- **HORS PÉRIMÈTRE (phase 2)** : non implémenté, ne sera pas construit
  maintenant.

Chaque module porte un bloc `perimetre_code:` — chemins vérifiés par listing
direct cette session, jamais devinés. `perimetre_code: [] # non localisé`
signifie qu'aucun fichier n'a pu être associé avec certitude.

### 4.1 CRM & Pipeline commercial — **ACTIF**
Gestion des leads, conversion en client, propositions/devis.

    perimetre_code:
      - server/src/services/lead.service.ts
      - server/src/services/proposal.service.ts
      - server/src/repositories/lead.repository.ts
      - server/src/repositories/proposal.repository.ts
      - server/src/controllers/lead.controller.ts
      - server/src/controllers/proposal.controller.ts
      - server/src/routes/lead.routes.ts
      - server/src/routes/proposal.routes.ts
      - server/src/validators/lead.validator.ts
      - server/src/validators/proposal.validator.ts
      - server/src/services/contact.service.ts
      - prisma/schema.prisma#Lead,Client,Proposal,ProposalSection,ProposalHistory
      - client/src/features/crm/**
      - client/src/features/leads/**
      - client/src/features/proposals/**
      - client/src/api/contactRequests.api.ts

Écart perimetre_code corrigé (AUDIT_GRID.md, 2026-07-17) : `contact.service.ts`
crée/met à jour des `Lead` réels (`sendContactMessage`, `convertToLead`) et
référence `Service` — actif, non listé jusqu'ici.

### 4.2 Gestion de projet — **ACTIF**
Projets, tâches, réunions de projet, templates de tâches par pôle, documents
liés aux projets/missions.

    perimetre_code:
      - server/src/services/project.service.ts
      - server/src/services/projectMeeting.service.ts
      - server/src/services/projectSpecs.service.ts
      - server/src/services/projectTemplate.service.ts
      - server/src/services/comment.service.ts
      - server/src/services/document.service.ts
      - server/src/repositories/project.repository.ts
      - server/src/repositories/projectMeeting.repository.ts
      - server/src/repositories/projectTemplate.repository.ts
      - server/src/repositories/comment.repository.ts
      - server/src/repositories/document.repository.ts
      - server/src/controllers/project.controller.ts
      - server/src/controllers/projectMeeting.controller.ts
      - server/src/controllers/projectTemplate.controller.ts
      - server/src/controllers/comment.controller.ts
      - server/src/controllers/document.controller.ts
      - server/src/routes/project.routes.ts
      - server/src/routes/document.routes.ts
      - server/src/validators/project.validator.ts
      - server/src/validators/projectMeeting.validator.ts
      - server/src/utils/projectProgress.ts
      - prisma/schema.prisma#Project,Task,Comment,ProjectMeeting,ProjectTemplate,TaskTemplate,Document,DocumentAccessLog
      - client/src/features/projects/**
      - client/src/features/tasks/**

Écarts perimetre_code corrigés (AUDIT_GRID.md, 2026-07-17) :
(1) `comment.service.ts`/`.repository.ts`/`.controller.ts` — CRUD réel de
`Comment` (liée à `Task`), routes montées dans `task.routes.ts` (pas de
fichier `comment.routes.ts` séparé, cohérent avec l'absence d'entrée
dédiée ci-dessus).
(2) `document.service.ts`/`.repository.ts`/`.controller.ts`/`.routes.ts` —
n'étaient rattachés à aucun module §4 (entité 3.18 documentée au schéma
seul). Décision du porteur du projet, 2026-07-17 : les documents sont des
documents projet/mission, pas un module séparé — rattachés à 4.2. Voir §7.

### 4.3 Onboarding client — **ACTIF**
Parcours structuré de démarrage de mission en 7 étapes.

    perimetre_code:
      - server/src/services/clientOnboarding.service.ts
      - server/src/repositories/clientOnboarding.repository.ts
      - server/src/controllers/clientOnboarding.controller.ts
      - server/src/routes/clientOnboarding.routes.ts
      - server/src/validators/clientOnboarding.validator.ts
      - prisma/schema.prisma#ClientOnboarding,OnboardingStep,Contract,Payment,Questionnaire,Specifications,KickoffMeeting,ProductionProgress,Delivery
      - client/src/features/client-onboarding/**
      - client/src/features/admin-onboarding/**

### 4.4 Facturation & Paiements — **ACTIF**
Devis, factures (acompte/solde/standard), TVA, paiements, avoirs, relances.

**Note (AUDIT_GRID.md, 2026-07-17)** : `server/src/jobs/processors/maintenance.processor.ts`
(`markOverdueInvoices`) et `server/src/jobs/processors/ceoAlerts.processor.ts`
(`checkInvoiceFollowup`, SEC-014/SEC-015) contiennent une logique métier
réelle de facturation, mais ces fichiers ne sont pas dupliqués dans le
`perimetre_code:` ci-dessous — ils sont déjà déclarés une seule fois, au
§4.13 (`server/src/jobs/**`, composant transverse). Se référer à 4.13 pour
leur périmètre exact.

    perimetre_code:
      - server/src/services/invoice.service.ts
      - server/src/services/creditNote.service.ts
      - server/src/repositories/invoice.repository.ts
      - server/src/controllers/invoice.controller.ts
      - server/src/routes/invoice.routes.ts
      - server/src/validators/invoice.validator.ts
      - server/src/utils/vat.ts
      - prisma/schema.prisma#Invoice,InvoiceItem,InvoiceCounter,InvoiceReminder,Payment,CreditNote
      - client/src/features/invoices/**

### 4.5 Rémunération des associés (Commissions) — **ACTIF**
Répartition et calcul des commissions par mission et par paiement reçu.

    perimetre_code:
      - server/src/services/commission.service.ts
      - server/src/repositories/commission.repository.ts
      - server/src/controllers/commission.controller.ts
      - server/src/routes/commission.routes.ts
      - server/src/validators/commission.validator.ts
      - server/test/analyticsCommissionScope.test.ts
      - prisma/schema.prisma#ProjectCommissionSplit,Commission
      - client/src/features/commissions/**

### 4.6 Portail client — **ACTIF**
Accès externe du Client : projet, factures, brief, approbations, demandes de
service, questions personnalisées.

Audit du 2026-07-16 : `approval.controller.ts`, `approval.routes.ts` et
`approval.validator.ts` sont bien le contrôleur/routes/validateur réels
consommés par `ApprovalsClientPage.tsx` (`POST /approvals/:id/respond`) mais
n'étaient pas listés dans le `perimetre_code:` — seul `approval.service.ts`
y figurait. Ajoutés ci-dessous pour que le périmètre reflète ce qui est
réellement consommé.

**Correction (AUDIT_GRID.md, 2026-07-17)** : la note ci-dessus affirmait à
tort que `serviceRequest.*` avait déjà « ses 5 couches » dans le
`perimetre_code:` — en réalité seul `serviceRequest.service.ts` y figurait,
exactement le même écart qu'`approval.*` avant sa propre correction. Les 4
fichiers manquants (`serviceRequest.repository.ts`, `.controller.ts`,
`.routes.ts`, `.validator.ts` — réels, actifs, montés indépendamment à
`/api/v1/service-requests`) sont ajoutés ci-dessous.

    perimetre_code:
      - server/src/services/clientPortal.service.ts
      - server/src/repositories/clientPortal.repository.ts
      - server/src/controllers/clientPortal.controller.ts
      - server/src/routes/clientPortal.routes.ts
      - server/src/services/serviceRequest.service.ts
      - server/src/repositories/serviceRequest.repository.ts
      - server/src/controllers/serviceRequest.controller.ts
      - server/src/routes/serviceRequest.routes.ts
      - server/src/validators/serviceRequest.validator.ts
      - server/src/services/approval.service.ts
      - server/src/controllers/approval.controller.ts
      - server/src/routes/approval.routes.ts
      - server/src/validators/approval.validator.ts
      - server/src/services/customQuestion.service.ts
      - server/src/controllers/customQuestion.controller.ts
      - server/src/routes/customQuestion.routes.ts
      - server/src/validators/customQuestion.validator.ts
      - prisma/schema.prisma#ServiceRequest,Approval,CustomQuestion,CustomQuestionMessage
      - client/src/features/client-portal/**
      - client/src/features/approvals/**
      - client/src/features/service-requests/**
      - client/src/features/questions/**

### 4.7 Freelances — **ACTIF**
Recrutement (candidatures), profils, compétences, évaluations. Lecture
directe intégrale des 9 fichiers serveur (session 2026-07-17, ~700 lignes) :
CRUD complet et sain, rédaction correcte des champs sensibles
(`hourlyRate`/`bio`/`email` masqués pour un FREELANCER consultant un autre
profil, jamais exposés à un CLIENT qui n'a de toute façon aucun accès à ces
routes). **La fuite historique de `hourlyRate` mentionnée dans
`plan d'action.md` (audit antérieur, historique) est infirmée par cette
lecture directe** — soit déjà corrigée depuis, soit jamais confirmée sur le
code réel. Aucune anomalie trouvée.

    perimetre_code:
      - server/src/services/freelancer.service.ts
      - server/src/services/freelancerApplication.service.ts
      - server/src/services/rating.service.ts
      - server/src/repositories/freelancer.repository.ts
      - server/src/repositories/freelancerApplication.repository.ts
      - server/src/controllers/freelancer.controller.ts
      - server/src/controllers/freelancerApplication.controller.ts
      - server/src/controllers/rating.controller.ts
      - server/src/routes/freelancer.routes.ts
      - server/src/routes/freelancerApplication.routes.ts
      - server/src/routes/portfolio.routes.ts
      - server/src/routes/rating.routes.ts
      - prisma/schema.prisma#FreelancerProfile,Skill,PortfolioItem,Rating,FreelancerApplication
      - client/src/features/freelancers/**
      - client/src/features/talent/**
      - client/src/features/applications/**

### 4.8 Analytics & Performance — **ACTIF**
Connexions aux sources de données externes et métriques de performance
client. Lecture directe intégrale des 6 fichiers restants
(`executiveMetrics.*`/`revenueForecast.*`, session du 2026-07-17, ~625
lignes), en plus de GscConnection/MetricSnapshot déjà confirmés à l'entité
3.19. Code scopé par pôle/rôle, mis en cache, monté sur des routes réelles.
SEC-024 trouvée et corrigée dans la même passe (voir §7) : 3 des 6 types de
risque déclarés dans `executiveMetrics.repository.ts` ne produisaient
jamais de ligne dans `risks[]`. Aucune autre anomalie.

**Correction (SEC-017, session du 2026-07-17)** : `executiveMetrics.controller.ts`
et `revenueForecast.controller.ts` étaient déjà listés ci-dessous, mais
n'étaient montés sur aucune route — code complet (lecture seule, scopé par
pôle/rôle, mis en cache) jamais exposé. Décision du porteur du projet :
activer plutôt que documenter comme mort. Montés sur
`GET /dashboard/executive-metrics` et `GET /dashboard/revenue-forecast`
(`server/src/routes/dashboard.routes.ts`, ajouté au perimetre_code
ci-dessous), même garde ADMIN/MANAGER + `requirePermission("analytics",
"read")` que `/dashboard/summary`/`/dashboard/full`. Vérifié par exécution
réelle (curl sans token → 401 sur les deux nouvelles routes, 404 sur une
route de contrôle inexistante — confirme un montage réel, pas un faux
positif).

    perimetre_code:
      - server/src/services/gscConnection.service.ts
      - server/src/services/googleOAuth.service.ts
      - server/src/services/searchConsole.service.ts
      - server/src/services/executiveMetrics.service.ts
      - server/src/services/metricAnomaly.service.ts
      - server/src/services/revenueForecast.service.ts
      - server/src/repositories/gscConnection.repository.ts
      - server/src/repositories/metricSnapshot.repository.ts
      - server/src/repositories/executiveMetrics.repository.ts
      - server/src/repositories/revenueForecast.repository.ts
      - server/src/controllers/gscConnection.controller.ts
      - server/src/controllers/executiveMetrics.controller.ts
      - server/src/controllers/metricSnapshot.controller.ts
      - server/src/controllers/revenueForecast.controller.ts
      - server/src/routes/gscConnection.routes.ts
      - server/src/routes/dashboard.routes.ts
      - prisma/schema.prisma#GscConnection,MetricSnapshot
      - client/src/features/analytics/**
      - client/src/features/reports/**

### 4.9 Client Success — **GELÉ**
Suivi de la réussite/santé client.

**Note (AUDIT_GRID.md, 2026-07-17)** : `server/src/jobs/processors/maintenance.processor.ts`
(`recalculateClientScores`, cron quotidien) contient la logique de recalcul
du score — déjà déclaré une seule fois, au §4.13 (`server/src/jobs/**`).
Se référer à 4.13 pour son périmètre exact. Correction documentaire
uniquement (module GELÉ, aucun développement/audit fonctionnel ici).

    perimetre_code:
      - server/src/services/clientSuccess.service.ts
      - server/src/repositories/clientSuccess.repository.ts
      - server/src/controllers/clientSuccess.controller.ts
      - server/src/routes/clientSuccess.routes.ts
      - server/src/validators/clientSuccess.validator.ts
      - prisma/schema.prisma#ClientSuccess,SuccessObjective,SuccessMetric,MetricHistory,SuccessRecommendation,SuccessTimeline
      - client/src/features/client-success/**

### 4.10 RBAC & Permissions granulaires — **ACTIF**
Rôles de base (non concerné — voir §3.2, `code_direct`) + permissions
granulaires par manager au-delà du rôle. Lecture directe intégrale des 8
fichiers serveur (entité 3.21, session 2026-07-17, 411 lignes) plus
`client/src/features/settings/PermissionsGrid.tsx` (session 2026-07-17).
SEC-025 trouvée et corrigée dans la même passe (voir §7) :
`client/src/types/permissions.ts#MODULES` (11 entrées) désynchronisé de
`server/src/services/managerPermission.service.ts#MODULES` (13 entrées) —
`client-success`/`client-onboarding` n'apparaissaient jamais dans la
grille de permissions. Aucune autre anomalie.

    perimetre_code:
      - server/src/services/managerPermission.service.ts
      - server/src/repositories/managerPermission.repository.ts
      - server/src/repositories/permissionProfile.repository.ts
      - server/src/controllers/managerPermission.controller.ts
      - server/src/controllers/permissionProfile.controller.ts
      - server/src/routes/managerPermission.routes.ts
      - server/src/routes/permissionProfile.routes.ts
      - server/src/validators/managerPermission.validator.ts
      - server/src/validators/permissionProfile.validator.ts
      - server/src/middlewares/rbac.middleware.ts
      - prisma/schema.prisma#PermissionProfile,ManagerPermission
      - client/src/types/permissions.ts
      - client/src/features/settings/PermissionsGrid.tsx
      - client/src/features/settings/tabs/SettingsUsersTab.tsx

### 4.11 Module IA (agent-service) — **GELÉ**
Personas IA pour assistance à la production.

    perimetre_code:
      - server/src/agents/personas.ts
      - server/src/services/agentOrchestrator.service.ts
      - server/src/services/llm.client.ts
      - server/src/services/aiConversation.service.ts
      - server/src/repositories/aiConversation.repository.ts
      - server/src/controllers/aiConversation.controller.ts
      - server/src/routes/aiConversation.routes.ts
      - server/src/services/cvExtraction.service.ts
      - server/src/controllers/ai.controller.ts
      - server/test/ai.endpoint.test.ts
      - server/src/config/env.ts
      - prisma/schema.prisma#AiConversation,AiMessage
      - client/src/features/ai-assistant/**

Écart perimetre_code corrigé (AUDIT_GRID.md, 2026-07-17) :
`aiConversation.repository.ts`/`.controller.ts`/`.routes.ts` forment la
totalité de la couche CRUD réelle de `AiConversation`/`AiMessage` (le
persona-orchestrator appelle `aiConversationService.create`, il ne contient
pas lui-même le CRUD) — n'étaient pas listés, seul le service y figurait.
Correction documentaire uniquement (module GELÉ, aucun développement/audit
fonctionnel effectué ici).

### 4.12 Contenu du site public — **ACTIF**
Gestion éditoriale bilingue du site vitrine. Confirmé consommé par le site
public de ce même dépôt (voir §3.23) — pas un build séparé.

    perimetre_code:
      - server/src/services/siteContent.service.ts
      - server/src/repositories/siteContent.repository.ts
      - server/src/controllers/siteContent.controller.ts
      - server/src/routes/siteContent.routes.ts
      - server/src/validators/siteContent.validator.ts
      - prisma/schema.prisma#SiteContent
      - client/src/providers/LandingCmsProvider.tsx
      - client/src/api/siteContent.api.ts
      - client/src/hooks/useSiteContent.ts
      - client/src/features/landing/**
      - client/src/features/settings/tabs/SettingsSiteContentTab.tsx

### 4.13 Notifications & Automatisations — **PARTAGÉ (ACTIF + GELÉ)**
Périmètre scindé en deux, comme arrêté en Q3 :
- **ACTIF** : notifications e-mail transactionnelles du flux argent
  (invitation portail, émission de facture, validation client).
- **GELÉ** : webhooks n8n sortants (automatisations externes).

    perimetre_code:
      - server/src/services/notification.service.ts        # ACTIF
      - server/src/services/email.service.ts                # ACTIF
      - server/src/services/emailTemplates/**                # ACTIF
      - server/src/repositories/notification.repository.ts  # ACTIF
      - server/src/controllers/notification.controller.ts   # ACTIF
      - server/src/routes/notification.routes.ts             # ACTIF
      - docs/n8n-events.md                                    # GELÉ (documentation des webhooks sortants)
      - prisma/schema.prisma#Notification

**`server/src/jobs/**` — ACTIF (composant transverse, lecture directe intégrale
des 8 fichiers, session 2026-07-17). Expiration propositions (`expireProposals`,
cron horaire, confirmé enregistré et déclenché — c'est le mécanisme d'origine
qui empêchait de classer ce répertoire GELÉ), marquage factures en retard
(`markOverdueInvoices`, cron quotidien 4h15), relances échelonnées
(`checkInvoiceFollowup`, cron hebdomadaire lundi 9h), alertes CEO/SLA
(tâches, réunions, leads, commissions, questions, approbations — 8 fonctions
supplémentaires lues intégralement dans `ceoAlerts.processor.ts`), génération
PDF async, e-mails/notifications async. Deux écarts sur les relances facture,
même classe, critères de résolution distincts → SEC-014 (paliers calculés sur
`createdAt` au lieu de `dueDate`) et SEC-015 (aucune relance après passage en
`OVERDUE` — vérifié qu'aucun des 21 jobs ni des 12 fonctions restantes de
`ceoAlerts.processor.ts` ne comble ce trou).

    perimetre_code:
      - server/src/jobs/index.ts
      - server/src/jobs/jobNames.ts
      - server/src/jobs/queues.ts
      - server/src/jobs/redisConnection.ts
      - server/src/jobs/processors/maintenance.processor.ts
      - server/src/jobs/processors/communication.processor.ts
      - server/src/jobs/processors/documents.processor.ts
      - server/src/jobs/processors/ceoAlerts.processor.ts

### 4.14 Authentification & Compte utilisateur — **ACTIF**
Connexion, sessions (access/refresh tokens, familles, révocation),
réinitialisation de mot de passe, gestion du compte utilisateur (profil,
changement d'email différé, invitation, changement de rôle, suppression).
Cité par SEC-006/SEC-009/SEC-011 et RG-019 depuis le 2026-07-16 sans jamais
avoir été formalisé ici — voir §7. Périmètre bâti sur l'audit du 2026-07-16
(27 fichiers lus intégralement).

    perimetre_code:
      - server/src/services/auth.service.ts
      - server/src/services/user.service.ts
      - server/src/repositories/auth.repository.ts
      - server/src/repositories/user.repository.ts
      - server/src/repositories/userSession.repository.ts
      - server/src/services/auditLog.service.ts
      - server/src/controllers/auth.controller.ts
      - server/src/controllers/user.controller.ts
      - server/src/routes/auth.routes.ts
      - server/src/routes/user.routes.ts
      - server/src/validators/auth.validator.ts
      - server/src/validators/user.validator.ts
      - server/src/middlewares/auth.middleware.ts
      - server/src/middlewares/rbac.middleware.ts
      - prisma/schema.prisma#User,UserSession,RefreshToken
      - server/test/auth.service.test.ts
      - server/test/user.service.test.ts
      - server/test/auth.middleware.test.ts
      - server/test/rbac.test.ts
      - server/test/userProfilePhone.http.test.ts
      - client/src/api/users.api.ts
      - client/src/api/auth.api.ts
      - client/src/hooks/useAuth.ts
      - client/src/store/auth.store.ts
      - client/src/types/auth.ts
      - client/src/features/settings/tabs/SettingsProfileTab.tsx
      - client/src/features/client-portal/ClientProfilePage.tsx

---

## 5. Règles métier

Chaque règle porte un statut parmi `IMPLÉMENTÉ` / `PARTIEL` / `PRÉVU` /
`ÉCART` / `[À CONFIRMER]`.

**Nouveau statut ÉCART** : une règle est décidée (l'intention métier est
tranchée, pas un doute), mais le code observé diverge d'elle. Différent de
`PARTIEL` (règle en cours de construction) et de `PRÉVU` (règle non
commencée) : `ÉCART` signifie qu'il existe une décision claire *et* un
comportement réel qui la contredit — c'est un signal d'anomalie, pas
d'avancement.

### Argent, mission, engagement client (section prioritaire)

**RG-001 — Devise unique.**
Toute proposition et toute facture est libellée en TND (dinar tunisien).
*Module : 4.4, 4.1.* Statut : **IMPLÉMENTÉ. `verifie: test`** (session du
2026-07-18, SEC-032) — `Proposal.currency`/`Invoice.currency` ont
`@default("TND")` dans schema.prisma (structure), mais le code applicatif
n'imposait AUCUNE contrainte réelle : `currencyCode`
(`invoice.validator.ts`/`proposal.validator.ts`, deux copies dupliquées)
valait `z.string().length(3).toUpperCase()`, acceptant n'importe quelle
devise à 3 lettres. Aucun filtre de rattrapage côté service. Impact réel
confirmé : `DEFAULT_CURRENCY = "TND"` est déjà utilisée comme filtre dans
les repositories analytics/forecast (module 4.8) — une facture en devise
différente aurait été silencieusement exclue de tous les KPIs financiers.
Une troisième copie identique dans `shared/src/schemas/common.schema.ts`
(consommée par `shared/src/schemas/invoice.schema.ts`/`proposal.schema.ts`,
tous deux du code mort confirmé — zéro import réel dans tout le monorepo,
mais portant le même nom que les vrais validateurs, risque de piège pour
un import futur) a aussi été corrigée par cohérence. `currencyCode` changée
en `z.literal(DEFAULT_CURRENCY)` (serveur) / `z.literal("TND")` (shared,
qui ne peut pas dépendre du serveur). Nouveau test
`server/test/currencyRejectsNonTnd.test.ts`, appelle réellement les vrais
validateurs : rejette USD/EUR, accepte TND explicite et par défaut.

**RG-002 — Rattachement mission → pôle → associé.**
Un `Project` est rattaché à un `Service` (pôle) via `serviceId`. Un Manager
(associé) ne peut créer ou modifier un projet que dans son propre pôle — y
compris via la proposition qui en est à l'origine (un Manager ne peut créer
une proposition pour un Lead assigné à un autre pôle, ni pour un Client déjà
exclusivement lié à un projet d'un autre pôle). *Module : 4.1, 4.2.* Statut :
**IMPLÉMENTÉ. `verifie: test`** (session du 2026-07-18, SEC-028) —
`createProject`/`updateProject` forcent bien `serviceId` au pôle du Manager
(chemin nominal, déjà `code_direct`), MAIS la chaîne remontée jusqu'à
`proposalService.create` (seul point d'entrée réel de création d'une
proposition, donc en amont de tout projet) ne vérifiait AUCUN scope de
pôle — un Manager pouvait créer une proposition sur un client/lead d'un
autre pôle, contournant l'intention de la règle sans violer son texte
littéral sur `Project`. Corrigé : nouvelle fonction
`assertProposalCreationInScope` dans `proposal.service.ts`, appliquée à
`create()` — `Lead.serviceId` vérifié directement, `Client` (sans pôle
propre — un même client peut avoir des projets dans plusieurs pôles)
scopé via l'ensemble des `serviceId` distincts de ses projets existants
(neutre si aucun projet, autorisé si au moins un projet dans le pôle du
Manager, rejeté si exclusivement lié à un autre pôle). Nouveau test
`server/test/proposalCreationScope.test.ts`, appelle réellement
`proposalService.create` contre une base migrée sur 5 cas (Lead autre
pôle rejeté, Lead même pôle autorisé, Client autre pôle exclusif rejeté,
Client neuf autorisé, ADMIN toujours autorisé). Voir SEC-028.

**RG-003 — TVA fixe.**
Le taux de TVA appliqué aux factures d'acompte et de solde est fixe à 19%
(`TVA_RATE`). *Module : 4.4.* Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`server/src/utils/vat.ts`, intégral, session précédente).

**RG-004a — Facture d'acompte à l'acceptation.**
À l'acceptation d'une proposition, une facture d'acompte est générée pour
30% du montant de la proposition. *Module : 4.4, 4.1.* Statut : IMPLÉMENTÉ.
`verifie: code_direct` (`proposal.service.ts` ligne 377, `acceptWithCascade`,
session précédente).

**RG-004b — Facture de solde à la validation client.**
À la validation finale du client, une facture de solde est générée pour le
complément (70% de la proposition). *Module : 4.4, 4.2, 4.6.* Statut :
**IMPLÉMENTÉ. `verifie: test`** (session du 2026-07-18, SEC-030) —
`project.service.ts#clientApprove` lu ligne par ligne (306-308) : la
formule réelle est un COMPLÉMENT À 100%
(`balanceAmount = proposalAmount - depositAmount`, où `depositAmount` est
le montant réellement facturé sur l'acompte, pas un 30% recalculé à
l'aveugle), pas un recalcul indépendant fixe à 70% comme le texte littéral
pourrait le laisser penser — comportement plus robuste : acompte + solde
totalisent toujours exactement le montant de la proposition, quel que soit
le montant réellement facturé pour l'acompte. Nouveau test
`server/test/projectClientApproveBalanceInvoice.test.ts`, appelle
réellement `clientApprove` contre une base migrée : cas nominal (acompte
300/1000 → solde 700) et cas où l'acompte dévie du taux attendu (acompte
400/1000 → solde 600, pas 700, confirmant le complément plutôt qu'un
recalcul fixe). Les 3 tests existants touchant `clientApprove`
réimplémentaient tous une logique-miroir locale, aucun n'appelait le vrai
service ni n'assérait le montant du solde.

**RG-005 — Partage associé par défaut (cible métier).**
La répartition par défaut d'une commission de mission est **60% pour le
CEO** (apporteur d'affaires/décideur) et **40% pour l'associé exécutant**,
évolutive vers **50%/50%** selon des critères métier (ancienneté,
performance, décision). *Module : 4.5.* Statut : **PRÉVU** — le calcul
automatique de ce défaut n'est pas implémenté ; le système actuel exige une
saisie manuelle du pourcentage par mission (RG-006). `verifie: document`
— source : réponse du porteur du projet, session du 2026-07-15 (« Le
référentiel doit retenir 60% CEO / 40% Associé, avec une évolution possible
vers 50%/50% »), recoupée par un extrait de `Secritou_Cadrage.docx` §7.2
obtenu via un contournement d'extraction non revérifié directement par moi
(voir §7 pour la nuance de sourcing complète).

**RG-006 — Rémunération à la mission (état implémenté).**
Chaque mission (`Project`) porte une ou plusieurs répartitions de commission
(`ProjectCommissionSplit`), saisies manuellement par associé avec un
`ratePct` (chaque taux `> 0`, somme des taux d'un même projet `≤ 100`, un
seul enregistrement par couple projet/associé). *Module : 4.5.* Statut :
IMPLÉMENTÉ. `verifie: code_direct` (`commission.service.ts`, intégral).

**RG-007 — Base de calcul de la commission.**
La commission due est calculée sur le **montant brut réellement encaissé**
pour chaque paiement (`basis = montant du paiement`,
`commission = basis × ratePct / 100`), sans déduction de coûts directs.
*Module : 4.5.* Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`commission.service.ts`, intégral). *Note d'évolution : un calcul sur la
marge nette après coûts directs est une évolution métier envisagée mais non
implémentée à ce jour — réponse du porteur du projet, session du
2026-07-15.*

**RG-008 — Déclenchement de la commission.**
Une ligne de commission est créée uniquement lorsqu'un paiement (`Payment`)
est effectivement enregistré ET réellement appliqué à une facture (montant
> 0 après déduction d'un éventuel trop-perçu). *Module : 4.5, 4.4.* Statut :
**IMPLÉMENTÉ. `verifie: test`** (session du 2026-07-17, SEC-027) —
`commission.repository.ts` grep confirmé : un seul point d'écriture
`tx.commission.create` dans tout `server/src`, exclusivement via
`createManyTx` ← `computeForPaymentTx` ← `invoice.service.ts#addPayment`
(aucun autre appelant de `computeForPaymentTx` dans le dépôt). Nouveau test
`server/test/commissionCreationExclusivity.test.ts`, appelle réellement
`invoiceService.addPayment` contre une base migrée : (1) un paiement réel
crée bien une `Commission` par partenaire, proratisée sur le montant
appliqué ; (2) un paiement entièrement absorbé par un trop-perçu
(`appliedAmount = 0`) n'en crée aucune — l'exclusivité porte donc sur le
montant réellement appliqué, pas la simple existence d'un `Payment`.
Contrainte structurelle en renfort : `Commission.paymentId` est
`@unique` (schema.prisma) — au plus une commission par paiement, garanti
par la base, pas seulement par la logique applicative.

**RG-009 — Cycle de vie du paiement de commission.**
Une commission naît au statut `PENDING`. Le passage à `PAID` est une action
manuelle, réservée à un Admin, non rejouable si déjà payée. Aucune
intégration bancaire n'effectue ce paiement. *Module : 4.5.* Statut :
IMPLÉMENTÉ. `verifie: code_direct` (`commission.service.ts`, intégral).

**RG-010 — Cascade d'acceptation de proposition.**
L'acceptation d'une proposition par un client déclenche, dans une seule
transaction : passage du lead lié à `WON` (le cas échéant), liaison au
client existant, création du projet si nécessaire (idempotente), création
de la facture d'acompte à 30%. *Module : 4.1, 4.2, 4.4.* Statut :
IMPLÉMENTÉ. `verifie: code_direct` (`proposal.service.ts` lignes 306-465,
session précédente).

**RG-011 — Visibilité des commissions par associé.**
Un Manager ne peut consulter que ses propres répartitions et commissions.
*Module : 4.5, 4.10.* Statut : IMPLÉMENTÉ. `verifie: test`
(`analyticsCommissionScope.test.ts`, intégral, session précédente) — **cas
exemplaire de règle négative correctement établie : un test assère
explicitement le refus, pas seulement le chemin nominal.**

**RG-012 — Numérotation des factures.**
Les factures sont numérotées séquentiellement par mois, sans trou
(`INV-YYYYMM-NNNN`), le compteur étant incrémenté dans la même transaction
que la création de la facture. *Module : 4.4.* Statut : **IMPLÉMENTÉ.
`verifie: test`** (session du 2026-07-18, SEC-031) — `nextInvoiceNumber`
lu intégralement : `upsert` atomique sur `InvoiceCounter` (`increment: 1`),
toujours dans la même transaction Prisma que la création de la facture
(un échec de création annule aussi l'incrémentation, rollback complet,
pas de trou possible par ce chemin) ; suppression de facture confirmée
être un soft-delete (`deletedAt`), jamais physique. **SEC-031 trouvée et
corrigée dans la même passe** : `invoiceService.create`/
`createInvoiceSchema` acceptaient un `number` optionnel fourni par
l'appelant (`POST /invoices`, réservé ADMIN) qui contournait entièrement
le compteur — seul garde-fou : la contrainte `@unique` (empêche un
doublon exact, pas un trou ni une collision future avec un numéro
auto-généré). Champ `number` retiré du validateur et du type d'entrée du
service ; `invoiceService.create` appelle désormais inconditionnellement
`createInvoiceWithGeneratedNumber`. Nouveau test
`server/test/invoiceNumberingGapless.test.ts`, appelle réellement le
service contre une base migrée : séquence strictement consécutive sur 2
créations, et un `number` injecté dans l'entrée brute est strippé par le
vrai validateur Zod puis ignoré par le service.

**RG-013 — Clôture de mission par le client.**
Un projet ne peut passer au statut `COMPLETED` que via l'action explicite de
validation finale du Client (`clientApprove`). *Module : 4.2, 4.6.* Statut :
**IMPLÉMENTÉ**, `verifie: test` — server/src/services/project.service.ts:97-101
(`updateProject` rejette explicitement `status: "COMPLETED"` avec
`HttpError(422, ..., "COMPLETION_REQUIRES_CLIENT_APPROVAL")`, lu intégralement,
session du 2026-07-16, audit 4.6) et
server/test/projectUpdateBlocksCompletion.test.ts (« projectService.updateProject
blocks COMPLETED (RG-013) », 2 tests appelant réellement `updateProject` :
rejet depuis `REVIEW`, rejet depuis `IN_PROGRESS` malgré une transition qui
serait sinon valide). Un test antérieur existait déjà
(server/test/project.clientApprove.test.ts) mais réimplémentait la logique de
garde dans une fonction locale sans jamais importer `project.service.ts` —
il ne valait que `code_grep` sous la règle sur `verifie: test` (voir §3) ;
conservé tel quel (il couvre un chemin distinct, les garde-fous internes de
`clientApprove` lui-même), complété par le nouveau fichier pour la règle
d'exclusivité proprement dite. Sortie citée : `tests 247 / pass 247 / fail 0`,
exécuté deux fois de suite, ~5-6s (baseline), typecheck 0 erreur.

### Autres règles

**RG-014 — Vérification de rôle avant action IA.**
Toute action du module agent-service vérifie le rôle de l'utilisateur avant
exécution ; seuls Admin et Manager peuvent déclencher un persona IA.
*Module : 4.11 (GELÉ).* Statut : IMPLÉMENTÉ. `verifie: code_direct`
(`agentOrchestrator.service.ts` lignes 90-92, `ai.endpoint.test.ts`,
intégral).

**RG-015 — Fournisseur du module IA (état implémenté).**
Le module agent-service appelle un modèle **Ollama (Mistral)**
auto-hébergé. *Module : 4.11 (GELÉ).* Statut : IMPLÉMENTÉ. `verifie:
code_direct` (`llm.client.ts` intégral, `env.ts` grep ciblé).

**RG-016 — Exécution de code toujours sandboxée.**
Toute exécution de code (agent IA de génération de prototype) doit être
sandboxée (Docker), jamais d'exécution directe sur l'hôte. *Module : 4.11
(GELÉ).* Statut : **PRÉVU** — fonctionnalité non commencée, aucune trace de
sandboxing dans le code. `verifie: code_direct` (grep exhaustif sur
`server/src`, zéro résultat).

**RG-017 — Aucun accès Client aux outils d'exécution.**
Le rôle Client ne doit jamais avoir accès à des outils d'exécution de
commande, y compris via le module IA. *Module : 4.11 (GELÉ), 4.10 (ACTIF,
sans rapport avec cette règle).* Statut : **IMPLÉMENTÉ. `verifie: test`**
(session du 2026-07-18, SEC-029, module 4.11 dégelé explicitement pour
cette seule vérification, sur décision du porteur du projet, puis regelé
immédiatement — aucune correction fonctionnelle, aucune nouvelle capacité).
Le statut IMPLÉMENTÉ affirmé en v0.2.0 (« garanti par RG-014 ») était une
**déduction** (absence d'outil d'exécution combinée à un contrôle de rôle
ailleurs), jamais une observation directe. Corrigé par vérification réelle,
sans dépendance conditionnelle à RG-016 : `ai.routes.ts`/
`aiConversation.routes.ts` gardent explicitement `authorize("ADMIN",
"MANAGER")` sur chaque route (jamais CLIENT) ; `agentOrchestratorService
.executeAgent` (le service métier réel, pas seulement le middleware)
revérifie lui-même le rôle et rejette tout appelant hors ADMIN/MANAGER,
même un appel interne qui aurait oublié le middleware ; grep exhaustif sur
tout `server/src` confirme l'absence de toute primitive
`child_process`/`execSync`/`spawn`/`eval` — la base de RG-016 (aucun
sandboxing car aucune exécution n'existe) est désormais un fait vérifié
directement, pas seulement supposé. Nouveau test
`server/test/aiExecutionAccessClient.test.ts`, appelle réellement
`executeAgent` avec un rôle CLIENT (et FREELANCER) et confirme le rejet
403, plus un scan direct des primitives d'exécution. Aucun défaut trouvé.

**RG-018 — Activation du portail client au paiement de l'acompte.**
Le portail client s'active (invitation du compte, `Client.portalActivatedAt`
renseigné) uniquement lorsque la facture d'acompte passe au statut `PAID` —
jamais à la simple acceptation de la proposition. *Module : 4.6, 4.4.*
Statut : **ÉCART**. `verifie: document` — la règle elle-même provient de
`Secritou_CahierDesCharges_Site.docx` §2/§4.2 (historique : « paiement de la
1re tranche = ouverture de l'espace client »). **Le comportement réel
observé dans le code (session précédente, `acceptWithCascade`, invitation
envoyée à l'acceptation, avant tout paiement) diverge de cette règle — voir
SEC-002 pour le détail du constat et sa provenance exacte (non revérifié
directement sur le code de cette session, `confiance: a_confirmer` dans
ANOMALIES.yaml).**

**RG-019 — Révocation de session sur changement de rôle uniquement.**
`userService.updateUser` révoque toutes les sessions actives (tous les
refresh tokens, toutes familles confondues) de l'utilisateur ciblé
si et seulement si son `role` change (`role && role !== user.role`).
Un changement de `name` seul (ou tout autre champ modifiable par cet
endpoint) ne déclenche aucune révocation. *Module : 4.14.* Statut :
**IMPLÉMENTÉ**, `verifie: test` — server/src/services/user.service.ts:163
(condition exacte lue directement) et server/test/user.service.test.ts
(réécrit session du 2026-07-16 : importe et appelle réellement
`userService.updateUser`, mocks au niveau module/prototype sur
`userRepository`/`AuthRepository.prototype.revokeAllSessionsForUser`/
`auditLogService`, 3 tests couvrant changement de rôle → révocation,
changement de nom seul → aucune révocation, rôle fourni mais inchangé →
aucune révocation). Sortie citée : `tests 237 / pass 237 / fail 0`,
typecheck 0 erreur. RÉTROGRADÉ PUIS RECONFIRMÉ (session du 2026-07-16,
audit 4.14, Constat F) : la version précédente du test réimplémentait
`shouldRevokeSessions` en recopiant la condition source en commentaire,
sans jamais importer ni appeler le code réel — retrogradé à
`[À CONFIRMER]`/`code_direct` le temps de la réécriture, reconfirmé
`IMPLÉMENTÉ`/`test` une fois le nouveau test vert contre le code réel. Voir
SEC-009 (`en_cours`, pas `resolu` — correction du 2026-07-16 :
REFERENTIEL.md citait à tort `resolu`, ANOMALIES.yaml fait foi) : la
révocation était inopérante depuis l'introduction de l'intention (commit
eb93f08, 2026-07-11) jusqu'à la session du 2026-07-16, l'appel visant une
méthode qui n'existait sur aucun repository.

**RG-020 — Timeout d'inactivité de session (heartbeat).**
Une session de connexion au back-office est prolongée par un heartbeat reçu
dans les `SESSION_IDLE_TIMEOUT_MINUTES` (= 3) suivant le dernier heartbeat
enregistré ; passé ce délai, un nouveau heartbeat ouvre une nouvelle session
plutôt que d'étendre l'ancienne, et la session précédente est considérée
périmée (`closeStaleSessions`, qui fixe `closedAt` au dernier
`lastHeartbeatAt` connu). *Module : 4.14.* Statut : **`[À CONFIRMER]`**,
`verifie: code_direct` — server/src/repositories/userSession.repository.ts:6
(constante), :8-33 (`recordHeartbeat`), :35-46 (`closeStaleSessions`),
lecture intégrale, session du 2026-07-16 (audit 4.14, Constat B). Le seuil
de 3 minutes n'a aucune source dans REFERENTIEL.md ni dans un document de
cadrage — vit uniquement dans le code, sans validation produit connue.

**RG-021 — Protection du dernier Admin.**
`userService.updateUser` refuse (409, code `LAST_ADMIN`) de retirer le rôle
ADMIN d'un utilisateur si c'est le dernier compte ADMIN du système ; de même,
`userService.deleteUser` refuse (409, `LAST_ADMIN`) de supprimer le dernier
compte ADMIN. *Module : 4.14.* Statut : **IMPLÉMENTÉ**, `verifie: test` —
server/src/services/user.service.ts:156-159 (`updateUser`) et :177-180
(`deleteUser`), et server/test/user.service.test.ts (« userService
last-Admin protection (RG-021) », 5 tests : retrait de rôle du dernier
Admin → 409 LAST_ADMIN ; changement de rôle autorisé si d'autres Admins
existent ; suppression du dernier Admin → 409 LAST_ADMIN (et `delete`
jamais appelé) ; suppression autorisée si d'autres Admins existent ;
suppression d'un non-Admin ne vérifie jamais le nombre d'Admins), session
du 2026-07-16 (audit 4.14, Constat H). Sortie citée : `tests 242 / pass 242
/ fail 0`, exécuté deux fois de suite pour écarter l'intermittence,
typecheck 0 erreur.

---

## 6. Hors périmètre — liste unique (fusion de l'ancien §1/§6)

Classification à 3 états, cohérente avec §4. Un module `GELÉ` n'est pas
« hors périmètre » : le code existe, tourne, et sert potentiellement des
utilisateurs — il est seulement exclu de tout développement et audit tant
que ce statut n'est pas rediscuté (voir §7 pour l'arbitrage et CLAUDE.md
pour la conséquence opérationnelle sur les audits).

| Sujet | Statut | Pourquoi |
|---|---|---|
| 4.7 Freelances | ACTIF | Lecture directe intégrale (9 fichiers, session 2026-07-17), aucune anomalie — décision du porteur du projet. |
| 4.8 Analytics & Performance | ACTIF | Lecture directe intégrale (6 fichiers restants, session 2026-07-17, en plus de l'entité 3.19 déjà lue), SEC-024 trouvée et corrigée, aucune autre anomalie — décision du porteur du projet. |
| 4.9 Client Success | GELÉ | Couverture `partiel` (au moins un document direct exploité) ; calcul partiellement automatisé seulement, 0 client actif pour l'alimenter. |
| 4.10 RBAC & Permissions granulaires | ACTIF | Lecture directe intégrale (entité 3.21 + PermissionsGrid.tsx, session 2026-07-17), SEC-025 trouvée et corrigée, aucune autre anomalie — décision du porteur du projet. |
| 4.11 Module IA (agent-service) | GELÉ | Couverture `lu` (complète) — deux personas existants conservés tels quels ; pas de développement supplémentaire pour l'instant. |
| 4.13 (volet webhooks n8n) | GELÉ | Automatisations externes existantes, non prioritaires hors flux argent. |
| `server/src/jobs/**` (composant transverse de 4.13) | ACTIF | Couverture `lu` (8 fichiers, intégral, session 2026-07-17) ; relances facture défectueuses → SEC-014 (calcul de date) et SEC-015 (aucune relance après OVERDUE). |
| Intégration bancaire / paiement en ligne (Flouci, Konnect, Paymee, e-Dinar) | HORS PÉRIMÈTRE (phase 2) | Aucune passerelle implémentée ; paiements saisis manuellement. |
| Modèle d'abonnement / mission récurrente | HORS PÉRIMÈTRE (phase 2) | L'agence facture en mission ponctuelle par tranches au lancement ; le récurrent est une phase 2 non modélisée. |
| Exécution de code en sandbox par un agent IA | HORS PÉRIMÈTRE (phase 2) | Objectif documenté (RG-016) mais non commencé — aucune infrastructure Docker de sandboxing trouvée dans le code. |
| Segments commerciaux « Entreprise & Startup » / « Commerce & Marque » comme données structurées | HORS PÉRIMÈTRE (phase 2) | Existent uniquement comme discours marketing/stratégie ; aucun enum, champ ou table ne les représente. |
| Architecture multi-tenant | **REJETÉ** | Cible arrêtée : outil interne mono-tenant, de façon définitive — pas une question à reconsidérer en phase 2. Voir §7 et SEC-004. |

---

## 7. Journal des décisions

| Date | Décision | Raison / Source |
|---|---|---|
| 2026-07-15 | Le référentiel documente le SI **cible** en cours de pivot vers le contexte agence tunisienne, et non l'ancien contexte générique du CLAUDE.md précédent. | Le code (seed, schéma, services) implémente déjà très largement ce contexte. |
| 2026-07-15 | Les 4 rôles réellement implémentés sont documentés comme référence, avec note sur l'absence du rôle Freelancer dans le CDC historique. | Réponse du porteur du projet, session du 2026-07-15. |
| 2026-07-15 | Le modèle `Contract` est documenté comme IMPLÉMENTÉ, contredisant un audit antérieur qui le disait inutilisé. | Vérification directe du code (`clientOnboarding.repository.ts`, `.controller.ts`, `.routes.ts`), session du 2026-07-15. |
| **2026-07-16** | **RG-005 fixé à 60% CEO / 40% associé → 50/50 (le 70/30 initial est écarté, sans source dans le dépôt).** | **Réponse du porteur du projet, session du 2026-07-16, en réponse directe à Q1. Nuance de sourcing : cette réponse est la source primaire ; un extrait de `Secritou_Cadrage.docx` §7.2 rapportant la même chose avait été cité en v0.1.0, obtenu via une extraction PowerShell non revérifiée directement par moi — je ne peux pas certifier ce second point comme `code_direct`, seulement comme `document`.** |
| **2026-07-16** | **Cible confirmée : outil interne MONO-TENANT. `Company` reste un singleton strict, aucun `companyId`/`tenantId` n'est introduit.** | **Réponse du porteur du projet, session du 2026-07-16, après vérification factuelle du code (`schema.prisma` intégral : aucun champ tenant ; `server/src/middlewares/` listé : aucun fichier `tenant.middleware.ts`) présentée en Q2. Voir SEC-004.** |
| **2026-07-16** | **Répartition ACTIF / GELÉ / HORS PÉRIMÈTRE arrêtée pour les 13 modules (§4, §6), y compris le cas 4.12 (Contenu du site) tranché ACTIF après vérification.** | **Réponse du porteur du projet, session du 2026-07-16 (Q3), amendant ma proposition initiale. Vérification bloquante sur 4.12 : `LandingCmsProvider.tsx` lu (lignes 1-40) confirme que le site public de ce dépôt consomme réellement `SiteContent` — pas de build séparé.** |
| **2026-07-16** | **Introduction du statut de règle ÉCART ; RG-018 réécrite en règle affirmative et testable, statut ÉCART, renvoyant à SEC-002.** | **Instruction du porteur du projet, session du 2026-07-16 (C4) : les statuts existants ne permettaient pas d'exprimer « règle décidée, code divergent ».** |
| **2026-07-16** | **Tous les statuts d'entité/module non adossés à une lecture de code directe cette session ou la précédente sont rétrogradés en `[À CONFIRMER]`, quelle que soit leur plausibilité antérieure ; ajout du champ `verifie:` à chaque entité et module.** | **Instruction du porteur du projet, session du 2026-07-16 : un statut `IMPLÉMENTÉ` non vérifié directement sur le code est du ouï-dire présenté comme source de vérité — inacceptable. Conséquence directe du tableau de couverture d'EXPLORATION.md.** |
| **2026-07-16** | **Entité 3.24 AuditLog : statut relevé de `[À CONFIRMER]` à PARTIEL, `verifie: code_direct` — le modèle est bien appelé par 3 services, contredisant un audit antérieur qui le disait potentiellement absent.** | **Grep direct effectué session du 2026-07-16 sur `server/src` : `auditLog.service.ts` appelé depuis `project.service.ts`, `task.service.ts`, `user.service.ts`.** |
| **2026-07-16** | **Les 4 fichiers d'audit non ouverts (`11`, `12`, `14`, `15`), `plan d'action.md` et `round5-report.md` sont déclarés `historique` (§0) : citables comme piste dans PISTES.md, jamais comme source de vérité dans REFERENTIEL.md ou ANOMALIES.yaml.** | **Instruction du porteur du projet, session du 2026-07-16 (C5) : un audit antérieur est une hypothèse produite par un LLM sur un périmètre inconnu, pas une preuve.** |
| **2026-07-16 (v0.2.1)** | **SEC-006 (`phone` sur `updateMe`) vérifié par lecture intégrale ligne par ligne du chemin complet (`users.api.ts` → `user.routes.ts` → `user.validator.ts` → `user.controller.ts` → `user.service.ts` → `user.repository.ts`), pas par grep.** | **Instruction du porteur du projet, session du 2026-07-16 : le gate SEC-006 avait été sauté dans la livraison précédente (affirmation factuelle non sourcée en §3.2). Correction du chemin de lecture uniquement — la gravité elle-même n'a pas été soumise pour validation avant cette livraison ; voir ANOMALIES.yaml SEC-006 pour son statut réel de vérification, en cours de reprise (session du 2026-07-16, correction v0.2.2).** |
| **2026-07-16 (v0.2.1)** | **Ajout des valeurs `code_grep` et `test` à `verifie:` ; règle des affirmations négatives (une interdiction/exclusivité exige `verifie: test`, pas `code_grep` ni la seule lecture du chemin nominal) ; distinction `schema_seul` (comportement) vs `code_direct` (structure) sur les citations de `schema.prisma`. Appliqué à RG-001, RG-002, RG-008, RG-011 (reste IMPLÉMENTÉ, seul le libellé passe à `verifie: test`), RG-013, RG-017.** | **Instruction du porteur du projet, session du 2026-07-16 : incohérence relevée entre la convention `partiel` d'EXPLORATION.md pour un simple grep et le `verifie: code_direct` attribué à plusieurs RG sur la même base.** |
| **2026-07-16 (v0.2.1)** | **RG-004 scindée en RG-004a (acompte 30%, IMPLÉMENTÉ) et RG-004b (solde 70%, `[À CONFIRMER]`) — une règle ne porte plus deux affirmations à statut différent.** | **Instruction du porteur du projet, session du 2026-07-16 : contradiction relevée entre le texte de RG-004 v0.2.0 (« moitié code_direct, moitié À CONFIRMER ») et sa propre règle stricte sur la provenance des statuts.** |
| **2026-07-16 (v0.2.1)** | **4.7 Freelances, 4.8 Analytics & Performance, 4.10 RBAC & Permissions granulaires reclassés de GELÉ à `[À CONFIRMER — non trié]` ; `server/src/jobs/**` retiré du bloc GELÉ de 4.13 et classé `[À CONFIRMER — non trié, priorité d'exploration]`.** | **Instruction et arbitrage du porteur du projet, session du 2026-07-16 : EXPLORATION.md les marque `non exploré` — un module/répertoire jamais ouvert ne peut être classé GELÉ (le gel doit réduire la surface d'audit, pas y créer un angle mort sur le flux argent, notamment pour `jobs/**` qui porte potentiellement l'expiration des propositions et les relances de facture).** |
| **2026-07-16 (v0.2.1)** | **§2 : « Cible » repasse d'`[À CONFIRMER]` à une absence vérifiée (concept confirmé non modélisé, classé HORS PÉRIMÈTRE). §6 : « Architecture multi-tenant » repasse de « HORS PÉRIMÈTRE (phase 2) » à REJETÉ.** | **Instruction du porteur du projet, session du 2026-07-16 : rétrogradation mécanique appliquée à tort — une absence vérifiée est un fait, pas un doute ; et l'arbitrage Q2 était une décision définitive (mono-tenant), pas un report à une phase future.** |
| **2026-07-16** | **Cause racine identifiée à l'origine des constats divergents entre audits : chaque session Claude Code démarre sans mémoire des précédentes, sur un working tree non commité qu'elle n'a pas écrit. Elle redécouvre, renomme et contredit — d'où les mêmes défauts identifiés deux fois sous deux formulations. Le socle documentaire (REFERENTIEL/ANOMALIES/CLAUDE.md) porte la mémoire des décisions ; `git commit` porte la mémoire des actes. Les deux sont nécessaires.** | **Précision du porteur du projet, session du 2026-07-16.** |
| **2026-07-16** | **La fenêtre de grâce de 30 s sur les refresh tokens révoqués (`REFRESH_REUSE_GRACE_MS`) est REVERTÉE — supprimée de `server/src/services/auth.service.ts`, retour au comportement strict (tout token révoqué rejoué tue la famille). Voir SEC-011, `resolu`.** | **Décision du porteur du projet, session du 2026-07-16 (GATE 3), exécutée : critère de résolution atteint (test d'origine vert sans modification, 234/234, typecheck 0).** |
| **2026-07-16** | **SEC-009 : la capacité de révocation de session sur changement de rôle est CONSERVÉE (pas de retrait de l'appel), formalisée en RG-019, `verifie: test`. `updateUser` révoque via `authRepository.revokeAllSessionsForUser`, uniquement si `role` change, jamais sur un changement de `name` seul. Correctif écrit et testé, test dédié ajouté (server/test/user.service.test.ts), 237/237 verts, typecheck 0.** | **Décision du porteur du projet, session du 2026-07-16 (GATE 4), exécutée.** |
| **2026-07-16** | **SEC-009 et SEC-011 repassées de `resolu` à `en_cours` : un correctif non commité n'est pas résolu, quel que soit le résultat local du typecheck/tests. Règle ajoutée à ANOMALIES.yaml (schéma) et CLAUDE.md : `resolu` exige commit + CI verte sur ce commit, pas seulement un working tree vert en local — sinon le correctif a la même espérance de vie qu'un défaut non commité (la fenêtre de grâce SEC-011 a survécu des jours précisément pour cette raison).** | **Correction du porteur du projet, session du 2026-07-16, après le commit snapshot ff181d7 (GATE 1/2) : les gates 1 et 2 avaient été déclarés fermés sans rapport de hash/EXIT codes, et les correctifs SEC-009/011 déclarés `resolu` alors qu'ils vivaient dans un working tree non commité, jamais vus par la CI.** |
| **2026-07-16** | **SEC-010 reformulée : défaut de PROCESSUS (les correctifs de cette session n'ont jamais été poussés vers origin/main, donc jamais vus par une CI par ailleurs correcte), pas défaut d'OUTILLAGE (le workflow ci.yml lui-même n'est pas en cause). `git log origin/main` confirmait `origin/main` à 3 commits derrière HEAD local au moment de la vérification.** | **Instruction du porteur du projet, session du 2026-07-16 : `git log origin/main --oneline -1` et `git status -sb` suffisent à trancher, sans avoir besoin de checkouter quoi que ce soit.** |
| **2026-07-16** | **Confirmé : aucun workflow de déploiement (Vercel/Railway/Render/Fly) n'existe dans `.github/workflows/` — seuls `ci.yml` (lint/typecheck/test/build/schema-drift/restore-smoke-test) et `backup.yml` (sauvegarde, sans lien avec un environnement de production) sont présents. Un push vers `origin/main` ne déclenche donc aucun déploiement, seulement la CI.** | **Vérification directe demandée par le porteur du projet avant tout push, session du 2026-07-16 : `ls .github/workflows/` (2 fichiers) et lecture des correspondances "deploy" (fausses pistes : commentaire d'exemple SSH, `/tmp/deploy_key`, et `prisma migrate deploy` — la sous-commande Prisma, pas un déploiement applicatif).** |
| **2026-07-16** | **SEC-012 : critère de résolution corrigé — porte sur la chaîne entière (validateurs → controllers → services → repositories), pas seulement `server/src/repositories/**`. Les 17 méthodes de repository ont été reconverties vers la variante `Unchecked` par défaut (`Prisma.<Model>UncheckedUpdateInput`), jamais `connect`, sauf écriture de relation imbriquée déjà réelle dans le code.** | **Décision du porteur du projet, session du 2026-07-16 : TypeScript ne vérifie les propriétés en excès que sur les littéraux frais, jamais sur les variables — un repository seul ne suffit pas si l'appelant garde son propre type maison.** |
| **2026-07-16** | **`phone` : la chaîne complète remontée jusqu'au premier littéral frais (server/src/controllers/user.controller.ts:21), qui a fini par produire l'erreur tsc attendue une fois `userService.updateMe` lui-même converti. Décision : `phone` EST un champ voulu sur `User` (cohérent avec Client/Lead/FreelancerApplication) — migration `20260716120000_add_phone_to_user` appliquée, `User.phone String? @db.VarChar(50)`. typecheck vert, 237/237 tests verts.** | **Décision du porteur du projet, session du 2026-07-16 : décision produit explicitement demandée avant toute correction — pas déduite du typage.** |
| **2026-07-16** | **Face à un blocage (`git switch -c` refusé), une cause plausible non vérifiée (« hook du dépôt ») a été présentée comme un fait au lieu de dire « je n'ai pas la permission ». Règle ajoutée à CLAUDE.md : signaler le blocage tel quel, ne jamais l'expliquer par une supposition, ne jamais contourner sans le dire.** | **Correction du porteur du projet, session du 2026-07-16 : aucun hook git ne peut techniquement bloquer `git switch -c` — c'était une restriction de permissions de l'outil, pas un mécanisme du dépôt. Pas de SEC-013 : il n'y a aucun hook cassé dans le dépôt, la faute est dans le compte-rendu, pas dans le code.** |
| **2026-07-16** | **`phone` est ajouté au modèle `User` (migration `20260716120000_add_phone_to_user`) plutôt que retiré de la chaîne API. Usage confirmé par lecture directe : `client/src/features/client-portal/ClientProfilePage.tsx` (champ "Téléphone" rendu, ligne 188, `profileSchema` ligne 35) — le portail Client permet à l'utilisateur de rôle Client de renseigner un numéro de contact sur son PROPRE compte `User`, via `PATCH /users/me`. Distinct de `Client.phone` (schema.prisma:300), qui porte le numéro de la fiche Client/entreprise elle-même, renseigné par un Admin/Manager à la création du compte — pas celui de l'utilisateur qui se connecte. `SettingsProfileTab.tsx` (profil Admin/Manager/Freelancer) n'a pas de champ phone dans son formulaire ; seul le portail Client l'utilise actuellement.** | **Décision produit du porteur du projet, session Claude Code du 2026-07-16, en réponse au rapport d'erreur tsc sur `user.controller.ts:21` : arbitrage entre les deux réparations possibles (conformer le code au schéma / conformer le schéma au code) — le porteur a retenu la seconde.** |
| **2026-07-16** | **Module `4.14 Authentification & Compte utilisateur` formalisé en §4 (ACTIF, `perimetre_code:` sur 27 fichiers) et en EXPLORATION.md (couverture `lu`). Le module existait dans le code et était cité par SEC-006/SEC-009/SEC-011 et RG-019 depuis le 2026-07-16 sans jamais figurer au référentiel — une session ultérieure aurait dérivé un périmètre différent du mien, rendant les deux audits incomparables.** | **Instruction du porteur du projet, session du 2026-07-16 (audit 4.14) : la liste de fichiers de l'audit devient le `perimetre_code:` officiel, pour que l'audit soit rejouable.** |
| **2026-07-16** | **SEC-006 rouverte (`ouvert`, gravité `majeur`) : le critère de résolution qui l'avait fait passer `en_cours` (« PATCH /users/me avec phone ne provoque plus d'erreur ») testait l'absence d'un symptôme (le 500), pas la présence de la fonction. `phone` est bien persisté depuis la migration, mais jamais relu par l'API, jamais pré-rempli dans le formulaire du portail Client, et jamais effaçable une fois enregistré (`data.phone \|\| undefined` transforme une chaîne vide en `undefined`, que Prisma omet de l'UPDATE). Nouveau critère : écriture-puis-relecture-puis-suppression, vérifié par un test d'intégration.** | **Correction du porteur du projet, session du 2026-07-16 (audit 4.14, Constat C) : un critère de résolution qui teste seulement l'absence d'erreur peut se satisfaire d'une fonctionnalité qui ne marche toujours pas — passée d'un échec visible (500) à une perte silencieuse.** |
| **2026-07-16** | **RG-019 rétrogradée de `IMPLÉMENTÉ` à `[À CONFIRMER]` : `verifie: test` retiré, remplacé par `verifie: code_direct`. Le comportement du code reste conforme à la règle (vérifié par lecture directe) — c'est la preuve par test qui est invalidée : `user.service.test.ts` réimplémentait la condition de révocation dans une fonction locale (`shouldRevokeSessions`) au lieu d'importer et d'appeler `userService.updateUser`, donc resterait vert si le code réel dérivait.** | **Correction du porteur du projet, session du 2026-07-16 (audit 4.14, Constat F), à partir d'un défaut que l'auditeur a lui-même démasqué dans son propre test d'une session antérieure.** |
| **2026-07-16** | **SEC-006 : les trois défauts (jamais relu, jamais pré-rempli, jamais effaçable) corrigés en une passe (mode audit + correction rapide) — `phone` ajouté à `userPublicFields`/`toAuthUser`/`client/src/types/auth.ts`, formulaire du portail Client pré-rempli depuis `user?.phone`, soumission d'un champ vidé envoie `null` explicite au lieu de `undefined` (que Prisma omettait). Non touché : le swagger de `user.routes.ts` reste sans `phone` — documentation seule, hors périmètre fonctionnel de cette passe.** | **Correction directe, session du 2026-07-16 : les trois défauts ne relevaient d'aucune des 4 exceptions du mode rapide (pas de migration, pas de RBAC/sécurité, pas de suppression, pas de décision produit — celle-ci déjà tranchée en §7 le jour même). `en_cours`, pas `resolu` : non commité/passé en CI au moment de cette entrée.** |
| **2026-07-16** | **SEC-013 ouverte : 6 tests client en échec (ContactPage, useFreelancerApplications, FileUploadField), rencontrés incidemment en vérifiant l'absence de régression après la correction SEC-006. Confirmés préexistants par `git stash` des fichiers modifiés puis re-exécution — mêmes échecs sans mes changements. Hors périmètre du module 4.14, non corrigés dans cette passe.** | **Constat du 2026-07-16, enregistré immédiatement conformément à CLAUDE.md (« tout écart constaté hors d'un audit formel doit être enregistré dans la même session »).** |
| **2026-07-17** | **Entité 3.18 Document rattachée au module 4.2 Gestion de projet (pas de module dédié) — les 4 fichiers (`document.service.ts`/`.repository.ts`/`.controller.ts`/`.routes.ts`), actifs et montés indépendamment mais non revendiqués par aucun module §4, sont ajoutés au `perimetre_code:` de 4.2. `comment.service.ts`/`.repository.ts`/`.controller.ts` (CRUD de `Comment`, déjà cité au schéma de 4.2 mais absent du `perimetre_code:`) corrigés dans la même passe. Écarts trouvés par AUDIT_GRID.md (2026-07-17, grille CRUD exhaustive des 24 entités).** | **Réponse du porteur du projet, session du 2026-07-17 : « the documents are the project related documents not a separated module ».** |
| **2026-07-17** | **Correction perimetre_code de 4.6 Portail client : la note du 2026-07-16 affirmait à tort que `serviceRequest.*` avait déjà « ses 5 couches » déclarées — seul `serviceRequest.service.ts` y figurait. Les 4 fichiers manquants (`serviceRequest.repository.ts`/`.controller.ts`/`.routes.ts`/`.validator.ts`) ajoutés.** | **Constat direct, session du 2026-07-17, via AUDIT_GRID.md — la note existante contredisait le code réellement lu, corrigée pour ne plus induire une future session en erreur.** |
| **2026-07-17** | **Correction perimetre_code de 4.11 Module IA (GELÉ) : `aiConversation.repository.ts`/`.controller.ts`/`.routes.ts` ajoutés — ils forment la totalité de la couche CRUD réelle de AiConversation/AiMessage, absente jusqu'ici (seul le service figurait). Correction documentaire uniquement, aucun développement/audit fonctionnel effectué sur ce module GELÉ.** | **Constat direct, session du 2026-07-17, via AUDIT_GRID.md.** |
| **2026-07-17** | **Correction perimetre_code de 4.1 CRM & Pipeline commercial : `contact.service.ts` ajouté — crée/met à jour des `Lead` réels (`sendContactMessage`, `convertToLead`), non listé jusqu'ici.** | **Constat direct, session du 2026-07-17, via AUDIT_GRID.md.** |
| **2026-07-17** | **`AUDIT_GRID.md` créé à la racine du dépôt : grille CRUD exhaustive des 24 entités de §3, construite par grep + lecture directe (pas devinée), avec statut `verifie:` par opération. Sert de référence pour les futures passes d'audit module par module et a produit les 4 corrections perimetre_code ci-dessus. Commité séparément (`5c31f2e`), poussé sur `origin/main`.** | **Travail demandé par le porteur du projet, session du 2026-07-17 : générer une checklist CRUD de référence, sans corriger ni auditer un module en particulier.** |
| **2026-07-17** | **SEC-018 rejeté : `req.user!.id` et `req.user!.sub` sont signés avec la même valeur à l'émission du token (`auth.service.ts:44-45`) — pas un bug, juste une incohérence de nommage sans conséquence fonctionnelle.** | **Vérification directe du porteur/session, 2026-07-17 : lecture de `JwtPayload` (les deux champs coexistent) et de `signAccessToken` (les deux reçoivent `user.id`).** |
| **2026-07-17** | **SEC-019 : les 4 méthodes repository orphelines (invoice/siteContent/aiConversation/freelancerApplication) supprimées — code mort confirmé par grep, zéro appelant, typecheck + 247/247 tests verts après suppression.** | **Décision implicite via la procédure du projet (suppression de code mort confirmé n'est pas un développement) — pas de décision produit distincte requise.** |
| **2026-07-17** | **SEC-016 : migration `LeadArchive`/`ContactRequestArchive` créée sur décision du porteur (« créer la migration manquante »). Scope volontairement limité à Lead + ContactRequest — Document exclu (cascade DocumentAccessLog + versioning), Notification exclu par la même décision malgré l'absence de risque de cascade trouvé.** | **Réponse du porteur du projet, session du 2026-07-17, face au choix désactiver/créer/laisser tel quel pour le job `archiveColdData`.** |
| **2026-07-17** | **`prisma migrate reset --force` exécuté sur la base de dev locale (secritou_db, localhost:5434) par le porteur du projet lui-même — bloqué pour l'assistant par le garde-fou anti-agent-IA de Prisma (consentement explicite requis, jamais contourné). A permis la vérification réelle de SEC-016/SEC-020 contre une base migrée plutôt qu'une simple lecture de code.** | **Consentement explicite du porteur du projet, session du 2026-07-17, après explication complète (commande exacte, motif, caractère irréversible, confirmation base non-production).** |
| **2026-07-17** | **SEC-017 : `executiveMetrics`/`revenueForecast` montés sur `/dashboard/executive-metrics` et `/dashboard/revenue-forecast` plutôt que documentés comme code mort — fonctionnalités trouvées complètes (lecture seule, scopées, cachées) à l'inspection avant activation.** | **Réponse du porteur du projet, session du 2026-07-17, face au choix monter/laisser tel quel/investiguer d'abord pour ces deux contrôleurs jamais exposés.** |
| **2026-07-17** | **SEC-016/SEC-017/SEC-019/SEC-020 déclarées `resolu` en ANOMALIES.yaml SANS confirmation CI — dérogation explicite à la règle commit+CI de CLAUDE.md/ANOMALIES.yaml (normalement : `resolu` exige commit + CI verte sur ce commit, pas seulement un correctif poussé). Les correctifs sont réels, poussés sur `origin/main` (commits `eff7755`, `a2801e2`) et vérifiés localement (typecheck, 247/247 tests, exécution réelle contre une base migrée pour SEC-016/020, curl 401 vs 404 pour SEC-017) — mais aucune exécution CI n'a été observée sur ces commits au moment de cette entrée.** | **Instruction explicite et directe du porteur du projet, session du 2026-07-17 (« no make it resolu »), après que l'assistant a rappelé la règle du projet et proposé de rester `en_cours`. Consigné ici pour que l'écart à la procédure soit traçable, pas silencieux — une session future qui lirait `resolu` sans cette note pourrait à tort le prendre pour une CI confirmée.** |
| **2026-07-17** | **SEC-007/SEC-008/SEC-009/SEC-011 reconfirmées `resolu` par re-vérification directe (pas de nouveau correctif) : typecheck 0 erreur, test:unit 247/247 exécuté deux fois, condition stricte de révocation de refresh token restaurée mot pour mot, `revokeAllSessionsForUser` présent et appelé. SEC-010 initialement laissée `en_cours` car son critère nomme explicitement SEC-012 comme précondition, encore ouverte à ce stade.** | **Re-vérification demandée implicitement par le choix du porteur du projet de traiter les anomalies `en_cours` restantes, session du 2026-07-17.** |
| **2026-07-17** | **SEC-012 : les 6 dernières occurrences de types maison (`Partial<{...}>`) converties vers les types Prisma générés dans les services approval/clientSuccess (×3)/document/invoice/proposal. La conversion a révélé 2 défauts réels masqués par les types maison — corrigés dans la même passe : clientSuccess.service.ts relisait `data.currentValue` brut au lieu de la valeur réellement persistée pour l'historique ; proposal.service.ts appelait `.getTime()` sur une valeur qui peut être un opérateur Prisma (`{ set: ... }`), pas seulement un `Date`. `grep -rn "Partial<{" server/src/repositories/*.ts server/src/services/*.ts` confirmé à zéro résultat. Vérifié par exécution réelle contre une base vivante sur les deux points corrigés (pas seulement typecheck), pas seulement via les tests existants (aucun test dédié ne couvrait ces deux méthodes).** | **Choix du porteur du projet, session du 2026-07-17, entre SEC-006 et SEC-012 comme prochaine anomalie `en_cours` à traiter — « SEC-012 (Recommandé) ».** |
| **2026-07-17** | **SEC-010 déclarée `resolu` une fois SEC-012 corrigé — les 5 correctifs qu'elle nomme comme précondition (SEC-007/008/009/011/012) sont désormais tous `resolu`. Précision de lecture du critère textuel (« un commit contenant... ») : interprété comme « l'historique poussé contient tous ces correctifs » plutôt que « un unique commit », cohérent avec l'intention du constat d'origine (commits jamais poussés du tout).** | **Décision de l'assistant, documentée pour traçabilité — pas une reformulation du critère lui-même en ANOMALIES.yaml, seulement sa lecture pour cette clôture précise.** |
| **2026-07-17** | **`supertest`/`@types/supertest` ajoutés en dépendance de dev (server). Premier test HTTP réel du projet (`server/test/userProfilePhone.http.test.ts`) : importe le vrai `app` Express (`src/app.js`), jamais `.listen()`é, exécute des requêtes réelles contre une base de dev migrée. Résout SEC-006 (champ `phone` du portail Client) avec le critère de résolution exact demandé — un test d'intégration écrire/relire/effacer via l'API — plutôt qu'une nouvelle vérification manuelle non reproductible ou un renforcement du test service existant (qui mocke `userRepository`, donc ne couvre pas `userPublicFields`/`toAuthUser`, exactement là où vivaient les défauts d'origine).** | **Choix explicite du porteur du projet, session du 2026-07-17, entre « garder le test service + noter la vérification manuelle » et « construire un vrai harnais HTTP » — « Construire un vrai harnais de test HTTP (supertest) ». Ce fichier établit un nouveau pattern de test disponible pour de futures anomalies de la même classe (chaîne complète non couverte par des tests service mockés).** |
| **2026-07-17** | **SEC-005 résolu : `companyId: string` supprimé du type `Lead` (client/src/api/contactRequests.api.ts) — champ mort confirmé, zéro appelant. Recherche exhaustive complétée sur `client/src/features/**` et `client/src/hooks/*.ts` (laissés de côté en 2026-07-16), élargie à tout `client/`+`shared/` par prudence — aucune autre occurrence de cette classe de défaut trouvée.** | **Constat direct, session du 2026-07-17, dans le cadre du traitement des 7 anomalies `ouvert` restantes.** |
| **2026-07-17** | **SEC-013 résolu, 3 causes distinctes (pas une) : (1) FileUploadField — incohérence d'espacement dans une clé i18n FR (`fileTooLargeMax`), corrigée pour matcher la convention déjà établie par la clé sœur `fileTooLarge`. (2) useFreelancerApplications — le test attendait un email (`hello@secritou.com`) absent de tout le reste du dépôt ; le code utilise exclusivement `contact@secritou.tn` partout ailleurs (SEO, pages légales, config serveur) — test corrigé, pas le code, après autorisation explicite. (3) ContactPage (4 tests) — cause racine réelle, pas un défaut de test : `ContactPage.tsx` défautait `serviceType` sur `"Business Performance"` (littéral anglais pré-migration, absent de `CONTACT_SERVICE_TYPES`), rejeté par Zod côté client puis par le serveur. Corrigé, et a mené à la découverte de SEC-021 (bug de plus grande portée sur le même mécanisme).** | **Traité dans le cadre de la demande du porteur du projet de couvrir les 7 anomalies `ouvert` restantes, session du 2026-07-17. Autorisation explicite obtenue pour la seule modification de test (cas 2) — les 2 autres corrections touchent uniquement du code produit.** |
| **2026-07-17** | **SEC-021 ouverte et résolue dans la même session : les 4 CTA « Nous contacter » du site public (`Services.tsx`) envoyaient un `serviceType` invalide (4 littéraux anglais pré-migration), rejeté par le validateur serveur partagé (`CONTACT_SERVICE_TYPES`). Chemin de conversion commerciale publique cassé pour 100% des clics CTA service, pas un cas limite — trouvé en creusant la cause racine des tests ContactPage.test.tsx (SEC-013).** | **Constat direct, session du 2026-07-17 — enregistré immédiatement conformément à CLAUDE.md, corrigé dans la même passe que SEC-013 puisque c'est le même mécanisme de bug côté client (`ContactPage.tsx`'s default) exposé par deux entrées différentes du code.** |
| **2026-07-17** | **SEC-014/SEC-015 résolues dans la même passe (même fonction, `ceoAlerts.processor.ts#checkInvoiceFollowup`) : le calcul de `daysOverdue` porte désormais sur `Invoice.dueDate`, pas `createdAt` (SEC-014), et la requête inclut désormais le statut `OVERDUE` en plus de `SENT`/`PARTIAL` (SEC-015) — une facture qui bascule OVERDUE via `markOverdueInvoices` ne disparaît plus du champ de vision du job hebdomadaire de relance. Nouveau test `server/test/checkInvoiceFollowup.test.ts` (câblé dans `test/run-all.test.ts`), appelle réellement la fonction contre une base migrée — pas une réimplémentation de sa logique de palier.** | **Traité dans le cadre de la demande du porteur du projet de couvrir les 7 anomalies `ouvert` restantes, session du 2026-07-17. Les deux critères de résolution exacts (paliers sur dueDate + test réel appelant la fonction ; relance après OVERDUE + test réel) sont satisfaits indépendamment de la dérogation CI établie plus tôt dans cette session.** |
| **2026-07-17** | **SEC-004 résolu : README.md corrigé pour ne plus affirmer une architecture multi-tenant — reformulé en « internal platform for a single digital agency [...] mono-tenant workspace », et la mention `tenant` retirée de la liste illustrative des middlewares (ligne 102, aucun `tenant.middleware.ts` réel n'existe).** | **Traité dans le cadre de la demande du porteur du projet de couvrir les 7 anomalies `ouvert` restantes, session du 2026-07-17. Aucune nouvelle décision produit : applique simplement l'arbitrage mono-tenant déjà tranché le 2026-07-16 (Q2) à la documentation qui le contredisait encore.** |
| **2026-07-17** | **SEC-001 résolu : les 4 clés de `BRIEF_QUESTIONS` (server/src/constants/briefQuestions.ts) renommées des noms anglais pré-migration vers les 4 noms canoniques FR — un 3e vocabulaire trouvé et corrigé dans la même passe (README.md:22, « WEB / MARKETING / AI », ne nommait que 3 pôles sur 4). Seul consommateur confirmé : `project.service.ts:220`. Nouveau test `server/test/briefQuestions.test.ts` couvre les 4 pôles individuellement, plus une garde de non-régression sur les 4 anciens noms.** | **Traité dans le cadre de la demande du porteur du projet de couvrir les 7 anomalies `ouvert` restantes, session du 2026-07-17. Le critère de résolution exact (4 pôles + test couvrant les 4 cas) est satisfait indépendamment de la dérogation CI établie plus tôt dans cette session.** |
| **2026-07-17** | **SEC-002 / RG-018 résolu : `inviteClientUser` (création du compte portail Client + email d'identifiants) déplacé de `proposal.service.ts#acceptWithCascade` (à l'acceptation, avant paiement) vers `invoice.service.ts#addPayment` (au moment précis où `Client.portalActivatedAt` passe de null à une date réelle, sur la facture d'acompte). Découverte en cours de route : le portail n'était pas ouvert sans garde — `requireActivatedPortal` bloque déjà 8 fichiers de routes tant que `portalActivatedAt` est null — seul le COMPTE (email + mot de passe) était créé trop tôt.** | **Décision explicite du porteur du projet, session du 2026-07-17, en deux temps : d'abord « aligner le code sur RG-018 », puis, après découverte du gate déjà existant, confirmation de « retarder aussi la création du compte/l'email jusqu'au paiement » plutôt que documenter le design à deux étages comme voulu.** |
| **2026-07-17** | **Bug d'infrastructure de test trouvé et corrigé en marge de SEC-002 : le nouveau fichier `server/test/portalActivationOnPayment.test.ts` est le premier de toute la suite à déclencher pour de vrai l'invalidation de cache (`cache/redis.ts`, client Redis distinct de celui de BullMQ que `run-all.test.ts` fermait déjà) — laissé ouvert, il maintenait le process Node vivant ~40s après la fin réelle des tests, faisant échouer `node --test` par timeout et rapportant faussement l'ensemble comme en échec malgré des tests individuellement verts en 3.5s. Corrigé par `closeRedisClient()` dans le hook `after()` de ce fichier spécifiquement.** | **Diagnostic direct de l'assistant par isolation progressive (suite complète → 3 fichiers → 1 fichier → inspection `pg_stat_activity`, qui a exclu un verrou base de données réel). Pas une décision produit — documenté pour qu'une future session comprenne pourquoi ce fichier a ce hook supplémentaire.** |
| **2026-07-17** | **Entité 3.9 ClientOnboarding relevée de `[À CONFIRMER]`/`schema_seul` à IMPLÉMENTÉ/`code_direct` : les 3 fichiers cœur (service 122 l., repository 363 l., controller 388 l.) lus intégralement, aucune anomalie fonctionnelle trouvée. Repository déjà correctement typé sur les types Prisma générés — pas de trace de la classe de défaut SEC-012 ici.** | **Reprise de la lecture exhaustive des modules encore `[À CONFIRMER]`, sur demande du porteur du projet (« continue à lire et corriger », rythme module par module, un rapport à chaque fois), session du 2026-07-17.** |
| **2026-07-17** | **Entité 3.12 CreditNote relevée de `[À CONFIRMER]`/`schema_seul` à IMPLÉMENTÉ/`code_direct` : `creditNote.service.ts` lu intégralement (183 l.). SEC-022 trouvée et corrigée dans la même passe : `applyCredit` supposait que Prisma retourne `null` sur un `update` conditionnel sans match, alors qu'il lève `P2025` — le garde-fou anti-double-application (409 attendu) ne se déclenchait jamais, l'utilisateur recevait un 500 générique. Reproduit réellement, corrigé, testé.** | **Constat incident pendant la lecture exhaustive des modules `[À CONFIRMER]`, enregistré immédiatement conformément à CLAUDE.md.** |
| **2026-07-17** | **Entité 3.16 ServiceRequest relevée de `[À CONFIRMER]`/`schema_seul` à IMPLÉMENTÉ/`code_direct` : les 3 fichiers cœur (service 130 l., repository 188 l., controller 105 l.) lus intégralement. Aucune anomalie fonctionnelle trouvée — `deleteComment` ne vérifie que la propriété du commentaire, pas le scope pôle, mais vérifié non exploitable (un Manager hors-pôle ne peut jamais être auteur d'un commentaire sur une demande hors de son pôle).** | **Reprise de la lecture exhaustive des modules `[À CONFIRMER]`, session du 2026-07-17.** |
| **2026-07-17** | **Entité 3.17 Approval relevée de `[À CONFIRMER]`/`schema_seul` à IMPLÉMENTÉ/`code_direct` — resynchronisation avec le statut déjà établi pour le module 4.6 (marqué `lu` dans EXPLORATION.md depuis le 2026-07-16/17), jamais répercuté sur l'entité elle-même. Pas de nouvelle lecture nécessaire, seule une incohérence de statut corrigée.** | **Constat direct en poursuivant la lecture exhaustive des entités `[À CONFIRMER]`, session du 2026-07-17.** |
| **2026-07-17** | **Entité 3.18 Document relevée de `[À CONFIRMER]`/`schema_seul` à IMPLÉMENTÉ/`code_direct` (355 lignes lues intégralement). SEC-023 trouvée et corrigée, gravité `bloquant` : la signature de contrat ne fonctionnait jamais, sur aucun chemin — `Document.signedByClientId` est une FK vers `User.id`, pas `Client.id`, malgré son nom ; le code y écrivait l'id du Client, violant systématiquement la contrainte. Reproduit réellement sur le chemin normal (document lié à un projet) et sur le cas limite (document sans projet), corrigé, testé.** | **Constat incident pendant la lecture exhaustive des modules `[À CONFIRMER]`, enregistré immédiatement conformément à CLAUDE.md. Fonctionnalité citée dans README.md comme livrée mais jamais réellement fonctionnelle depuis l'introduction du champ.** |
| **2026-07-17** | **Entité 3.19 GscConnection/MetricSnapshot relevée de `[À CONFIRMER]`/`audit_anterieur` à IMPLÉMENTÉ/`code_direct` (594 lignes lues intégralement sur 8 fichiers). Le statut PARTIEL de la v0.1.0 (« restitution admin-only, absence côté client »), repris d'un audit antérieur, est infirmé par lecture directe : `clientPortal.controller.ts#getClientPortalSeoMetrics` expose bien une lecture des métriques scopée au client authentifié.** | **Reprise de la lecture exhaustive des modules `[À CONFIRMER]`, session du 2026-07-17.** |
| **2026-07-17** | **Entité 3.20 ClientSuccess relevée de `[À CONFIRMER]`/`document` à IMPLÉMENTÉ/`code_direct` (517 lignes lues intégralement sur 4 fichiers). Calcul de score confirmé (50% manuel + 50% auto, plafonné à 100), ownership vérifié sur chaque mutation, confirmé qu'aucun rôle CLIENT n'a accès à ce module (cohérent avec sa nature d'outil de pilotage interne). Aucune anomalie trouvée.** | **Reprise de la lecture exhaustive des modules `[À CONFIRMER]`, session du 2026-07-17.** |
| **2026-07-17** | **Entité 3.21 PermissionProfile/ManagerPermission relevée de `[À CONFIRMER]`/`document` à IMPLÉMENTÉ/`code_direct` (411 lignes lues intégralement sur 8 fichiers). Confirme exactement le texte de README.md (cache Redis 300s, deepMerge). Toutes les entités §3 encore `[À CONFIRMER]` sont désormais résolues — reste à trancher le statut ACTIF/GELÉ des modules 4.7/4.8/4.10 eux-mêmes.** | **Reprise de la lecture exhaustive des entités `[À CONFIRMER]`, session du 2026-07-17.** |
| **2026-07-17** | **Module 4.7 Freelances classé ACTIF (9 fichiers lus intégralement, ~700 lignes, aucune anomalie trouvée). La fuite historique de `hourlyRate` (`plan d'action.md`, audit antérieur) est infirmée par lecture directe : `freelancer.controller.ts#redactSensitiveInfo` masque correctement `hourlyRate`/`bio`/`email` pour un FREELANCER consultant un autre profil, et le rôle CLIENT n'a de toute façon accès à aucune route de ce module.** | **Réponse du porteur du projet, session du 2026-07-17, face au choix ACTIF/GELÉ/investiguer le volume réel — « ACTIF (Recommandé) ».** |
| **2026-07-17** | **SEC-024 ouverte et résolue dans la même session : `executiveMetricsRepository.getAll` déclarait 6 types de `RiskItem` mais n'en produisait réellement que 3 — `PROJECT_CRITICAL`/`STALE_PROJECT` calculés (criticalCount/watchCount) sans jamais devenir des lignes de `risks[]`, `CONTRACT_EXPIRING`/`alerts.expiringContracts` alimentés par une requête sur `Approval` sans aucun rapport avec un contrat (aucun champ d'expiration n'existe sur `Document` ni ailleurs dans le schéma pour cette notion). `CONTRACT_EXPIRING`/`expiringContracts`/`STALE_PROJECT` supprimés (rien de réel à afficher, conformément à « réparer n'est pas développer » — pas de nouveau champ de schéma inventé) ; `PROJECT_CRITICAL` désormais réellement poussé dans `risks[]` depuis la boucle qui calculait déjà `criticalCount`. Nouveau test `server/test/executiveMetricsProjectRisks.test.ts`, appelle réellement le repository contre une base migrée. 274/274 tests verts, typecheck serveur + client verts.** | **Trouvé en lisant intégralement `executiveMetrics.repository.ts` (568 lignes) pour confirmer le module 4.8 Analytics & Performance ; question posée au porteur du projet conformément à l'instruction « questionne moi si il y a des incohérences » — réponse « Nouvelle anomalie, correction complète (Recommandé) ». `resolu` déclaré SANS confirmation CI, dérogation déjà établie dans cette session (« no make it resolu »).** |
| **2026-07-17** | **Module 4.8 Analytics & Performance classé ACTIF (6 fichiers restants lus intégralement en plus de l'entité 3.19, aucune autre anomalie après SEC-024).** | **Réponse du porteur du projet, session du 2026-07-17, face au choix ACTIF/GELÉ — « ACTIF (Recommandé) ».** |
| **2026-07-17** | **SEC-025 ouverte et résolue dans la même session : `client/src/types/permissions.ts#MODULES` (11 entrées) désynchronisé de `server/src/services/managerPermission.service.ts#MODULES` (13 entrées, déjà lu à l'entité 3.21) — `client-success`/`client-onboarding` absents côté client. `PermissionsGrid.tsx`/`SettingsUsersTab.tsx` itèrent génériquement sur `MODULES` sans cas particulier (vérifié par lecture directe), donc ces 2 modules n'affichaient jamais de ligne dans la grille de permissions — un Admin ne pouvait jamais accorder l'accès Client Success/Client Onboarding à un Manager via l'UI. Pas une faille de sécurité : le défaut serveur (`permissions[module]?.[action]` undefined → falsy) est un refus, pas un accès. Corrigé en ajoutant les 2 modules à `MODULES` + clés i18n FR/EN correspondantes. Typecheck client vert. **Limite de vérification signalée : aucun outil de navigateur disponible pour confirmer visuellement le rendu — vérification de niveau code uniquement (lecture directe confirmant l'itération générique + typecheck), pas de test UI en conditions réelles.**** | **Trouvé en lisant `PermissionsGrid.tsx`, dernier fichier du périmètre 4.10 restant à lire ; question posée au porteur du projet conformément à l'instruction « questionne moi si il y a des incohérences » — réponse « Nouvelle anomalie, corriger maintenant (Recommandé) ». `resolu` déclaré SANS confirmation CI, dérogation déjà établie dans cette session (« no make it resolu »).** |
| **2026-07-17** | **Module 4.10 RBAC & Permissions granulaires classé ACTIF (lecture directe intégrale terminée : 8 fichiers serveur via l'entité 3.21 + `PermissionsGrid.tsx`, SEC-025 trouvée et corrigée, aucune autre anomalie). Les 3 modules `[À CONFIRMER — non trié]` restants (4.7, 4.8, 4.10) sont désormais tous classés.** | **Réponse du porteur du projet, session du 2026-07-17, face au choix ACTIF/GELÉ — « ACTIF (Recommandé) ».** |
| **2026-07-17** | **Entité 3.15 FreelancerProfile/Skill/PortfolioItem/Rating relevée de `[À CONFIRMER]`/`audit_anterieur` à IMPLÉMENTÉ/`code_direct` — resynchronisation avec le statut déjà établi pour le module 4.7 Freelances (9 fichiers lus intégralement le même jour, exactement les mêmes fichiers que cette entité), jamais répercuté sur l'entité elle-même après la classification ACTIF du module. Pas de nouvelle lecture nécessaire, seule une incohérence de statut corrigée — même défaut de synchronisation déjà rencontré et corrigé une première fois pour l'entité 3.17/module 4.6.** | **Constat direct en vérifiant si d'autres entités §3 étaient tombées dans le même angle mort après la classification tardive de 4.7/4.8/4.10 (postérieure à l'affirmation du 2026-07-17 « toutes les entités §3 encore À CONFIRMER sont désormais résolues », ligne de journal antérieure) — session du 2026-07-17.** |
| **2026-07-17** | **SEC-010 rouverte `en_cours` : vérification directe de l'état réel de la CI sur `origin/main` (API GitHub REST non authentifiée, `gh` CLI indisponible dans cet environnement) montre 3 jobs en échec sur le HEAD courant (`client`, `server`, `i18n-check`) — le critère de résolution de SEC-010 exige littéralement « le voit passer au vert », condition non remplie à ce jour malgré la dérogation « no make it resolu » appliquée à de nombreux correctifs cette session. SEC-026 ouverte séparément pour tracer la cause réelle : 37 erreurs ESLint pré-existantes (30 de la même classe `no-non-null-asserted-optional-chain` sur 5 contrôleurs, jamais touchés par aucune session d'audit) + 1 faux positif du script `check-i18n.mjs` sur une clé pluralisée i18next — aucun rapport avec les correctifs SEC-007/008/009/011/012 que SEC-010 nommait comme précondition, ni avec aucun fichier édité cette session (vérifié par `git log` sur chaque fichier fautif et par un lint isolé, vert, des fichiers réellement modifiés).** | **Vérification proactive du porteur du projet — « Re-vérifier les resolu sans CI (Recommandé) » — après la fermeture des modules 4.7/4.8/4.10. Décision de traitement, AskUserQuestion : « Ouvrir SEC-026 (dette lint), rouvrir SEC-010 (Recommandé) ».** |
| **2026-07-17** | **SEC-026 corrigée dans la même session (« ok on corrige alors ») : 30 des 33 erreurs server = pattern `req.user?.sub!`/`req.user?.role!` (5 contrôleurs) remplacé par `req.user!.sub`/`req.user!.role` (l'assertion porte sur `req.user`, garanti non-null par `authenticate`, jamais sur le résultat du chaînage optionnel) ; 3 `no-useless-catch` supprimés ; 2 `no-constant-condition` dans `invoice.service.test.ts` remplacées par un appel réel à `addPaymentSchema.safeParse` (le vrai garde-fou, au lieu d'une condition littérale qui ne prouvait rien). Client : `axios.ts` — exécuteur `async` de `Promise` extrait en fonction nommée `runRefresh` (`no-async-promise-executor`) ; `ProjectDetailPage.tsx` — 3 hooks (`useMySplitForProject`/`useProjectTemplateForService`/`useApplyProjectTemplate`) remontés avant les 2 `return` anticipés, vrai bug d'ordre de hooks corrigé (pas un style discutable), les 3 hooks étant déjà conçus pour être inertes tant que `project` est undefined. `scripts/check-i18n.mjs` corrigé pour reconnaître la convention de suffixe pluriel i18next. Vérification locale complète : lint 0 erreur des deux côtés, typecheck vert, i18n-check passé, build serveur+client réussis, scan de secrets propre, 274/274 + 22/22 tests verts (deux exécutions). `resolu` déclaré SANS confirmation CI — même dérogation « no make it resolu » — le critère exige un push vu vert par la CI elle-même, condition distincte de la vérification locale exhaustive ci-dessus.** | **Instruction du porteur du projet, session du 2026-07-17 : « ok on corrige alors », en réponse à la vérification CI qui avait rouvert SEC-010 et créé SEC-026.** |
| **2026-07-18** | **RG-008 relevée de `[À CONFIRMER]` à IMPLÉMENTÉ, `verifie: test` — SEC-027 ouverte et résolue dans la même session : seul le chemin nominal était vérifié par lecture directe pour cette affirmation d'exclusivité, jamais l'exclusivité elle-même. Grep exhaustif confirme un seul point d'écriture `tx.commission.create` dans tout le dépôt, un seul appelant de `computeForPaymentTx`. Nouveau test `commissionCreationExclusivity.test.ts`, appelle réellement `invoiceService.addPayment` contre une base migrée : un paiement réel crée la commission attendue, un paiement sans effet réel sur le solde (trop-perçu total) n'en crée aucune. Contrainte `Commission.paymentId @unique` citée en renfort structurel.** | **Réponse du porteur du projet à « is there something a vérifier dans ce projet » : un audit de lecture (agent dédié) a identifié 8 règles §5 à provenance faible ou négative non testée, aucune trackée dans ANOMALIES.yaml — choix du porteur, « RG-008 (commission) puis RG-002 (scoping pôle) (Recommandé) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **RG-002 relevée de `[À CONFIRMER]` à IMPLÉMENTÉ, `verifie: test` — SEC-028 ouverte et résolue dans la même session : `createProject`/`updateProject` forçaient bien le pôle du Manager, mais `proposalService.create` (seul point d'entrée réel, en amont de tout projet) n'appliquait aucun scope de pôle sur clientId/leadId/serviceRequestId. Un Manager pouvait créer une proposition — donc plus tard un projet accepté — sur un client/lead d'un autre pôle, contournant l'intention de RG-002 sans violer son texte littéral sur Project. `Client` n'a pas de pôle propre (schéma vérifié directement) ; scope dérivé pour clientId via les projets existants (neutre si aucun, autorisé si même pôle, rejeté si exclusivement ailleurs), et directement via Lead.serviceId pour leadId. Nouveau test proposalCreationScope.test.ts, 5 cas, appelle réellement le service contre une base migrée.** | **Réponse du porteur du projet à « is there something a vérifier dans ce projet » — RG-002 choisie en second après RG-008 (« RG-008 (commission) puis RG-002 (scoping pôle) (Recommandé) »). Décision produit sur la règle de scope à appliquer (AskUserQuestion, session du 2026-07-18) : « Vérifier le pôle du Lead directement (Lead.serviceId), et pour ServiceRequest/clientId nu, autoriser si le client a AU MOINS un projet dans le pôle du Manager OU aucun projet du tout (client neuf) (Recommandé) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **RG-017 relevée de `[À CONFIRMER]` à IMPLÉMENTÉ, `verifie: test` — SEC-029 ouverte et résolue dans la même session : la provenance était une déduction conditionnelle (absence de RG-016 + contrôle de rôle ailleurs), jamais une observation directe. Module 4.11 (GELÉ) dégelé explicitement pour cette seule vérification, regelé immédiatement après, aucune correction fonctionnelle. Aucun défaut trouvé : les 2 fichiers de routes IA gardent authorize(ADMIN,MANAGER) explicitement, `agentOrchestratorService.executeAgent` reverifie lui-même le rôle indépendamment du middleware, grep exhaustif confirme l'absence de toute primitive d'exécution (child_process/execSync/spawn/eval) dans tout server/src. Nouveau test aiExecutionAccessClient.test.ts, appelle réellement executeAgent avec un rôle CLIENT et FREELANCER, confirme le rejet 403 sur les deux.** | **Réponse du porteur du projet à « is there something a vérifier dans ce projet », 3e règle traitée après RG-008/RG-002. Décision explicite (AskUserQuestion, session du 2026-07-18) face au conflit avec le gel de 4.11 : « Dégeler explicitement 4.11 pour cette vérification uniquement ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **RG-004b relevée de `[À CONFIRMER]` à IMPLÉMENTÉ, `verifie: test` — SEC-030 ouverte et résolue dans la même session : la provenance n'était que code_grep, le calcul exact du solde jamais confirmé par lecture directe. Aucun défaut trouvé : `clientApprove` (lignes 306-308) calcule un complément à 100% (`proposalAmount - depositAmount` réellement facturé), pas un recalcul fixe à 70% comme le texte littéral pourrait le laisser penser — plus robuste : acompte + solde totalisent toujours exactement le montant de la proposition. Les 3 tests existants touchant `clientApprove` réimplémentaient tous une logique-miroir locale, aucun n'appelait le vrai service ni n'assérait le montant du solde. Nouveau test `projectClientApproveBalanceInvoice.test.ts`, 2 cas (acompte nominal 30%, acompte dévié à 40%), appelle réellement `clientApprove` contre une base migrée et confirme que le solde complémente l'acompte réel (700 puis 600), pas un recalcul fixe déconnecté (qui aurait donné 700 dans les deux cas).** | **Réponse du porteur du projet à « is there something a vérifier dans ce projet », 4e règle traitée après RG-008/RG-002/RG-017. `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **RG-012 relevée de `[À CONFIRMER]` à IMPLÉMENTÉ, `verifie: test` — SEC-031 ouverte et résolue dans la même session : le mécanisme atomique (`nextInvoiceNumber`, upsert + increment, même transaction que la création) était sain, mais `invoiceService.create`/`createInvoiceSchema` acceptaient un `number` fourni par l'appelant (`POST /invoices`, ADMIN), contournant entièrement le compteur `InvoiceCounter` — un Admin pouvait créer une facture avec un numéro arbitraire, cassant la continuité de la séquence auto-générée ou entrant en collision future avec un numéro que le compteur générerait plus tard. Champ `number` retiré du validateur et du type d'entrée du service. Nouveau test `invoiceNumberingGapless.test.ts`, 2 cas, appelle réellement le service contre une base migrée : séquence consécutive confirmée, `number` injecté strippé par le vrai validateur puis ignoré.** | **Réponse du porteur du projet à « is there something a vérifier dans ce projet », 5e règle traitée après RG-008/RG-002/RG-017/RG-004b. Décision de correction (AskUserQuestion, session du 2026-07-18) : « Lacune réelle à corriger : retirer `number` du validateur/endpoint (Recommandé) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **RG-001 relevée de `[À CONFIRMER]` à IMPLÉMENTÉ, `verifie: test` — SEC-032 ouverte et résolue dans la même session : le code applicatif n'imposait aucune contrainte réelle sur la devise — `currencyCode` (dupliquée dans `invoice.validator.ts`/`proposal.validator.ts`) acceptait n'importe quelle devise à 3 lettres. Impact réel confirmé : `DEFAULT_CURRENCY` est déjà utilisée comme filtre dans les repositories analytics/forecast (module 4.8) — une facture en devise différente aurait été silencieusement exclue de tous les KPIs financiers. Une troisième copie identique dans `shared/src/schemas/common.schema.ts` (code mort, zéro import réel, mais même nom que les vrais validateurs) corrigée par cohérence. `currencyCode` changée en `z.literal(DEFAULT_CURRENCY)`/`z.literal("TND")`. Nouveau test `currencyRejectsNonTnd.test.ts`, appelle réellement les vrais validateurs. Écart incident trouvé et corrigé dans la même passe : `shared/src/constants/contactForm.test.ts` (test figé) attendait encore les 4 anciens noms de pôles anglais alors que le code utilise déjà les 4 noms canoniques FR (même classe que SEC-001, occurrence non couverte côté `shared/`) — corrigé. Les 8 règles §5 identifiées par l'audit de lecture initial sont désormais toutes traitées.** | **Réponse du porteur du projet à « is there something a vérifier dans ce projet », 6e et dernière règle de la liste initiale. Décision de correction (AskUserQuestion, session du 2026-07-18) : « Lacune réelle à corriger : contraindre `currencyCode` à TND uniquement (Recommandé) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **SEC-033 ouverte et résolue dans la même session : le détail d'un projet n'affichait jamais ses tâches — `projectListSelect` (partagé par `findAll`/`findById`) ne sélectionnait jamais la relation `tasks`, alors que le type client (`Project.tasks?: Task[]`, optionnel) masquait totalement l'absence côté TypeScript. Onglet Tâches toujours vide, compteur par statut et lien « voir toutes » jamais affichés, bandeau « Partir du template » affiché à tort en permanence — seul le % de progression restait correct (calculé indépendamment via une requête SQL séparée), rendant l'incohérence visible pour l'utilisateur. RBAC vérifié avant de choisir le correctif : `GET /tasks` exclut explicitement CLIENT, donc un `useTasks({projectId})` côté front aurait cassé pour ce rôle — corrigé côté serveur à la place, `tasks` (id/title/status) ajouté uniquement au `baseSelect` de `findById`, jamais à `projectListSelect` lui-même (éviterait une régression de performance sur la liste paginée `findAll`). Nouveau test `projectDetailIncludesTasks.test.ts`, 2 cas, appelle réellement `projectService.getProjectById` contre une base migrée.** | **Constat détaillé signalé directement par le porteur du projet, session du 2026-07-18, hors du fil des règles §5 en cours — enregistré et corrigé immédiatement conformément à CLAUDE.md. `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **SEC-034 ouverte et résolue dans la même session : l'onglet « Mes livrables » du détail projet n'était filtré par aucun projet côté lecture (`useDocuments` sans `projectId`), et le dépôt de livrable ne transmettait jamais `projectId`/`clientId` non plus — seulement un tag texte libre. Vérifié empiriquement contre une base réelle que le scope FREELANCER de `documentRepository.findAll` (`where.project = { tasks: { some } }`) ne matche JAMAIS un document sans `projectId`, rendant tout livrable invisible pour le freelance qui vient de le déposer, même après avoir corrigé uniquement la lecture. Corrigé les deux (lecture ET écriture) sur décision du porteur du projet. Nouveau test `freelancerSeesOwnDeliverable.test.ts`, 2 cas (avec/sans `projectId`), appelle réellement `documentService.create`/`getAll` contre une base migrée — le second cas prouve rigoureusement que le défaut était réel.** | **Constat détaillé signalé directement par le porteur du projet, session du 2026-07-18, immédiatement après SEC-033 (même page) — enregistré et corrigé immédiatement conformément à CLAUDE.md. Décision de portée (AskUserQuestion) : « Corriger les deux : lecture (projectId sur useDocuments) ET écriture (projectId sur createDocument) (Recommandé) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
