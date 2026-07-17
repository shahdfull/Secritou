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
194-346, session précédente).**

### 3.8 Task
Tâche au sein d'un projet. Cycle de vie :
`TODO → IN_PROGRESS → REVIEW → DONE`.
**Statut : IMPLÉMENTÉ. `verifie: schema_seul` — `task.service.ts` non lu
intégralement (grep ciblé AuditLog seulement, voir EXPLORATION.md).**

### 3.9 ClientOnboarding et sous-étapes
Suivi structuré du démarrage d'une mission, en 7 étapes : Contract, Payment,
Questionnaire, Specifications, KickoffMeeting, ProductionProgress, Delivery.
**Statut : `[À CONFIRMER]`** — la présence des fichiers
(`clientOnboarding.service.ts`/`.controller.ts`/`.repository.ts`) est
confirmée, mais leur contenu n'a pas été lu directement.
**`verifie: schema_seul`** (structure) — le statut IMPLÉMENTÉ affirmé en
v0.1.0 est rétrogradé faute de `code_direct`.

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
**Statut : `[À CONFIRMER]`. `verifie: schema_seul`** — `creditNote.service.ts`
non lu directement (v0.1.0 le citait via un audit antérieur, non revérifié).

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
**Statut : `[À CONFIRMER]`. `verifie: audit_anterieur`** — la fuite de
`hourlyRate` mentionnée dans `plan d'action.md` (historique) et l'existence
des fichiers `freelancer.service.ts`/`.repository.ts`/`.controller.ts`,
`rating.service.ts` sont confirmées par listing seul, aucun contenu lu
directement cette session ni la précédente.

### 3.16 ServiceRequest
Demande de support ou de nouveau projet initiée côté client. Statuts :
`NEW → IN_REVIEW → IN_PROGRESS → WAITING_CLIENT → COMPLETED/CANCELLED`.
**Statut : `[À CONFIRMER]`. `verifie: schema_seul`** — aucun fichier de
service/controller lu directement.

### 3.17 Approval
Élément soumis à validation du client. Statuts :
`PENDING → APPROVED/REJECTED`.
**Statut : `[À CONFIRMER]`. `verifie: schema_seul`.**

### 3.18 Document
Fichier versionné rattaché à un client/projet/facture, avec niveaux d'accès
et journal d'accès (`DocumentAccessLog`).
**Statut : `[À CONFIRMER]`. `verifie: schema_seul`.**

### 3.19 GscConnection / MetricSnapshot
Connexion OAuth à Google Search Console par client, et stockage générique de
métriques externes.
**Statut : `[À CONFIRMER]`. `verifie: audit_anterieur`** — 9 fichiers
identifiés par grep (existence confirmée), aucun contenu lu directement. Le
statut PARTIEL de la v0.1.0 (« restitution admin-only, absence côté client »)
provient exclusivement d'un audit antérieur non revérifié — voir PISTES.md.

### 3.20 ClientSuccess (et sous-entités)
Suivi de la réussite client, score 0-100.
**Statut : `[À CONFIRMER]`. `verifie: document`** — le seuil d'alerte (50) et
la tâche planifiée quotidienne proviennent de `docs/n8n-events.md` (lu
intégralement, mais ce document décrit des événements, pas le code source
du calcul lui-même) ; `clientSuccess.service.ts` non lu directement.

### 3.21 PermissionProfile / ManagerPermission
Système de permissions granulaires par manager.
**Statut : `[À CONFIRMER]`. `verifie: document`** — l'algorithme de
résolution (cache Redis 5 min, fusion profil + surcharges) provient du texte
de README.md (document historique), non revérifié sur
`managerPermission.service.ts` ni `rbac.middleware.ts`.

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
      - prisma/schema.prisma#Lead,Client,Proposal,ProposalSection,ProposalHistory
      - client/src/features/crm/**
      - client/src/features/leads/**
      - client/src/features/proposals/**
      - client/src/api/contactRequests.api.ts

### 4.2 Gestion de projet — **ACTIF**
Projets, tâches, réunions de projet, templates de tâches par pôle.

    perimetre_code:
      - server/src/services/project.service.ts
      - server/src/services/projectMeeting.service.ts
      - server/src/services/projectSpecs.service.ts
      - server/src/services/projectTemplate.service.ts
      - server/src/repositories/project.repository.ts
      - server/src/repositories/projectMeeting.repository.ts
      - server/src/repositories/projectTemplate.repository.ts
      - server/src/controllers/project.controller.ts
      - server/src/controllers/projectMeeting.controller.ts
      - server/src/controllers/projectTemplate.controller.ts
      - server/src/routes/project.routes.ts
      - server/src/validators/project.validator.ts
      - server/src/validators/projectMeeting.validator.ts
      - server/src/utils/projectProgress.ts
      - prisma/schema.prisma#Project,Task,Comment,ProjectMeeting,ProjectTemplate,TaskTemplate
      - client/src/features/projects/**
      - client/src/features/tasks/**

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
y figurait, contrairement à `serviceRequest.*` qui a ses 5 couches. Ajoutés
ci-dessous pour que le périmètre reflète ce qui est réellement consommé.

    perimetre_code:
      - server/src/services/clientPortal.service.ts
      - server/src/repositories/clientPortal.repository.ts
      - server/src/controllers/clientPortal.controller.ts
      - server/src/routes/clientPortal.routes.ts
      - server/src/services/serviceRequest.service.ts
      - server/src/services/approval.service.ts
      - server/src/controllers/approval.controller.ts
      - server/src/routes/approval.routes.ts
      - server/src/validators/approval.validator.ts
      - server/src/services/customQuestion.service.ts
      - prisma/schema.prisma#ServiceRequest,Approval,CustomQuestion,CustomQuestionMessage
      - client/src/features/client-portal/**
      - client/src/features/approvals/**
      - client/src/features/service-requests/**
      - client/src/features/questions/**

### 4.7 Freelances — **[À CONFIRMER — non trié]**
Recrutement (candidatures), profils, compétences, évaluations. **Ne peut pas
être classé GELÉ : EXPLORATION.md marque ce module `non exploré` (aucun
fichier ouvert directement, structure supposée uniquement via schema.prisma).
Geler exige d'abord de savoir ce qu'on gèle — voir CLAUDE.md.** Reste à
trancher ACTIF/GELÉ/HORS PÉRIMÈTRE après une première lecture directe.

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

### 4.8 Analytics & Performance — **[À CONFIRMER — non trié]**
Connexions aux sources de données externes et métriques de performance
client. **Ne peut pas être classé GELÉ : EXPLORATION.md marque ce module
`non exploré`.** Reste à trancher après une première lecture directe.

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
      - prisma/schema.prisma#GscConnection,MetricSnapshot
      - client/src/features/analytics/**
      - client/src/features/reports/**

### 4.9 Client Success — **GELÉ**
Suivi de la réussite/santé client.

    perimetre_code:
      - server/src/services/clientSuccess.service.ts
      - server/src/repositories/clientSuccess.repository.ts
      - server/src/controllers/clientSuccess.controller.ts
      - server/src/routes/clientSuccess.routes.ts
      - server/src/validators/clientSuccess.validator.ts
      - prisma/schema.prisma#ClientSuccess,SuccessObjective,SuccessMetric,MetricHistory,SuccessRecommendation,SuccessTimeline
      - client/src/features/client-success/**

### 4.10 RBAC & Permissions granulaires — **[À CONFIRMER — non trié]**
Rôles de base (non concerné — voir §3.2, `code_direct`) + permissions
granulaires par manager au-delà du rôle. **Ne peut pas être classé GELÉ :
EXPLORATION.md marque ce sous-système `non exploré`.** Reste à trancher après
une première lecture directe.

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
      - client/src/features/settings/**

### 4.11 Module IA (agent-service) — **GELÉ**
Personas IA pour assistance à la production.

    perimetre_code:
      - server/src/agents/personas.ts
      - server/src/services/agentOrchestrator.service.ts
      - server/src/services/llm.client.ts
      - server/src/services/aiConversation.service.ts
      - server/src/services/cvExtraction.service.ts
      - server/src/controllers/ai.controller.ts
      - server/test/ai.endpoint.test.ts
      - server/src/config/env.ts
      - prisma/schema.prisma#AiConversation,AiMessage
      - client/src/features/ai-assistant/**

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

**`server/src/jobs/**` — [À CONFIRMER — non trié, jamais ouvert.]**
EXPLORATION.md confirme que ce répertoire n'a jamais été ouvert directement.
Son rôle supposé (via citations d'audits antérieurs, non revérifiées)
inclurait l'expiration automatique des propositions (module 4.1, ACTIF — voir
§3.6) et les relances de facture (module 4.4, ACTIF), à côté du recalcul de
score Client Success (module 4.9). **Un répertoire jamais ouvert ne peut pas
être classé GELÉ : le geler mettrait hors audit de l'automatisation
potentiellement critique pour le flux argent sans l'avoir jamais vérifié.**
Périmètre à explorer en priorité, avant tout autre module non trié.

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
*Module : 4.4, 4.1.* Statut : `[À CONFIRMER]`. `verifie: schema_seul` —
`Proposal.currency`/`Invoice.currency` ont `@default("TND")` dans
schema.prisma (structure), mais rien ne garantit dans le code applicatif
qu'aucune valeur différente ne peut être écrite (comportement non vérifié).
Note pour test futur : vérifier qu'aucun endpoint n'accepte une devise
différente de TND en écriture.

**RG-002 — Rattachement mission → pôle → associé.**
Un `Project` est rattaché à un `Service` (pôle) via `serviceId`. Un Manager
(associé) ne peut créer ou modifier un projet que dans son propre pôle.
*Module : 4.2.* Statut : `[À CONFIRMER]` (affirmation négative/exclusivité —
« ne peut… que »). `verifie: code_direct` pour le chemin nominal lu
(`project.service.ts` lignes 1-100, session précédente, confirme que
`createProject`/`updateProject` forcent le `serviceId` du Manager), mais
aucun test n'assère qu'aucun autre chemin (import en masse, endpoint annexe)
ne permet le contournement — la règle telle qu'énoncée (exclusivité) exige
`verifie: test`, absent. Note pour test futur : test d'intégration
confirmant qu'un Manager ne peut, par aucune route, créer/modifier un projet
hors de son `serviceId`.

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
`[À CONFIRMER]`. `verifie: code_grep` — le calcul du solde dans
`project.service.ts`/`clientApprove` n'a pas été relu ligne à ligne cette
session ; sa valeur exacte (complément à 100% vs recalcul indépendant à 70%)
n'est pas confirmée par lecture directe.

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
est effectivement enregistré contre une facture. *Module : 4.5, 4.4.*
Statut : `[À CONFIRMER]` (affirmation d'exclusivité — « uniquement
lorsqu'un… »). `verifie: code_direct` pour le chemin nominal observé
(`computeForPaymentTx` appelé depuis `addPayment`, dans la même transaction),
mais aucun test n'assère qu'aucun autre chemin ne crée de commission hors de
ce déclencheur — `verifie: test` manquant pour l'exclusivité elle-même. Note
pour test futur : confirmer qu'aucune commission n'est créée en dehors de
`computeForPaymentTx`.
Le chemin nominal lui-même reste établi par (`commission.service.ts`,
intégral).

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
que la création de la facture. *Module : 4.4.* Statut : `[À CONFIRMER]`.
`verifie: schema_seul` (`InvoiceCounter`, schema.prisma) — le service
`invoice.service.ts` n'a été lu que par grep ciblé sur `addPayment`, pas sur
la logique de numérotation elle-même.

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
commande, y compris via le module IA. *Module : 4.11 (GELÉ), 4.10
(`[À CONFIRMER — non trié]`).* Statut : `[À CONFIRMER]`. Le statut
IMPLÉMENTÉ affirmé en v0.2.0 (« garanti par RG-014 ») était une **déduction**
— absence d'outil d'exécution combinée à un contrôle de rôle ailleurs — pas
une observation directe. Une déduction n'est pas une observation. Aucun
fichier ni test ne prouve directement l'absence d'accès du rôle Client à un
outil d'exécution (l'absence d'un tel outil dans le code, constatée pour
RG-016, ne prouve l'absence d'accès que tant que RG-016 reste vraie — un
raisonnement conditionnel, pas un fait vérifié isolément).

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
| 4.7 Freelances | `[À CONFIRMER — non trié]` | EXPLORATION.md le marque `non exploré` ; ne peut être classé GELÉ avant une première lecture directe (voir CLAUDE.md). |
| 4.8 Analytics & Performance | `[À CONFIRMER — non trié]` | Idem — `non exploré`. |
| 4.9 Client Success | GELÉ | Couverture `partiel` (au moins un document direct exploité) ; calcul partiellement automatisé seulement, 0 client actif pour l'alimenter. |
| 4.10 RBAC & Permissions granulaires | `[À CONFIRMER — non trié]` | Idem 4.7/4.8 — `non exploré`. |
| 4.11 Module IA (agent-service) | GELÉ | Couverture `lu` (complète) — deux personas existants conservés tels quels ; pas de développement supplémentaire pour l'instant. |
| 4.13 (volet webhooks n8n) | GELÉ | Automatisations externes existantes, non prioritaires hors flux argent. |
| `server/src/jobs/**` (composant transverse de 4.13) | `[À CONFIRMER — non trié, priorité d'exploration]` | Jamais ouvert ; rôle supposé incluant expiration de propositions (4.1 ACTIF) et relances de facture (4.4 ACTIF) — ne peut être gelé sans vérification, risque de trou d'audit sur le flux argent. |
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
