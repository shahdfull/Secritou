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
2026-07-16). **SEC-050 trouvée et corrigée (session du 2026-07-19,
`mineur`)** : les 3 chemins auth utilisaient 3 selects différents —
login/register (`userPublicSelect`) et refresh renvoyaient `phone`
absent, alors que `GET /auth/me` (`findUserById`, record complet) le
renvoyait ; le type client `AuthUser` le promet et
`ClientProfilePage.tsx` s'en sert. Incohérence découverte en retirant
un `any` de `AuthRepository` pendant le nettoyage lint (SEC-049).
Corrigé (décision du porteur : rendre `phone` cohérent = présent
partout) : `phone: true` ajouté à `userPublicSelect`, alignant les 3
chemins ; test réel (`authPhoneRoundTrip.test.ts`) prouvant que
`login`/`me` renvoient le téléphone stocké. `verifie: test`. Voir
SEC-050.
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
SEC-033. **SEC-035 trouvée et corrigée (session du 2026-07-18)** : les
sous-onglets Actif/Terminé du Freelancer (`ProjectsPage.tsx`) filtraient
par `.filter()` une seule page paginée de `findAll` (12 éléments), pendant
que la pagination affichée en bas portait sur le total réel non filtré —
un freelance avec plus de 12 projets avait des compteurs et un contenu de
sous-onglet faux. Corrigé : nouveau paramètre `statusIn?: ProjectStatus[]`
sur `findAll`/`getAllProjects` (en plus du filtre `status` générique
partagé par toutes les entités, jamais un remplacement), chaque sous-onglet
devient sa propre requête indépendamment paginée. Voir SEC-035.
**SEC-037 trouvée et corrigée (session du 2026-07-18)** :
`project.repository.ts` faisait `import { prismaRead as prisma }` puis
utilisait cet alias pour TOUTES ses méthodes — y compris les écritures
(`create`/`update`/`delete`/`archive`/`restore`). Si un vrai réplica en
lecture seule est un jour branché via `DATABASE_READ_URL`, toutes les
écritures sur `Project` échoueraient (invisible actuellement, sans
réplica configuré `prismaRead === prisma`). Corrigé : `prisma` et
`prismaRead` importés séparément, `prisma` réservé aux écritures et aux
pré-lectures immédiatement suivies d'une écriture (`findByIdAdmin`).
Voir SEC-037. **SEC-038 trouvée et corrigée (session du 2026-07-18)** :
`ProjectsPage.tsx#useProjectTrash` était appelée inconditionnellement,
même pour le rôle FREELANCER — or `GET /projects/trash` est gardée
`authorize("ADMIN", "MANAGER")`, donc chaque ouverture de la page par un
Freelancer déclenchait une requête garantie 403, pour un bloc de rendu
(section Corbeille) lui-même affiché inconditionnellement. Corrigé :
`useProjectTrash` accepte un paramètre `enabled`, appelé avec
`!isFreelancer`, le bloc JSX enveloppé de la même condition. Voir
SEC-038. **SEC-039 trouvée et corrigée (session du 2026-07-18), gravité
`bloquant`** : le bouton « Nouveau projet » (`ProjectsPage.tsx`) était
100% non fonctionnel — `project.validator.ts#createProjectSchema` exige
`proposalId` (UUID) obligatoire, `project.service.ts#createProject`
rejette (404/422) si absent/proposition non `ACCEPTED`, mais le
formulaire utilisait le schéma partagé `@secritou/shared` (sans
`proposalId`) et aucun champ ne le collectait. Cause racine confirmée :
le vrai flux métier passe par
`proposal.service.ts#acceptWithCascade` (création automatique du projet
à l'acceptation d'une proposition), la création directe étant un
vestige d'une version antérieure. Décision du porteur du projet :
retirer le bouton/dialogue plutôt que réparer le formulaire — retiré,
formulaire d'édition intact. Voir SEC-039. **SEC-040 trouvée et
corrigée (session du 2026-07-18), gravité `mineur`** : `ProjectStatus`
n'a délibérément aucune valeur `CANCELLED` (design documenté par
commentaire dans `schema.prisma`, lignes 25-27) — un projet abandonné
est représenté via `archivedAt` au lieu d'un statut terminal. Le
mécanisme existe côté serveur (`POST /:id/archive`,
`authorize("ADMIN")`) mais n'apparaissait nulle part dans l'UI
(`ProjectDetailPage.tsx`/`ProjectsPage.tsx`, zéro occurrence
confirmée par grep). De plus, contrairement à `deletedAt`
(`restore` + `GET /projects/trash`), `archivedAt` n'a aucun chemin
retour : `findAll`/`findById`/`findByIdAdmin`
(`project.repository.ts`) filtrent tous inconditionnellement
`archivedAt: null`, donc un projet archivé disparaît de toute requête
pour de bon via la surface API actuelle. Décision du porteur du
projet (AskUserQuestion) : exposer un bouton « Archiver » côté UI
(ADMIN seul), avec confirmation énonçant explicitement l'irréversibilité
actuelle, sans construire le désarchivage ni une liste des projets
archivés (documenté comme lacune séparée, non corrigée cette session).
Voir SEC-040. **SEC-041 trouvée et corrigée (session du 2026-07-19),
gravité `mineur`** : `assertProjectInScope` était dupliqué à
l'identique dans `task.service.ts` et `projectMeeting.service.ts`
(ce dernier l'ayant copié lors de SEC-036) — risque de 3e réécriture
divergente pour un futur module touchant `Project`.
`projectTemplate.service.ts#applyToProject` garde volontairement sa
propre vérification inline (projet déjà chargé, éviter une 2e
requête). De plus, aucun test n'appelait directement
`createProject`/`archiveProject`/`restoreProject` — lacune qui
explique en partie pourquoi SEC-039 n'avait pas été détecté plus tôt.
Corrigé : `assertProjectInScope` factorisé dans
`server/src/utils/serviceScope.ts` (refactor pur, aucun changement de
comportement) ; nouveau test
`server/test/projectCreateArchiveRestore.test.ts` (8 cas, appelle
réellement le service contre une base migrée). Voir SEC-041.
**SEC-042 trouvée et corrigée (session du 2026-07-19), gravité
`mineur`** : SEC-040 a rendu réellement atteignable par un clic un
état (`archivedAt` non nul) jamais déclenchable depuis l'UI
auparavant, exposant deux trous jusque-là purement théoriques.
(1) `task.repository.ts` filtrait `project.deletedAt: null` mais
jamais `archivedAt` — les tâches d'un projet archivé restaient
visibles/glissables dans `/app/tasks` pour tous les rôles, alors que
`assertProjectIsOpenForTaskChanges` rejette déjà toute écriture avec
`409 PROJECT_ARCHIVED`. (2) `project.repository.ts#findById` ne
filtre ni `archivedAt` ni `deletedAt` pour aucun rôle (contrairement
à `findByIdAdmin`) — la fiche d'un projet archivé reste consultable
par lien direct, avec les boutons "Changer de statut"/"Partir du
template" restés actifs (échec 404 silencieux côté serveur). Corrigé :
`archivedAt: null` ajouté au filtre projet dans les 3 méthodes de
lecture de `task.repository.ts` ; `canChangeStatus` et le bouton
template testent désormais `!project.archivedAt` ; texte du dialogue
de confirmation corrigé (ne prétend plus que la fiche disparaît,
seulement les listes). `findById` volontairement non modifié (hors
périmètre de la décision). Nouveau test
`server/test/archivedProjectTaskVisibility.test.ts` (5 cas, appelle
réellement `taskService`/`projectService` contre une base migrée).
Voir SEC-042. **SEC-043 trouvée et corrigée (session du 2026-07-19),
gravité `mineur`** : `projectTemplate.service.ts#applyToProject`
n'avait aucun garde-fou serveur contre une double application — seule
l'UI masquait le bouton, contournable par double-clic/rejeu/appel API
direct, chacun dupliquant tout le lot de tâches. Corrigé : garde
d'idempotence (`409 TEMPLATE_ALREADY_APPLIED` si le projet a déjà des
tâches, via un nouveau `projectRepository.countTasks`). Test ajouté.
Voir SEC-043. **SEC-046 (session du 2026-07-19)** : la route
`POST /projects` n'a plus de consommateur UI depuis SEC-039 et sa doc
Swagger était fausse (`requestBody` omettait `proposalId`, le champ
requis). Doc Swagger corrigée (`proposalId` requis + cascade
expliquée), hook client orphelin `useCreateProject` retiré ; route et
`projectsApi.create` conservés (chemin API bas niveau). Voir SEC-046.
**SEC-055 et SEC-057 résolues (session du 2026-07-19, initialement
`ouvert`)** : rapport développeur full-stack + designer UI/UX sur ce
module. F4 (hook `useCreateProject` mort) déjà résolu par SEC-046 avant
ce rapport, aucune action. SEC-055 (F5+F6) : bouton « Nouvelle tâche »
contextualisé ajouté sur l'onglet Tâches dès que le projet a déjà au
moins une tâche, navigant vers `/app/tasks?projectId=…&openCreate=true`
qui ouvre directement le formulaire de création pré-rempli
(`useTaskActions().openCreateDialogForProject`). `ProjectMeetingsTab.tsx`
gagne édition/suppression (nouvelles routes serveur
`PUT`/`DELETE /:id/meetings/:meetingId`, autorisation auteur-ou-ADMIN —
403 `MEETING_NOT_YOURS` sinon, un MANAGER du même pôle non-auteur ne
peut pas toucher la réunion d'un collègue) et pagination
(`listByProject` accepte `page`/`pageSize` optionnels, comptage Prisma
réel). SEC-057 (U3+U4+U5) : `aria-label` ajoutés aux 3 boutons icône de
`ProjectsPage.tsx#ProjectGrid` (clé `common.view` créée, manquante
jusqu'ici) ; ligne d'aide contextuelle sous le titre de
`ProjectsPage.tsx` pour ADMIN/MANAGER expliquant l'absence du bouton
« Nouveau projet » ; pastille « Prochaine réunion : <date> » dans
l'en-tête de `ProjectDetailPage.tsx` (gap de typage corrigé au passage :
`meetingFrequency`/`nextMeetingDate` absents du type client `Project`
alors que le serveur les renvoyait déjà — même classe de gap que
SEC-040 pour `archivedAt`). Tests réels ajoutés :
`useTaskActions.test.tsx`, `projectMeetingUpdateDelete.test.ts` (7 cas
serveur), `ProjectMeetingsTab.test.tsx` (3 cas), `ProjectsPage.test.tsx`
(2 cas), `ProjectDetailPage.test.tsx` (3 cas). Effet de bord corrigé :
le changement de forme de retour de `listByProject` (tableau →
`{data,total}`) a cassé un test préexistant non écrit cette session
(`managerScopeIdorFixes.test.ts`), adapté à la nouvelle forme sans
toucher son hypothèse métier. `verifie: test`. SEC-058 (`info`) : le
dialogue d'archivage (SEC-046) explicite honnêtement son
irréversibilité — bonne pratique à généraliser, aucune action requise.
**SEC-061 trouvée et résolue (session du 2026-07-19, `faible`)** : le
CLIENT ne voyait son projet qu'à travers une timeline synthétique en 7
étapes et un brief, jamais le détail des tâches. Contenu précisé par le
porteur : tâches DONE uniquement (titre + date), pas le détail complet
(assignee/description/priorité non exposés). Corrigé :
`projectService.getCompletedTasksForClient(id, clientId)` (nouvelle
méthode, distincte de `getTimelineStatus` — celle-ci retourne des
vraies lignes de tâche, pas un résumé synthétique), scope CLIENT via
`where.clientId` (404 si le projet n'appartient pas au client, jamais
une liste vide qui laisserait deviner son existence). Nouvelle route
`GET /projects/:id/completed-tasks` (`authorize("CLIENT")` seul, non
gated par `requireActivatedPortal`, cohérent avec `/timeline-status`).
Nouveau composant `CompletedTasksList.tsx` sous la timeline dans
`ProjectsClientPage.tsx` (ne rend rien si liste vide). Hook
`useProjectCompletedTasks` extrait dans son propre fichier plutôt que
colocalisé (aurait ajouté un 13e cas à l'exception documentée
`react-refresh/only-export-components`, SEC-049 — vérifié par
aller-retour : 13 puis 12 warnings). Invariant de sécurité testé :
un CLIENT ne peut pas lire le projet d'un autre client (404). Tests
réels ajoutés (`clientCompletedTasks.test.ts`, 2 cas serveur ;
`CompletedTasksList.test.tsx`, 3 cas client). `verifie: test`.
**SEC-062 ouverte (session du 2026-07-19, `ouvert`, `info`)** : point
positif confirmé — `project.service.ts#clientApprove` (approbation
client faisant passer le projet à COMPLETED) déclenche automatiquement
une notification `RATING_REQUESTED` vers les managers pour évaluer les
freelances du projet (`rating.service.ts`) ; pattern à répliquer pour
d'autres boucles (ex. NPS client). Aucune action requise.
**SEC-076 trouvée et résolue (session du 2026-07-19, `faible`)** :
revue de code externe sur les correctifs SEC-055/SEC-057 de cette
session, confirmée par lecture directe — le formulaire d'édition
d'une réunion (`ProjectMeetingsTab.tsx`, `editingMeeting`) est rendu
après la liste paginée et sa pagination, sans `scrollIntoView` ni
aucun mécanisme de défilement automatique : sur une liste de
plusieurs pages, cliquer « Modifier » laisse le formulaire hors de la
zone visible sans indication à l'utilisateur qu'il doit défiler.
Corrigé : `ref` sur la `Card` du formulaire d'édition, `useEffect`
appelant `scrollIntoView({ behavior: "smooth", block: "center" })` dès
que `editingMeeting` devient non-null. Test réel ajouté
(`ProjectMeetingsTab.test.tsx`, 1 cas — clique « Modifier », vérifie
l'appel réel à `scrollIntoView`). `verifie: test`. Voir SEC-055,
SEC-057, SEC-058, SEC-061, SEC-062, SEC-076.

### 3.8 Task
Tâche au sein d'un projet. Cycle de vie :
`TODO → IN_PROGRESS → REVIEW → DONE`.
**Statut : IMPLÉMENTÉ. `verifie: schema_seul` — `task.service.ts` non lu
intégralement (grep ciblé AuditLog seulement, voir EXPLORATION.md).**
**SEC-037 (session du 2026-07-18)** : `task.repository.ts` utilisait
`prisma` (primaire) pour ses lectures pures (`findAll`/`findById`/
`existsInCompany`), jamais `prismaRead` — charge inutile sur la base
primaire sur un module à fort trafic (Kanban, listes). Corrigé, les 3
méthodes passées à `prismaRead` (`findByIdAdmin` conservée sur `prisma`,
pré-lecture avant écriture immédiate). Côté client,
`TasksKanban.tsx`/`TasksPage.tsx` corrigés pour la même série de
constats : garde de transition (`ALLOWED_TASK_TRANSITIONS`) ajoutée
avant tout drop, message d'erreur serveur réel remonté au lieu d'un
toast générique, bandeau de troncature ajouté au-delà de 200 tâches en
vue kanban. Voir SEC-037. **SEC-044/SEC-045 trouvées (session du
2026-07-19)** : SEC-044, validation des dates de tâche resserrée —
`task.validator.ts` acceptait tout `Date.parse` (« March 3 »,
« 2024/1/1 »…), incohérent avec le validateur de réunion (ISO strict) ;
alignée sur `YYYY-MM-DD` OU ISO 8601 complet (ce que le client envoie
réellement), formes libres rejetées, test ajouté. SEC-045, la règle
d'exclusivité « un FREELANCER ne peut modifier QUE le `status` de SES
propres tâches » (vivant dans `task.service.ts#updateTask`) n'était
prouvée par aucun test — test d'intégration ajouté (aucun changement
de code, la règle était déjà correcte). `verifie: test` pour ces deux
points. **SEC-047 trouvée et corrigée (session du 2026-07-19,
`mineur`)** : `Task.priority` était modélisé (Prisma/Zod/UI) mais
absent de toute logique métier serveur ; l'approfondissement a montré
que `TasksListView.tsx` rendait déjà un en-tête de tri `priority`
cliquable (non-freelancer) qui retombait silencieusement sur
`createdAt` faute de `priority` dans `SORTABLE_FIELDS`. Décision
produit (AskUserQuestion) : rendre `priority` triable (portée
minimale), sans changer le tri par défaut ; `priority` ajouté à
`SORTABLE_FIELDS` (enum `LOW→NORMAL→HIGH→URGENT`, `desc` = URGENT en
haut), test réel ajouté. `verifie: test`. Voir SEC-044, SEC-045,
SEC-047. **SEC-052 trouvée et corrigée (session du 2026-07-19,
`eleve`)** : le lien « Voir toutes les tâches » depuis la fiche projet
(`/app/tasks?projectId=...`) atterrissait sur la liste COMPLETE non
filtrée — `TasksPage.tsx` ne lisait jamais ce paramètre d'URL, alors
que `useTasks()`/`tasksApi.getAll()`/le serveur le supportent déjà de
bout en bout. Corrigé : `useSearchParams()` lu dans `TasksPage.tsx`,
transmis à `useTasksPageData`/`useTasks`, bandeau visuel du filtre
actif avec bouton de retrait. Test réel ajouté
(`useTasksPageData.test.tsx`). `verifie: test`. Voir SEC-052.
**SEC-054 trouvée et corrigée (session du 2026-07-19, `moyen`)** : le
sélecteur Assigné à (création ET édition de tâche) listait tous les
rôles (y compris CLIENT) sans filtrage, alors que
`task.service.ts#assertAssigneeIsValid` rejette une assignation CLIENT
en 422 `INVALID_ASSIGNEE_ROLE` — découvert seulement après soumission.
Corrigé : nouvelle fonction `filterAssignableUsers`
(`client/src/features/tasks/taskUtils.ts`), appliquée aux deux
dialogues ; `users` non filtré conservé pour `userById`. Test réel
ajouté (`taskUtils.test.ts`). `verifie: test`. Voir SEC-054.
**SEC-053 trouvée et corrigée (session du 2026-07-19, `moyen`)** : le
sélecteur Projet du formulaire de création/édition de tâche
(`pageSize: 100`) devient incomplet et silencieux au-delà de 100
projets actifs. Décision du porteur : bandeau d'avertissement plutôt
qu'un combobox à recherche serveur complet (plus lourd, jugé
disproportionné). Corrigé : `useTasksPageData.ts` expose
`projectsTotal` (le vrai total API, distinct de la page chargée) ;
bandeau affiché sur `TasksPage.tsx` au-delà de 100, même modèle que le
bandeau Kanban existant. Ne résout pas la limite elle-même, seulement
sa visibilité. Test réel ajouté. `verifie: test`. Voir SEC-053.
**SEC-056 trouvée et corrigée (session du 2026-07-19, `moyen`)** :
`TasksListView.tsx` n'offrait qu'un filtre statut + recherche (manquent
projet/assigné/échéance) et utilisait une grille CSS à colonnes fixes
sans variante mobile, contrairement à la grille responsive de
`ProjectsPage.tsx`. Décision du porteur (AskUserQuestion) : « Les deux
(U1 et U2) ». U1 corrigé : filtres `assigneeId`/`overdue` combinables
avec statut/recherche, propagés de bout en bout jusqu'à
`task.repository.ts#buildWhere` (jamais laissés au seul frontend) ;
`ListQueryOptions` (partagé par tous les endpoints de liste)
délibérément non étendu — filtres tâche passés en objet séparé
`taskFilters`, sur le modèle déjà en place pour `projectId` (SEC-052).
Invariant de sécurité vérifié par test dédié : un FREELANCER ne peut
jamais contourner son propre scope (`assigneeId: userId` forcé) via un
`assigneeId` de requête arbitraire. U2 corrigé : table virtualisée
desktop existante conservée intacte (`hidden sm:block`), nouvelle
liste de cartes non virtualisée ajoutée pour l'écran étroit
(`sm:hidden`) — la vue étant déjà paginée à 10/page, la virtualisation
n'était pas nécessaire côté mobile. Tests réels ajoutés
(`TasksListView.test.tsx`, `useTasksPageData.test.tsx` étendu,
`taskAssigneeAndOverdueFilters.test.ts` côté serveur). `verifie: test`.
Voir SEC-056. **SEC-059 trouvée et résolue (session du 2026-07-19,
`faible`)** : un commentaire de tâche n'était jamais modifiable ni
supprimable — `task.routes.ts` ne déclarait que `GET`/`POST` sur
`/tasks/:taskId/comments`, aucune route par `commentId`. Corrigé sur le
modèle de `projectMeetingService.update`/`.delete` (SEC-055/F6) :
nouvelles routes `PUT`/`DELETE /tasks/:taskId/comments/:commentId`,
`commentService.updateComment`/`.deleteComment` avec autorisation
explicite auteur-ou-ADMIN (403 `COMMENT_NOT_YOURS` sinon — un accès
partagé à la tâche ne suffit pas à altérer la remarque d'un autre).
Côté client, `TaskDetailDrawer.tsx` affiche boutons Modifier/Supprimer
par commentaire (masqués si non autorisé, le serveur restant
l'autorité réelle). Tests réels ajoutés
(`taskCommentUpdateDelete.test.ts`, 5 cas serveur ;
`TaskDetailDrawer.test.tsx`, 5 cas client). `verifie: test`. **SEC-060
trouvée et résolue (session du 2026-07-19, `moyen`)** : absence de 6
fonctionnalités PM standard (sous-tâches, dépendances entre tâches, vue
calendrier/Gantt, actions en masse, pièces jointes sur tâche, mentions
@ dans les commentaires) — confirmées absentes par lecture directe du
schéma et du code. Arbitrage de positionnement produit (outil interne
vs concurrent PM généraliste), pas un défaut. Chacun des 6 items reçoit
une décision explicite du porteur : 4 corrigés sous leur propre ID
(pièces jointes, mentions @, actions en masse, sous-tâches — reliés à
SEC-060 par `classe`, jamais fusionnés), 1 corrigé sous SEC-069
(calendrier mensuel simple, voir plus bas), 1 explicitement rejeté sans
correctif (dépendances entre tâches — décision de portée, pas un
défaut). SEC-060 `resolu` sur cette base, aucun des 6 items ne reste
sans réponse. **SEC-064
trouvée et résolue (session du 2026-07-19, `moyen`)** : premier item
retenu — aucune pièce jointe ne pouvait être attachée directement à une
tâche (`Document` avait déjà un `projectId` optionnel, aucun `taskId`).
Corrigé : `Document.taskId` (migration
`20260719190000_add_task_id_to_document`), `Task.documents Document[]`.
Invariant de sécurité découvert et corrigé en cours de route : un
document attaché uniquement à une tâche échappait au scope FREELANCER
existant (`where.project` sur une relation nulle ne matche jamais) —
ajout d'une branche `task.assigneeId`, écrite en `where.AND` pour ne
pas se faire écraser par le `where.OR` de la recherche texte
(`options.search`) plus bas dans la même fonction, testé explicitement.
Nouveau composant `TaskAttachments.tsx` (upload/liste/téléchargement/
suppression), réservé à `!isFreelancer` en attendant SEC-063 (non
résolu : `POST /documents` rejette tout FREELANCER en 403 avant la
logique métier — bug préexistant découvert incidemment, enregistré
séparément, hors périmètre ici). Tests réels ajoutés
(`taskAttachments.test.ts`, 5 cas). `verifie: test`. **SEC-065 trouvée
et résolue (session du 2026-07-19, `moyen`)** : deuxième item retenu —
aucune logique de mention @ n'existait (`comment.service.ts` lu
intégralement, `TaskDetailDrawer.tsx` sans parsing de mention).
Approche tranchée (AskUserQuestion) : autocomplete + identifiant
plutôt que parsing de texte libre — le client insère
`@[Nom](userId)`, le serveur (`utils/mentions.ts`) n'utilise jamais le
nom affiché pour la résolution. Décision de conception affinée en
cours de route après qu'un premier test a révélé une incohérence : le
flux de notification existant couvre déjà tout le monde ayant accès à
la tâche, donc une mention ne peut jamais atteindre quelqu'un de
nouveau — tranché (AskUserQuestion) que le destinataire mentionné
reçoit une seule notification avec le libellé spécifique « Vous avez
été mentionné » au lieu du libellé générique, sans doublon. Invariant
de sécurité testé explicitement : mentionner un utilisateur sans accès
à la tâche n'aboutit à aucune notification pour lui — la liste de
candidats côté client n'est pas la barrière de sécurité réelle, le
serveur revérifie indépendamment. Nouveau composant
`MentionTextarea.tsx` (autocomplete `Popover`), câblé dans
`TaskDetailDrawer.tsx` via `mentionableUsers` (réutilise
`assignableUsers`, déjà calculé pour SEC-054). Tests réels ajoutés
(`mentions.test.ts`, 5 cas ; `taskCommentMentions.test.ts`, 3 cas
d'intégration observant les vrais appels `communicationQueue.addBulk` ;
`MentionTextarea.test.tsx`, 3 cas client). `verifie: test`. **SEC-066
trouvée et résolue (session du 2026-07-19, `moyen`)** : troisième item
retenu — aucune action en masse (sélection multiple + changement de
statut/suppression groupée) n'existait sur la liste des tâches.
Décision de conception centrale : `bulkUpdateStatus`/`bulkDelete`
appellent `updateTask`/`deleteTask` existants une par une en boucle
plutôt que de dupliquer leur logique métier (transitions valides,
scope MANAGER par pôle, restriction FREELANCER) — aucune règle n'est
contournée par le bulk. Traitement « au mieux » (pas de transaction
tout-ou-rien) : rapport détaillé par id (`{id, success, error?}`),
un échec individuel ne bloque pas le reste du lot. Invariant de
sécurité testé explicitement : une tâche hors du pôle d'un MANAGER
échoue individuellement dans le lot sans bloquer les tâches dans son
pôle — le bulk n'élargit jamais son autorité. Nouvelles routes
`POST /tasks/bulk/status`/`POST /tasks/bulk/delete`
(`authorize("ADMIN","MANAGER")`, plafonnées à 100 ids). Côté client :
case à cocher par ligne + « tout sélectionner » dans
`TasksListView.tsx` (vue desktop uniquement), barre d'actions
conditionnelle. Tests réels ajoutés (`taskBulkActions.test.ts`, 4 cas
serveur ; `TasksListViewBulkActions.test.tsx`, 6 cas client, isolé de
`TasksListView.test.tsx` pour ne pas casser ses 2 tests existants qui
s'appuient sur le comportement inverse de virtualisation en JSDOM).
`verifie: test`. **SEC-067 trouvée et résolue (session du 2026-07-19,
`moyen`)** : quatrième et dernier item retenu — aucune sous-tâche
n'existait (`model Task` sans `parentId` ni relation enfant). Trois
décisions de conception tranchées avant tout code (AskUserQuestion) :
un seul niveau (pas d'imbrication récursive), simple checklist (titre
+ fait/pas fait, PAS une entité `Task` complète avec assignee/statut/
échéance propres), aucune règle de complétion automatique du parent
(statuts totalement indépendants). Conséquence directe : nouveau
modèle dédié `TaskChecklistItem` (migration
`20260719193000_add_task_checklist_item`) plutôt qu'un self-reference
`Task.parentId`, pour ne pas laisser croire qu'une sous-tâche est une
vraie tâche. `position` toujours dérivée côté serveur (jamais fiée du
client). Autorisation : même audience que les commentaires
(ADMIN/MANAGER/FREELANCER assigné via `existsInCompany` réutilisé),
mais sans restriction par auteur — checklist partagée, n'importe qui
ayant accès à la tâche peut cocher/modifier/supprimer n'importe quel
item. Isolation cross-tâche testée (modifier/supprimer via un mauvais
`taskId` 404, même garde que SEC-059/SEC-055). Nouveau composant
`TaskChecklist.tsx` (barre de progression purement informative),
câblé dans `TaskDetailDrawer.tsx`. Tests réels ajoutés
(`taskChecklist.test.ts`, 4 cas serveur ; `TaskChecklist.test.tsx`, 4
cas client). `verifie: test`. Les 4 items retenus par le porteur
(SEC-064/065/066/067) sont désormais tous `resolu` ; SEC-060 reste
`ouvert` uniquement pour l'item (2) dépendances entre tâches, non
retenu et sans décision de reprise — ne peut être déclarée `resolu`
tant qu'un item qu'elle décrit reste sans réponse du porteur. Voir
SEC-059, SEC-060, SEC-063, SEC-064, SEC-065, SEC-066, SEC-067.

**SEC-070 trouvée et résolue (session du 2026-07-19, `moyen`)** :
revue de code externe sur les correctifs SEC-055 à SEC-069 de cette
même session, confirmée par lecture directe —
`getCompletedTasksForClient` (SEC-061) dérivait `completedAt` de
`task.updatedAt`, mis à jour par Prisma sur n'importe quelle écriture
de la ligne, pas seulement le passage à DONE : une correction
ultérieure du titre d'une tâche déjà terminée aurait silencieusement
avancé la date de complétion affichée au CLIENT. Corrigé : nouveau
champ `Task.completedAt` (migration
`20260719200000_add_task_completedat_comment_editedat`), renseigné
uniquement par `task.service.ts#updateTask` exactement sur la
transition de/vers DONE (jamais sur un autre champ), `updatedAt`
conservé en repli uniquement pour les tâches déjà DONE avant
l'existence du champ. Test réel ajouté
(`clientCompletedTasks.test.ts`, 1 cas : édite le titre d'une tâche
déjà DONE via le vrai `taskService.updateTask`, prouve que la date
visible au client ne bouge pas). `verifie: test`.
**SEC-071 trouvée et résolue (session du 2026-07-19, `faible`)** :
même revue — un commentaire de tâche édité (SEC-059) était
indiscernable d'un commentaire original, `model Comment` n'ayant
aucun champ `updatedAt`/`editedAt`. Significatif car un ADMIN peut
éditer le commentaire de n'importe qui sans qu'aucune traçabilité de
la modification ne soit visible pour les autres collaborateurs.
Corrigé : `Comment.editedAt` (même migration que SEC-070), renseigné
par `commentRepository.update` à chaque édition, affiché dans
`TaskDetailDrawer.tsx` (« (modifié) », titre HTML = date/heure
exacte). Tests réels ajoutés (`taskCommentUpdateDelete.test.ts`, 1
cas serveur — prouve qu'éditer un commentaire ne marque jamais un
autre ; `TaskDetailDrawer.test.tsx`, 2 cas client). `verifie: test`.
**SEC-072 trouvée et résolue (session du 2026-07-19, `faible`)** :
même revue, et infirmée dans sa formulation initiale — le commentaire
de code de `TaskAttachments.tsx` citait SEC-063 pour justifier
`canUpload={!isFreelancer}`, alors que SEC-063 est résolue depuis
cette même session (FREELANCER est bien autorisé côté route). Vérifié
qu'il ne s'agit pas d'un vrai bug de permission : la restriction
provient du fait que ce composant envoie toujours `type: "OTHER"`,
incompatible avec la garde service `FREELANCER_DELIVERABLE_ONLY`
(`document.service.ts#create`), pas d'un problème d'autorisation de
route. Corrigé : commentaire réécrit pour citer SEC-072 et décrire la
cause réelle, aucun changement de comportement. `verifie: code_direct`
(le commentaire est la seule chose modifiée, comportement déjà
correct et déjà couvert par les tests SEC-063/SEC-068 existants).
Voir SEC-070, SEC-071, SEC-072.

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
classe de défaut SEC-012 ici. **SEC-051 trouvée et corrigée (session du
2026-07-19), gravité `mineur`** : le formulaire questionnaire du
portail client (`QuestionnaireStep`, `ClientOnboardingPage.tsx`)
envoyait ses réponses dynamiques (`companyName`/`colors`/etc.) au
top-level du payload de mutation, alors que
`clientOnboarding.repository.ts#updateQuestionnaire` ne persiste que
`serviceType`/`isDraft`/un champ imbriqué `data` jamais envoyé par le
client — toutes les réponses saisies étaient silencieusement perdues,
sans erreur visible. Découvert en retirant un `any` sur les props du
composant pendant le nettoyage lint (SEC-049). Corrigé : `data: fields`
au lieu de `...fields`. Test réel ajouté
(`ClientOnboardingPage.test.tsx`). `verifie: test`. Voir SEC-051.

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
**SEC-063 et SEC-068 résolues (session du 2026-07-19, gravité `majeur`
et `bloquant`)** : SEC-063, l'onglet « Mes livrables » (FREELANCER)
appelait `POST /documents`, mais cette route était `authorize("ADMIN",
"MANAGER")` seul — un FREELANCER recevait systématiquement 403 avant
même `requirePermission`, jamais atteignable via ce flux. Corrigé :
`FREELANCER` ajouté à `authorize(...)`, garde d'autorisation ajoutée
dans `documentService.create` (nouveau paramètre `viewer`) — un
FREELANCER ne peut créer qu'un `type: "DELIVERABLE"` sur un projet où
il a une tâche assignée (403 sinon), `requirePermission` seul ne
faisant rien pour les rôles non-MANAGER. SEC-068, découverte
incidemment en corrigeant SEC-063 : `documentBaseSchema` n'avait pas
de champ `title`, alors que `Document.title` est requis sur le modèle
Prisma — Zod retirait silencieusement `title` du body avant le
contrôleur (confirmé empiriquement), affectant TOUTE création de
document via cette route (ADMIN/MANAGER inclus, pas seulement le
dépôt de livrable). Corrigée dans la même passe (sans quoi le
correctif SEC-063 n'aurait jamais fonctionné réellement) : `title`
ajouté et requis dans `documentBaseSchema`. Test réel ajouté
(partagé) : `server/test/documentCreateHttp.test.ts`, 4 cas via
`supertest` contre la vraie route HTTP `POST /documents` — le premier
cas prouve spécifiquement que `title` survit à la validation (aucun
test existant n'exerçait la vraie route HTTP, contrairement aux
appels directs au service qui contournaient le bug). `verifie: test`.
Voir SEC-063, SEC-068.

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
**SEC-036 trouvée et corrigée (session du 2026-07-18)** : 4 failles IDOR
supplémentaires signalées par le porteur du projet — `projectMeeting
.service.ts` (réunions, cadence de rappel) sans aucun scope de pôle ;
`projectTemplate.service.ts#applyToProject` sans vérification que
`project.serviceId` correspond au Manager ; `GET /:id/timeline-status`/
`GET /:id/brief` sans `authorize()` ; et un 4e trou trouvé en vérifiant
ce dernier point — `getBrief`/`getTimelineStatus` ne scopaient
explicitement que CLIENT/FREELANCER, jamais MANAGER. Les 4 corrigés dans
la même passe : `assertProjectInScope` (pattern identique à
`task.service.ts`) ajouté à `projectMeeting.service.ts` ; vérification
directe du `serviceId` déjà chargé dans `applyToProject` ;
`authorize("ADMIN","MANAGER","CLIENT","FREELANCER")` ajouté aux 2 routes
en filet de sécurité ; filtre `where.serviceId` ajouté pour MANAGER dans
`getBrief`/`getTimelineStatus`. Voir SEC-036.

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
| **2026-07-18** | **SEC-035 ouverte et résolue dans la même session : les onglets Actif/Terminé du détail Freelancer (`ProjectsPage.tsx`) étaient calculés par `.filter()` sur une seule page paginée (12 éléments) de `useProjects`, pendant que la pagination affichée en bas de page portait sur le total réel non filtré — deux logiques de pagination incompatibles sur le même écran. Un freelance avec plus de 12 projets avait des compteurs et un contenu de sous-onglet faux (un projet « Terminé » sur la page 2 n'apparaissait jamais tant qu'on n'y naviguait pas manuellement). Root cause : `buildWhere` (serveur) ne supportait qu'un filtre `status` unique, incapable d'exprimer « Actif » (3 statuts). Corrigé : nouveau paramètre `statusIn?: ProjectStatus[]` sur `findAll`/`getAllProjects` (en plus du filtre générique partagé, jamais un remplacement) ; chaque sous-onglet devient sa propre requête `useProjects` indépendamment paginée (état local par onglet), la pagination générique masquée pour le rôle Freelancer. Nouveau test `projectStatusInFilter.test.ts`, 2 cas, appelle réellement `projectRepository.findAll` contre une base migrée — confirme le filtrage ET la pagination indépendante (parcours page par page prouvant qu'aucun projet n'est silencieusement perdu).** | **Constat détaillé signalé directement par le porteur du projet, session du 2026-07-18 — enregistré et corrigé immédiatement conformément à CLAUDE.md. Décision d'approche (AskUserQuestion) : « Ajouter un filtre `statusIn` côté serveur, deux requêtes séparées côté client par sous-onglet (Recommandé) », plutôt qu'un contournement fragile (augmenter le pageSize). Limite de vérification signalée : aucun outil de navigateur disponible pour confirmer visuellement le rendu — vérification de niveau code uniquement. `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **SEC-036 ouverte et résolue dans la même session : 4 failles IDOR signalées par le porteur du projet sous casquette « ingénieur sécurité ». (1) `projectMeeting.service.ts` (réunions, cadence de rappel) sans aucun scope MANAGER — corrigé via `assertProjectInScope`, pattern identique à `task.service.ts`. (2) `projectTemplate.service.ts#applyToProject` sans vérification `project.serviceId` — corrigé par comparaison directe (projet déjà chargé). (3) `GET /:id/timeline-status`/`GET /:id/brief` sans `authorize()`, filet de sécurité absent — corrigé, `authorize("ADMIN","MANAGER","CLIENT","FREELANCER")` ajouté. (4) 4e trou trouvé en vérifiant le point 3, non signalé initialement : `getBrief`/`getTimelineStatus` ne scopaient explicitement que CLIENT/FREELANCER, jamais MANAGER — un Manager pouvait lire le brief (objectifs/budget potentiellement confidentiels) et la timeline de n'importe quel projet hors de son pôle. Corrigé par ajout du filtre `where.serviceId` pour MANAGER. Nouveau test `managerScopeIdorFixes.test.ts`, 5 cas, appelle réellement les 4 services contre une base migrée. Bug de test trouvé et corrigé en cours de route : `managerAScope` déclaré `const` au niveau module capturait `serviceA` avant son assignation par `before()` (toujours `undefined`), masquant un faux positif — détecté par le test "same-pole" qui échouait à tort, corrigé en le transformant en fonction.** | **Signalement direct et détaillé du porteur du projet, session du 2026-07-18, 3 constats fournis + 1 trouvé en vérifiant. Décision de portée (AskUserQuestion) : « Corriger les 4 dans la même passe (Recommandé) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **SEC-037 ouverte et résolue dans la même session : constats de qualité de code signalés par le porteur du projet, casquette « ingénieur full-stack ». Le plus grave, trouvé en vérifiant : `project.repository.ts` faisait `import { prismaRead as prisma }` puis utilisait cet alias pour TOUT — y compris les écritures. Si un vrai réplica en lecture seule est un jour branché, toutes les écritures sur `Project` échoueraient (invisible actuellement, aucun réplica configuré). Corrigé : `prisma`/`prismaRead` séparés proprement, écritures et pré-lectures-avant-écriture sur `prisma`, lectures pures sur `prismaRead`. `task.repository.ts` (lectures pures sur `prisma` au lieu de `prismaRead`, charge inutile sur un module à fort trafic) et `projectProgress.ts` (requête brute jamais sur réplica) corrigés de la même façon. Côté client : Kanban de tâches accepte désormais un rejet visuel immédiat pour une transition non autorisée (avant tout appel réseau), remonte le message serveur réel en cas d'échec au lieu d'un toast générique ; bandeau de troncature ajouté au-delà de 200 tâches en vue kanban ; commentaire explicite ajouté sur le cast de `getFreelancerAvailability` documentant sa dépendance au middleware de validation. Nouveau test `prismaReadWriteSeparation.test.ts`, scan structurel du code source réel (aucun réplica configuré dans cet environnement, un test comportemental ne pourrait pas distinguer les deux clients). Observations positives du rapport non modifiées : transactions de `clientApprove` (bonne défense contre les races) et machine à états centralisée dans `shared/` — aucune action requise.** | **Signalement direct du porteur du projet, session du 2026-07-18, mélange de constats à corriger et d'observations positives à saluer sans y toucher. Décisions de portée (AskUserQuestion) : « Corriger les 3 dans la même passe » (lecture DB) et « Corriger les 3 dans la même passe » (UX/typage). Limite de vérification signalée : aucun outil de navigateur disponible pour confirmer visuellement le rejet de transition et le bandeau de troncature. `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **SEC-038 ouverte et résolue dans la même session : ProjectsPage.tsx#useProjectTrash était appelée inconditionnellement, même pour le rôle FREELANCER, alors que GET /projects/trash est gardée authorize("ADMIN", "MANAGER") côté serveur — chaque ouverture de la page par un Freelancer déclenchait une requête garantie 403, pour un bloc de rendu (section Corbeille) lui-même affiché sans condition de rôle. Corrigé : useProjectTrash accepte désormais un paramètre enabled (pattern déjà établi ailleurs dans le même fichier), appelé avec !isFreelancer ; le bloc JSX correspondant enveloppé de la même condition, cohérent avec le traitement déjà fait pour la pagination générique du même fichier (SEC-035).** | **Trouvé en vérifiant un rapport "casquette Product Owner" du porteur du projet, qui mentionnait en passant "appel trash inutile" pour le Freelance parmi une liste de priorités — jamais isolé comme anomalie distincte jusqu'ici, enregistré et corrigé immédiatement conformément à CLAUDE.md. Limite de vérification signalée : aucun outil de navigateur disponible pour confirmer visuellement l'absence de la section pour un compte Freelancer réel. `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **SEC-039 ouverte et résolue dans la même session, gravité `bloquant` : le bouton « Nouveau projet » (`ProjectsPage.tsx`) était 100% non fonctionnel — `createProjectSchema` (validateur serveur) exige `proposalId` (UUID) obligatoire et `createProject` (service) rejette 404/422 si absent ou proposition non `ACCEPTED`, mais le formulaire client utilisait le schéma partagé `@secritou/shared` (sans `proposalId`, confirmé) et aucun champ ne le collectait — vérifié de bout en bout (formulaire → hook → API → validateur → service), seul appelant de ce chemin dans tout le dépôt. Cause racine confirmée par lecture directe : le vrai flux métier passe par `proposal.service.ts#acceptWithCascade` (création automatique du projet à l'acceptation d'une proposition), la création directe via `POST /projects` étant un vestige d'une version antérieure jamais mis à jour. Retiré : bouton, dialogue, formulaire de création, handler, permission associée et imports morts — formulaire d'édition (sur projet existant) intact. Route serveur volontairement non touchée (disponible pour un futur usage programmatique).** | **Signalement direct et détaillé du porteur du projet, avec analyse de cause racine déjà fournie et deux options explicitement proposées « à trancher avec le PO ». Décision (AskUserQuestion, session du 2026-07-18) : « Retirer le bouton/dialogue (Recommandé) » plutôt que réparer le formulaire avec un sélecteur de proposition (2e option, non retenue). `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-18** | **SEC-040 ouverte et résolue dans la même session, gravité `mineur` : `ProjectStatus` n'a délibérément aucune valeur `CANCELLED` (design documenté par commentaire dans `schema.prisma`, lignes 25-27) — un projet abandonné est représenté via `archivedAt`. Le mécanisme existe côté serveur (`POST /:id/archive`, `authorize("ADMIN")`) mais n'apparaissait nulle part dans l'UI (`ProjectDetailPage.tsx`/`ProjectsPage.tsx`, zéro occurrence confirmée par grep), et contrairement à `deletedAt` (`restore` + `GET /projects/trash`), `archivedAt` n'a aucun chemin retour : `findAll`/`findById`/`findByIdAdmin` (`project.repository.ts`) filtrent tous inconditionnellement `archivedAt: null`, donc un projet archivé disparaît de toute requête pour de bon via la surface API actuelle. Corrigé côté UI uniquement : bouton « Archiver » (ADMIN seul) sur `ProjectDetailPage.tsx`, `useArchiveProject()` (hook), `archive()` (API client), champ `archivedAt` ajouté au type `Project` client (gap de typage découvert en cours de correctif), confirmation explicite énonçant l'irréversibilité actuelle, clés i18n FR/EN ajoutées. Désarchivage et liste des projets archivés explicitement hors périmètre (documentés, non corrigés, sur décision du porteur). `npx tsc --noEmit` vert, lint 0 erreur (warnings pré-existants uniquement), build réussi, i18n-check vert.** | **Rapport « 2.2 Cohérence des statuts et des transitions » (casquette revue de conception), section « Absence d'état « Annulé » ». Décision (AskUserQuestion, session du 2026-07-18) : « Exposer l'archivage côté UI, sans construire le désarchivage/la liste (Recommandé minimal) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie. Limite de vérification signalée : aucun navigateur disponible, vérification de niveau code uniquement.** |
| **2026-07-19** | **SEC-041 ouverte et résolue dans la même session, gravité `mineur` : `assertProjectInScope` dupliqué à l'identique dans `task.service.ts` et `projectMeeting.service.ts` (ce dernier l'ayant copié lors de SEC-036) — risque de 3e réécriture divergente pour un futur module touchant `Project`. `projectTemplate.service.ts#applyToProject` garde volontairement sa propre vérification inline (projet déjà chargé, éviter une 2e requête), confirmé par lecture directe de son commentaire existant. Recherche exhaustive dans `server/test/` confirme aussi qu'aucun test n'appelait directement `createProject`/`archiveProject`/`restoreProject` — lacune expliquant en partie pourquoi SEC-039 n'avait pas été détecté plus tôt (les tests existants validaient `createProject` avec un `proposalId` valide fourni directement, jamais le payload réel du formulaire). Corrigé : `assertProjectInScope` factorisé dans `server/src/utils/serviceScope.ts` (refactor pur, aucun changement de comportement, import `HttpError` devenu inutile retiré de `projectMeeting.service.ts`) ; nouveau test `server/test/projectCreateArchiveRestore.test.ts` (8 cas : rejets 404/422 sur `createProject`, succès depuis un proposal `ACCEPTED`, forçage du `serviceId` au pôle du MANAGER, `archiveProject`/`restoreProject` couvrant l'indépendance des deux axes `archivedAt`/`deletedAt`), appelle réellement le service contre une base migrée. 314/314 tests verts (272 précédents + 8 nouveaux), typecheck serveur vert, lint 0 erreur (aucun nouveau warning sur les 4 fichiers touchés).** | **Rapport "2.3 Autorisations et scoping (RBAC)" et "2.6 Couverture de tests" (casquette revue de conception), tous deux confirmés intégralement par lecture directe avant action. Décision (AskUserQuestion, session du 2026-07-19) : « Factoriser assertProjectInScope (Recommandé) » ET « Ajouter les tests manquants (Recommandé) », les deux retenues. `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-042 ouverte et résolue dans la même session, gravité `mineur` : SEC-040 (bouton "Archiver") a rendu réellement atteignable par un clic un état (`archivedAt` non nul) jamais déclenchable depuis l'UI auparavant, transformant deux trous jusque-là purement théoriques en incohérences réelles. `task.repository.ts#buildWhere`/`findById`/`existsInCompany` filtraient `project.deletedAt: null` mais jamais `archivedAt` (zéro occurrence confirmée par grep) — les tâches d'un projet archivé restaient visibles/glissables dans `/app/tasks` pour ADMIN/MANAGER/le FREELANCER assigné, alors que `assertProjectIsOpenForTaskChanges` rejette déjà toute écriture avec `409 PROJECT_ARCHIVED` : une carte pouvait être vue et glissée pour un rejet serveur invisible à l'écran. `project.repository.ts#findById` (GET /projects/:id) ne filtre ni `archivedAt` ni `deletedAt` pour aucun rôle (contrairement à `findByIdAdmin`, réservé au chemin d'écriture) — la fiche d'un projet archivé restait consultable par lien direct, contredisant le texte du dialogue de confirmation ; sur cette fiche, `canChangeStatus` ne testait que `project.status !== "COMPLETED"`, jamais `archivedAt`, et le bouton "Partir du template" avait la même lacune — les deux aboutissant à un rejet 404 silencieux côté serveur. Corrigé : `archivedAt: null` ajouté au filtre projet dans les 3 méthodes de lecture de `task.repository.ts` (`findByIdAdmin`, chemin d'écriture, volontairement inchangé) ; `canChangeStatus`/bouton template testent désormais `!project.archivedAt` ; texte du dialogue de confirmation corrigé (ne prétend plus que la fiche disparaît, seulement les listes projets/tâches). `project.repository.ts#findById` volontairement non modifié — hors périmètre de la décision retenue. Nouveau test `server/test/archivedProjectTaskVisibility.test.ts` (5 cas : `getAllTasks` exclut la tâche pour ADMIN/MANAGER/FREELANCER, `getTaskById` 404, `getProjectById` continue de renvoyer le projet archivé lui-même — asymétrie documentée), appelle réellement les services contre une base migrée. 319/319 tests verts (314 précédents + 5 nouveaux), typecheck/lint/build propres des deux côtés, i18n-check vert.** | **Rapport de suivi du porteur du projet sur le correctif SEC-040 lui-même ("1.3 État « projet abandonné » (reformulé)" + "2. Nouvelles anomalies trouvées"), confirmé intégralement par lecture directe avant action. Décision (AskUserQuestion, session du 2026-07-19) : « Corriger les 2 dans la même passe (Recommandé) ». `resolu` déclaré SANS confirmation CI : la CI est actuellement désactivée sur `origin/main` sur demande du porteur (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie. Limite de vérification signalée : aucun navigateur disponible, vérification de niveau code uniquement pour la partie UI.** |
| **2026-07-19** | **Rapport backend/sécurité (B1-B6) : 6 constats, tous confirmés par lecture directe avant action, ouverts en SEC-043 à SEC-048. SEC-043 (`mineur`, résolu) : `applyToProject` sans garde-fou serveur d'idempotence — double-clic/rejeu/appel API direct dupliquait tout le lot de tâches du template ; garde `409 TEMPLATE_ALREADY_APPLIED` ajouté (via `projectRepository.countTasks`), test d'intégration réel. SEC-044 (`mineur`, résolu) : dates de tâche acceptaient tout `Date.parse` vs ISO strict pour les réunions ; approfondissement décisif — les 2 clients utilisent `<input type=date>` mais seul le client réunion convertit en ISO, donc resserrer naïvement aurait cassé les tâches ; aligné sur `YYYY-MM-DD` OU ISO complet (décision porteur AskUserQuestion), test réel sur `createTaskSchema.safeParse`. SEC-045 (`mineur`, résolu) : règle d'exclusivité « FREELANCER ne modifie QUE le `status` de SES tâches » non prouvée par aucun test (CLAUDE.md exige `verifie: test` pour une règle négative) ; test d'intégration ajouté, aucun changement de code. SEC-046 (`mineur`, résolu) : route `POST /projects` sans consommateur UI depuis SEC-039 + doc Swagger factuellement fausse (`requestBody` omettait `proposalId`, requis) ; Swagger corrigé, hook orphelin `useCreateProject` retiré, route/API conservées. SEC-047 (`mineur`, `ouvert`) : `Task.priority` modélisé mais purement déclaratif (aucun tri/notification/règle) — usage voulu à trancher, décision produit non déduite. SEC-048 (`mineur`, `ouvert`) : scoping MANAGER par pôle = source répétée d'oublis d'autorisation sur ce module (prémisse confirmée par les 4 trous de SEC-036) — recommandation de checklist de revue, livrable de process à formaliser avec le porteur. 330/330 tests verts (319 + 11 nouveaux), typecheck/lint/build propres des deux côtés.** | **Rapport détaillé du porteur du projet, casquette backend/sécurité, session du 2026-07-19. Décisions (AskUserQuestion) : B1 garde serveur 409 ; B2 corriger Swagger + retirer hook orphelin ; B4 accepter YYYY-MM-DD explicitement des 2 côtés ; B5 ajouter le test ; B3/B4/B6 documenter comme anomalies. `resolu` (SEC-043/044/045/046) déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie. SEC-047/048 laissées `ouvert` : décisions produit/process non tranchées, à ne pas déduire.** |
| **2026-07-19** | **SEC-047 et SEC-048 résolues (initialement `ouvert`, décisions produit/process rendues dans la même session). SEC-047 : décision « Rendre "priority" triable (portée minimale) » — l'approfondissement a révélé que `TasksListView.tsx:138` rendait DÉJÀ un en-tête de tri `priority` cliquable (non-freelancer) qui retombait silencieusement sur `createdAt`, le serveur ne listant pas `priority` dans `SORTABLE_FIELDS` ; ce n'était donc pas qu'une donnée inerte mais une interaction morte. `priority` ajouté à `SORTABLE_FIELDS` (`task.repository.ts`) ; enum `Priority` déclaré `LOW→NORMAL→HIGH→URGENT`, donc `orderDir desc` remonte URGENT ; tri par défaut inchangé (reste `createdAt`). Test `taskPrioritySort.test.ts` appelant réellement `taskService.getAllTasks` avec `orderBy=priority` (URGENT avant LOW confirmé). Options plus lourdes écartées par le porteur (tri par défaut par priorité ; alerte URGENT en retard). SEC-048 : décision « Section dédiée dans CLAUDE.md » — checklist de revue ajoutée à CLAUDE.md (« Checklist de revue — scoping des routes Project/Task »), imposant de répondre explicitement, au niveau service, aux 3 questions CLIENT/MANAGER(pôle)/FREELANCER(assignation) pour toute route Project/Task nouvelle ou modifiée, avec renvoi à `assertProjectInScope`. CLAUDE.md étant chargé à chaque session, la checklist est au chemin de toute revue future. 331/331 tests verts, typecheck/lint serveur propres.** | **Réponses du porteur du projet aux deux points laissés `ouvert` par le rapport backend/sécurité (AskUserQuestion, session du 2026-07-19) : « Rendre "priority" triable (Recommandé) » et « Section dédiée dans CLAUDE.md (Recommandé) ». SEC-047 `resolu` SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie. SEC-048 `resolu` = livrable de documentation (checklist dans CLAUDE.md), sans code ni test.** |
| **2026-07-19** | **Nettoyage lint serveur (SEC-049, `en_cours`) sur demande du porteur (« je ne veux aucun warning… avant ») : règle « zéro warning lint » ajoutée à CLAUDE.md, puis 165 → 65 warnings. Supprimés : 38 no-unused-vars (imports morts `COMPANY_ID`×11/`HttpError`×3 du refactor mono-tenant, mocks write-only, redéclarations en double, `_`-préfixes), 3 prefer-const, et ~59 no-explicit-any typés proprement (matrice de permissions `PermissionMatrix`, `req.freelancerId`/`req.rawBody`/`req.id` via augmentation `express.d.ts`, narrowing d'erreurs, accès de relations Prisma déjà typés par leurs `select`, interop ioredis/bullmq et tx-client d'extension Prisma via casts `unknown`/types dérivés documentés). Restent 65 warnings : 64 dans les tests (mocks `any`, à traiter) + 1 seul en production, volontairement conservé. SEC-050 ouverte (`ouvert`) : ce dernier `any` (`AuthRepository#db`) masquait un vrai bug — `auth.repository.ts#userPublicSelect` n'inclut PAS `phone`, alors que `toAuthUser` et le type client `AuthUser` le promettent, donc login/register/refresh renvoient toujours `phone: undefined`. Conformément à la règle SEC-049 (« un any qui masque un vrai défaut se remonte en anomalie, ne se répare pas en douce »), le bug n'est PAS corrigé en passant (ajouter `phone` au select changerait la réponse auth — décision produit) ; le `any` reste, tracé, SANS `eslint-disable`. 331/331 tests verts, typecheck propre.** | **Instruction du porteur du projet, session du 2026-07-19 (« ajouter cette regle dans claude.md je ne veux pas aucun warning de ce type de rien avant »). Choix de portée (AskUserQuestion) : « Tout, y compris les any de production ». SEC-050 découverte en cours de nettoyage, laissée `ouvert` pour décision produit — non tranchée. `resolu` non déclaré : SEC-049 reste `en_cours` tant que le compte n'est pas à zéro des deux côtés (tests + le blocage SEC-050).** |
| **2026-07-19** | **SEC-051 ouverte et résolue dans la même session, gravité `mineur` : le formulaire questionnaire du portail client (`QuestionnaireStep`, `ClientOnboardingPage.tsx`) envoyait `{ serviceType, ...fields, isDraft }` — les réponses dynamiques par type de service (`companyName`/`colors`/`references`/`pages` pour "website", équivalents pour "marketing"/"analytics") spread au top-level du payload de mutation. Or `clientOnboarding.repository.ts#updateQuestionnaire` ne persiste que `serviceType`/`isDraft`/un champ imbriqué `data` que le client n'envoyait JAMAIS (`updateData.data` n'est renseigné que si `data.data !== undefined`). Confirmé par recherche exhaustive : `questionnaire.data` n'est lu nulle part côté client non plus (ni pré-remplissage ni affichage). Un client remplissant le questionnaire voyait donc ses réponses acceptées sans erreur, mais silencieusement jetées — jamais sauvegardées, jamais réaffichées. Découvert en retirant un `any` sur les props de `QuestionnaireStep` (`step: any, updateQuestionnaire: any, t: any`) pendant le nettoyage lint (SEC-049) — le typage a fait apparaître le défaut à la lecture du code, TypeScript lui-même ne le détecte pas (un spread dans un objet littéral passé à une fonction typée échappe à la vérification stricte des propriétés en excès). Corrigé : `data: fields` au lieu de `...fields`, alignant le client sur ce que le serveur persiste déjà. Pré-remplissage de `fields` depuis `questionnaire.data` au montage volontairement PAS ajouté (fonctionnalité additionnelle distincte, hors périmètre). Test réel ajouté : `client/src/features/client-onboarding/ClientOnboardingPage.test.tsx` (nouveau fichier), rend le composant `QuestionnaireStep` réel (exporté à cette occasion) et vérifie sur 2 cas (soumission, brouillon) que le payload contient `data` et jamais les champs au top-level. 24/24 tests client verts (2 nouveaux), typecheck et build client propres.** | **Décrit précisément par l'assistant en cours de nettoyage lint (SEC-049), soumis au porteur du projet via AskUserQuestion : « Corriger maintenant : envelopper fields sous data (Recommandé) » — plutôt que documenter sans corriger ou ignorer. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-049 clôturée (`resolu`) : nettoyage lint complet des deux workspaces, sur demande explicite du porteur (« je ne veux aucun warning… avant »). Serveur : 165 → 0 warning (38 no-unused-vars, 3 prefer-const, 124 no-explicit-any tous éliminés proprement — augmentation Express pour `req.freelancerId`/`rawBody`/`id`, interop ioredis/bullmq via types dérivés documentés, relations Prisma déjà typées par leurs `select`). Client : 152 → 12 warnings (60 no-unused-vars, 75 no-explicit-any, 5 react-hooks/exhaustive-deps tous éliminés ; 12 react-refresh/only-export-components documentés comme exception acceptée dans CLAUDE.md — 6 fichiers shadcn/ui vendor + 6 fichiers applicatifs hook/composant colocalisés, impact dev-only). Deux bugs réels découverts en retirant des `any` qui les masquaient, tous deux tranchés par le porteur puis corrigés avec test réel plutôt que réparés en douce : SEC-050 (`phone` incohérent entre les 3 chemins auth — login/register/refresh l'omettaient, `GET /auth/me` le renvoyait déjà ; rendu cohérent = présent partout) et SEC-051 (questionnaire d'onboarding client : réponses dynamiques envoyées au top-level du payload au lieu d'être imbriquées sous `data`, silencieusement jamais persistées ; corrigé par `data: fields`). 333/333 tests serveur verts, 24/24 tests client verts (2 nouveaux pour SEC-051), typecheck et build propres des deux côtés sur l'ensemble des ~8 commits de ce nettoyage.** | **Instruction du porteur du projet, session du 2026-07-19. Choix de portée (AskUserQuestion) : « Tout, y compris les any de production » puis « Tout le client jusqu'à 0 ». Décisions ponctuelles rendues en cours de route pour SEC-050 (« Rendre phone cohérent = présent partout »), SEC-051 (« Corriger maintenant : envelopper fields sous data ») et l'exception react-refresh (« Laisser les 12, documenter comme exception »). `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **Rapports développeur full-stack (F1-F6) et designer UI/UX (U1-U6) sur le module Project/Task : 12 constats, tous confirmés par lecture directe avant action. SEC-052 ouverte et résolue dans la même session, gravité `eleve` : le lien « Voir toutes les tâches » (`/app/projects/:id` → `/app/tasks?projectId=...`) atterrissait sur la liste COMPLÈTE non filtrée — `useListParams.ts` ne lit jamais `projectId`, `TasksPage.tsx` n'appelait `useSearchParams()` nulle part, et `useTasksPageData`/`useTasks(listParams)` n'étaient appelés qu'avec un seul argument — alors que `useTasks(params, projectId?)` et `tasksApi.getAll(params, projectId?)` supportent déjà ce second paramètre de bout en bout (serveur inclus, `task.repository.ts#buildWhere` l'honore déjà). Corrigé : `projectId` lu via `useSearchParams()`, transmis jusqu'à `useTasks`, bandeau visuel « Filtré sur le projet : <nom> » avec bouton de retrait (au-delà du strict nécessaire, pour que le filtre actif soit visible). Test réel ajouté (`useTasksPageData.test.tsx`, 2 cas, `renderHook` + mock `apiClient.get`, prouve que `projectId` atteint la vraie requête HTTP). F4 (hook `useCreateProject` mort) déjà résolu par SEC-046 avant ce rapport. Les 10 autres constats (F2/F3/F5/F6 et U1-U6) ouverts sans correctif sur décision du porteur : SEC-053 (sélecteur projet limité à 100 sans recherche serveur), SEC-054 (sélecteur assigné sans filtre de rôle, CLIENT rejeté seulement après coup par le serveur), SEC-055 (pas de bouton « Ajouter une tâche » contextualisé hors état vide ; réunions sans édition/suppression/pagination, confirmé absent même côté serveur), SEC-056 (filtres de liste des tâches incomplets ; grille non responsive), SEC-057 (aria-label, aide contextuelle, cadence de réunion absente de l'en-tête), SEC-058 (point positif : dialogue d'archivage exemplaire, à généraliser). 26/26 tests client verts (2 nouveaux), typecheck et build propres, i18n FR/EN synchronisé.** | **Rapport détaillé du porteur du projet, casquettes développeur full-stack puis designer UI/UX, session du 2026-07-19. Décision de portée (AskUserQuestion) : « F1 seul, urgent (Recommandé) » — corriger uniquement le bug de sévérité élevée, documenter le reste sans coder. `resolu` (SEC-052) déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-054 et SEC-053 résolues (constats F3 et F2 du rapport développeur full-stack, initialement ouvertes). SEC-054 (`moyen`) : le sélecteur « Assigné à » (création ET édition de tâche) listait tous les rôles y compris CLIENT, alors que `task.service.ts#assertAssigneeIsValid` rejette toujours cette assignation en 422 `INVALID_ASSIGNEE_ROLE` — découvert seulement après soumission. Corrigé : nouvelle fonction `filterAssignableUsers` (`client/src/features/tasks/taskUtils.ts`, colocalisée avec les autres utilitaires du module — pas dans `TasksPage.tsx`, pour ne pas ajouter un 13e cas à l'exception `react-refresh` déjà actée en SEC-049), appliquée aux deux dialogues ; `users` non filtré conservé pour `userById`. Test réel `taskUtils.test.ts` (3 cas). SEC-053 (`moyen`) : le sélecteur Projet (`pageSize: 100`) devenait incomplet et silencieux au-delà de 100 projets actifs. Décision du porteur : bandeau d'avertissement plutôt qu'un vrai combobox à recherche serveur (le serveur supporte déjà `search` sur les projets, donc faisable, mais jugé disproportionné — état de recherche local, requête débouncée, gestion de la valeur sélectionnée hors résultats pour le formulaire d'édition). Corrigé : `useTasksPageData.ts` expose `projectsTotal` (vrai total API, distinct de la page chargée), bandeau affiché sur `TasksPage.tsx` au-delà de 100 sur le même modèle que le bandeau Kanban déjà existant. Ne résout pas la limite elle-même, seulement sa visibilité. Test réel ajouté (bloc supplémentaire dans `useTasksPageData.test.tsx`, réponse API mockée à total:137, confirme que `projectsTotal` vaut bien 137). 30/30 tests client verts (4 nouveaux au total sur les deux constats), typecheck/lint (stable à 12 warnings, l'exception react-refresh documentée)/build propres, `check-i18n.mjs` vert.** | **Réponses du porteur du projet aux points laissés `ouvert` par le rapport développeur full-stack (AskUserQuestion, session du 2026-07-19) : ordre de traitement « SEC-054 (Recommandé) puis SEC-053 » ; pour SEC-053, « Bandeau d'avertissement (Recommandé, rapide) » plutôt que le combobox complet. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-056 résolue (constats U1 et U2 du rapport designer UI/UX, initialement ouverte, `moyen`). U1 : `TasksListView.tsx` n'offrait qu'un filtre statut + recherche, alors que projet/assigné/échéance en retard existent déjà comme dimensions ailleurs dans l'app. Corrigé : filtres `assigneeId`/`overdue` combinables entre eux et avec statut/recherche, propagés de bout en bout (`TasksListView.tsx` → `TasksPage.tsx` via `useSearchParams` → `tasks.api.ts#TaskListFilters`/`useTasks.ts`/`useTasksPageData.ts` → `task.controller.ts` → `task.service.ts` → `task.repository.ts#buildWhere`) — jamais laissés au seul frontend. `ListQueryOptions` (partagé par tous les endpoints de liste) délibérément non étendu ; filtres tâche passés en objet séparé `taskFilters`, sur le modèle déjà en place pour `projectId` (SEC-052). Conflit `overdue`/`options.status` (même clé Prisma `status`) résolu par priorité explicite à `overdue` dans `buildWhere`, doublée côté client d'une désactivation du select statut. Invariant de sécurité vérifié par test dédié : un FREELANCER fournissant l'id d'un autre freelancer en `assigneeId` ne voit toujours que ses propres tâches — l'auto-scope serveur (`assigneeId: userId` forcé) n'est jamais contournable par le paramètre de requête (`server/test/taskAssigneeAndOverdueFilters.test.ts`, 4 cas). U2 : grille CSS à colonnes fixes en pixels sans variante mobile, contrairement à `ProjectsPage.tsx`. Corrigé : table virtualisée desktop existante (`useVirtualizer`, hauteur de ligne fixe 56px) conservée intacte et encapsulée (`hidden sm:block`) ; nouvelle liste de cartes non virtualisée ajoutée pour l'écran étroit (`sm:hidden divide-y`) — la vue étant déjà paginée à 10/page (contrairement au Kanban à 200 tâches), la virtualisation n'était pas nécessaire côté mobile. Clé i18n `tasksPage.noTasksFound` ajoutée (fr/en). Tests réels ajoutés : `TasksListView.test.tsx` (2 cas, rend le composant réel, vérifie les deux conteneurs responsive et le rendu des données côté carte — la table desktop virtualisée ne rend aucune ligne en JSDOM, comportement connu de `@tanstack/react-virtual` en environnement de test sans viewport réel, pas un défaut du correctif) ; `useTasksPageData.test.tsx` étendu de 2 cas (propagation réelle de `assigneeId`/`overdue` jusqu'à la requête HTTP, et leur omission quand absents). Vérification complète : serveur `tsc`/lint (0/0)/337 tests verts ; client `tsc`/lint (12 warnings, exception SEC-049, stable)/34 tests verts/build réussi.** | **Décision du porteur du projet aux constats U1/U2 (« ouii », confirmant la poursuite des constats ouverts, puis AskUserQuestion sur la portée de SEC-056) : « Les deux (U1 et U2) » — plutôt qu'un seul des deux, ou aucun. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-055 (F5+F6) et SEC-057 (U3+U4+U5) résolues (derniers constats ouverts du rapport développeur full-stack + designer UI/UX, initialement `ouvert`). SEC-055/F5 : bouton « Nouvelle tâche » contextualisé ajouté sur `ProjectDetailPage.tsx` (visible dès qu'une tâche existe déjà, ADMIN/MANAGER, projet non archivé), navigue vers `/app/tasks?projectId=…&openCreate=true` ; `TasksPage.tsx` consomme `openCreate` pour ouvrir directement le formulaire de création pré-rempli via une nouvelle fonction `useTaskActions().openCreateDialogForProject` (`openCreateDialog`, déjà exposé par `useCrudDialogState`, n'était simplement pas destructuré jusqu'ici). SEC-055/F6 : `ProjectMeetingsTab.tsx` n'avait aucune édition/suppression de réunion et `project.routes.ts` ne déclarait que GET/POST — confirmé absent même côté serveur. Ajouté : routes `PUT`/`DELETE /:id/meetings/:meetingId`, `projectMeetingService.update`/`.delete` avec autorisation explicite auteur-ou-ADMIN (403 `MEETING_NOT_YOURS` sinon — un MANAGER du même pôle non-auteur ne peut pas toucher la réunion d'un collègue, `requirePermission("projects","update")` seul ne faisait pas cette distinction), `listByProject` accepte `page`/`pageSize` optionnels (comptage Prisma réel, comportement précédent inchangé si omis). Effet de bord découvert et corrigé dans la même passe : le changement de forme de retour de `listByProject` (tableau → `{data,total}`) cassait un test préexistant non écrit cette session (`managerScopeIdorFixes.test.ts`), adapté à la nouvelle forme sans toucher son hypothèse métier — conformément à la règle « un test rouge est une hypothèse sur le code, pas un défaut du test », la cause du rouge (le changement de forme) a été identifiée avant toute édition du test. SEC-057/U3 : `aria-label` ajoutés aux 3 boutons icône de `ProjectsPage.tsx#ProjectGrid` (clé `common.view` créée — manquante, contrairement à `common.edit`/`common.delete` déjà présents) ; `TasksListView.tsx` (bouton "Voir" hardcodé, décision distincte de SEC-056) volontairement non retouché, hors périmètre déclaré de cette anomalie. SEC-057/U4 : ligne d'aide sous le titre de `ProjectsPage.tsx`, ADMIN/MANAGER uniquement, expliquant l'absence du bouton « Nouveau projet » (SEC-039/046). SEC-057/U5 : pastille « Prochaine réunion : <date> » dans l'en-tête de `ProjectDetailPage.tsx` ; gap de typage corrigé au passage (`meetingFrequency`/`nextMeetingDate` absents du type client `Project` alors que le serveur les renvoyait déjà — même classe de gap que SEC-040/`archivedAt`). Tests réels ajoutés : `useTaskActions.test.tsx` (1 cas), `server/test/projectMeetingUpdateDelete.test.ts` (7 cas — auteur peut éditer/supprimer, tiers MANAGER refusé 403 sur les deux opérations avec vérification de non-altération, ADMIN peut tout, 404 hors-projet, pagination + repli non paginé), `ProjectMeetingsTab.test.tsx` (3 cas), `ProjectsPage.test.tsx` (2 cas), `ProjectDetailPage.test.tsx` (3 cas) — tous rendent les vrais composants/services, mockant uniquement les hooks de données ou `apiClient`. 344/344 tests serveur verts (7 nouveaux + 1 préexistant adapté), 43/43 tests client verts (10 nouveaux), typecheck/lint (12 warnings client, exception SEC-049 stable ; 0/0 serveur)/build propres des deux côtés.** | **Réponses du porteur du projet aux deux dernières anomalies ouvertes du rapport combiné (AskUserQuestion, session du 2026-07-19) : portée SEC-055 « F5 et F6 » (les deux, malgré le coût plus élevé de F6 — nouvelle surface API serveur) et portée SEC-057 « Les trois (Recommandé) ». `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **Rapport « 7. Constats détaillés — Product Owner » (P1-P4), 4 constats. P1 (moyen) : 6 fonctionnalités PM standard confirmées absentes par lecture directe (sous-tâches, dépendances, Gantt, actions en masse, pièces jointes tâche, mentions @) — SEC-060 ouverte, arbitrage de positionnement produit, non corrigé. P2 (moyen, « asymétrie des actions irréversibles ») décomposé en 3 points avant toute création d'ID, conformément à l'interdiction de reformulation : (a) archivage sans désarchivage déjà couvert par SEC-040 (décision explicite du porteur, pas rouvert) ; (b) réunion non corrigeable déjà résolu par SEC-055/F6 dans cette même session (donc déjà faux au moment du rapport) ; (c) commentaire de tâche jamais modifiable/supprimable confirmé encore vrai et non couvert — `task.routes.ts` ne déclare que GET/POST sur `/comments`, aucune route par `commentId` — SEC-059 ouverte, non corrigé. P3 (faible) : vue CLIENT limitée à la timeline 7 étapes + brief — SEC-061 ouverte, piste conditionnelle non vérifiée par relecture exhaustive (présentée par le porteur comme arbitrage déjà connu). P4 (info, point positif) : vérifié par lecture directe que `clientApprove` déclenche bien une notification `RATING_REQUESTED` vers les managers à la complétion d'un projet (nuance : le déclencheur exact est `clientApprove`, pas un simple changement de statut générique comme formulé) — SEC-062 ouverte, aucune action requise.** | **Rapport détaillé du porteur du projet, casquette Product Owner, session du 2026-07-19. Décisions de portée (AskUserQuestion) : P2 → « Nouvel ID sur (c) seulement » (les deux autres points déjà couverts, non dupliqués) ; P1 → « Documenter seulement (Recommandé) » ; P3 → « Documenter seulement (Recommandé) ». P4 documenté sans question (point positif, aucune décision de portée nécessaire). Aucun correctif codé cette session — les 4 nouvelles anomalies (SEC-059 à SEC-062) restent `ouvert`.** |
| **2026-07-19** | **SEC-059 résolue (initialement `ouvert`, gravité `faible`). Un commentaire de tâche n'était jamais modifiable ni supprimable — `task.routes.ts` ne déclarait que `GET`/`POST` sur `/tasks/:taskId/comments`, aucune route par `commentId`. Corrigé sur le modèle exact de `projectMeetingService.update`/`.delete` (SEC-055/F6) : `commentRepository.findById`/`update`/`delete` ajoutés, `commentService.updateComment`/`.deleteComment` avec autorisation explicite auteur-ou-ADMIN (404 si le commentaire n'appartient pas à la tâche donnée, 403 `COMMENT_NOT_YOURS` si l'acteur n'est ni l'auteur ni ADMIN — un accès partagé à la tâche, ADMIN/MANAGER/FREELANCER, ne suffit pas à altérer la remarque d'un autre), nouvelles routes `PUT`/`DELETE /tasks/:taskId/comments/:commentId`. Côté client : `comments.api.ts#update`/`.delete`, hooks `useUpdateTaskComment`/`useDeleteTaskComment`, câblés dans `useTaskActions.ts` ; `TaskDetailDrawer.tsx` affiche boutons Modifier/Supprimer par commentaire (masqués si non autorisé), formulaire d'édition inline, `ConfirmDeleteDialog` réutilisé. Écart d'infrastructure de test découvert et documenté (pas corrigé en code) : lancer `taskCommentUpdateDelete.test.ts` isolément reste bloqué ~30s car importer `comment.service.ts` charge `jobs/queues.ts` au niveau module (connexion Redis/BullMQ jamais fermée sans le hook `after()` déjà présent dans `run-all.test.ts`, mécanisme préexistant) — confirmé inoffensif : le fichier tourne normalement dans le run complet (349/349). Tests réels ajoutés : `server/test/taskCommentUpdateDelete.test.ts` (5 cas), `client/src/features/tasks/components/TaskDetailDrawer.test.tsx` (5 cas). 349/349 tests serveur verts (5 nouveaux), 48/48 tests client verts (5 nouveaux), typecheck/lint (12 warnings client, exception SEC-049 stable ; 0/0 serveur)/build propres des deux côtés. `verifie: test`.** | **Instruction directe du porteur du projet (« corriger maintenant »), session du 2026-07-19. Portée précisée via AskUserQuestion : « SEC-059 seul (Recommandé) » — SEC-060 (fonctionnalités PM) et SEC-061 (vue client) explicitement écartés de cette passe, restent `ouvert`. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-063 ouverte : découverte incidente en travaillant sur SEC-064 (pièces jointes sur tâche) — l'onglet « Mes livrables » (FREELANCER) sur `ProjectDetailPage.tsx` appelle `POST /documents`, mais cette route est `authorize("ADMIN", "MANAGER")` seul (`document.routes.ts`, lu directement) : un FREELANCER reçoit systématiquement 403 avant même `requirePermission`, ce bouton échoue donc en production, jamais couvert par aucun test d'intégration réel. Enregistré immédiatement conformément à la règle CLAUDE.md « enregistrement immédiat de tout écart constaté hors d'un audit formel ». Non corrigé cette session : nécessite une décision de conception sur la portée exacte de ce qu'un FREELANCER peut créer, non déductible seul, et hors du périmètre demandé (SEC-060/SEC-064). SEC-064 résolue (gravité `moyen`, initialement sous-item de SEC-060) : `Document.taskId` ajouté (migration Prisma), pièces jointes attachables directement à une tâche via un nouveau composant `TaskAttachments.tsx` dans `TaskDetailDrawer.tsx`. Invariant de sécurité corrigé en cours de route : le scope FREELANCER existant (`documentRepository.findAll`/`.findById`) ne couvrait que les documents attachés via un projet (`where.project`, qui ne matche jamais sur une relation nulle) — un document attaché uniquement à une tâche (sans `projectId`) aurait donc été invisible au freelancer assigné ; corrigé en ajoutant une branche `task.assigneeId`, écrite en `where.AND` (pas `where.OR`, déjà utilisé plus bas par la recherche texte et qui aurait silencieusement écrasé le scope de sécurité si les deux étaient actifs ensemble) — testé explicitement (5 cas, `taskAttachments.test.ts`, incluant scope FREELANCER + recherche texte combinés). Upload/suppression réservés à `!isFreelancer` en attendant la résolution de SEC-063. 354/354 tests serveur verts (5 nouveaux), 48/48 tests client verts (test `TaskDetailDrawer.test.tsx` adapté pour mocker le nouveau composant), typecheck/lint (0/0 serveur ; 12 warnings client, exception SEC-049 stable)/build propres des deux côtés. `verifie: test`.** | **Instruction directe du porteur du projet (« corrige »), session du 2026-07-19, portant sur SEC-060 et SEC-061. Portée précisée via AskUserQuestion : pour SEC-060, 4 items retenus sur 6 (« Pièces jointes sur tâche (Recommandé) », mentions @, actions en masse, sous-tâches), ordre « pièces jointes → mentions @ → bulk → sous-tâches » — item traité ici en premier. SEC-063 non demandée, découverte et enregistrée de façon incidente, non corrigée (hors périmètre). `resolu` (SEC-064) déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-065 résolue (deuxième item de SEC-060, gravité `moyen`) : aucune logique de mention @ n'existait dans les commentaires de tâche. Approche technique tranchée via AskUserQuestion : « Autocomplete + ID cache (Recommandé) » plutôt qu'un parsing de texte libre `@Nom` — jugé ambigu sur des homonymes et cassant sur un nom contenant un espace. Correctif serveur : `utils/mentions.ts#extractMentionedUserIds` (regex ciblée `@[Nom](uuid)`, dédoublonnée, testée en pur — 5 cas) ; `comment.service.ts#createComment` calcule l'intersection des mentions extraites avec l'ensemble des destinataires standard déjà résolus (assignee + ADMIN + MANAGER du pôle) et personnalise leur libellé de notification. Incohérence de conception découverte par un premier test qui échouait : ce flux standard couvre déjà TOUT le monde ayant accès à la tâche, donc une mention ne peut jamais atteindre quelqu'un de nouveau — question reposée, réponse : une seule notification par destinataire mentionné (libellé « Vous avez été mentionné » au lieu du libellé générique), jamais de doublon. Invariant de sécurité testé explicitement : mentionner un utilisateur sans accès réel à la tâche (ni assignee, ni staff du pôle) n'aboutit à aucune notification pour lui — la liste de candidats côté client n'est jamais la barrière de sécurité réelle, le serveur revérifie indépendamment (même principe que le scope FREELANCER déjà appliqué ailleurs cette session). Correctif client : nouveau composant `MentionTextarea.tsx` — taper `@` ouvre un `Popover` (liste filtrée par le texte tapé), la sélection insère `@[Nom](userId)` et repositionne le curseur ; câblé dans `TaskDetailDrawer.tsx` (remplace le `Textarea` brut du formulaire de commentaire) via une nouvelle prop `mentionableUsers`, alimentée par `assignableUsers` déjà calculé dans `TasksPage.tsx` pour SEC-054. Tests réels ajoutés : `server/test/mentions.test.ts` (5 cas, logique pure), `server/test/taskCommentMentions.test.ts` (3 cas d'intégration réelle contre une base migrée, observant les vrais appels `communicationQueue.addBulk` via `node:test` `mock.method`), `client/src/features/tasks/components/MentionTextarea.test.tsx` (3 cas — ouverture autocomplete, filtrage, token inséré). 362/362 tests serveur verts (8 nouveaux), 51/51 tests client verts (3 nouveaux), typecheck/lint (0/0 serveur ; 12 warnings client, exception SEC-049 stable)/build propres des deux côtés. `verifie: test`.** | **Suite de l'instruction « corrige » du porteur sur SEC-060 (2e des 4 items retenus, ordre confirmé : « pièces jointes → mentions @ → bulk → sous-tâches »). Deux décisions de conception tranchées en cours de route via AskUserQuestion : l'approche technique (autocomplete + ID) avant de coder, puis la résolution de l'incohérence mention/flux-standard révélée par un test qui échouait, avant de continuer. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-066 résolue (troisième item de SEC-060, gravité `moyen`) : aucune action en masse n'existait sur la liste des tâches (recherche exhaustive de "bulk", zéro occurrence). Décision de conception centrale : `taskService.bulkUpdateStatus`/`.bulkDelete` appellent `updateTask`/`deleteTask` existants une par une en boucle, plutôt que de dupliquer/raccourcir leur logique métier (transitions de statut valides, scope MANAGER par pôle, restriction FREELANCER, notifications, invalidation de cache) — aucune règle métier n'est contournée par le traitement en masse. Traitement « au mieux », pas de transaction tout-ou-rien : un échec individuel (transition invalide, tâche hors pôle) est rapporté par id (`{id, success, error?}`) sans bloquer le reste du lot. Invariant de sécurité testé explicitement (2 niveaux) : une tâche hors du pôle d'un MANAGER échoue individuellement dans le lot sans empêcher le traitement des tâches dans son pôle (le bulk n'élargit jamais l'autorité d'un MANAGER) ; les routes `POST /tasks/bulk/status`/`POST /tasks/bulk/delete` restent `authorize("ADMIN","MANAGER")`, un FREELANCER n'y a structurellement pas accès (confirmé côté client par le masquage de la case à cocher). Plafond de 100 ids par appel (même ordre de grandeur que le plafond Kanban à 200 tâches). Côté client : case à cocher par ligne + « tout sélectionner sur la page » dans `TasksListView.tsx` (vue desktop uniquement, l'action en masse restant un usage typiquement desktop), barre d'actions conditionnelle (changement de statut via `Select`, suppression via `ConfirmDeleteDialog` réutilisé), résumé succès/échec via `toast`. Écart de test évité : un premier jet ajoutait les tests bulk directement dans `TasksListView.test.tsx` avec un mock global de `@tanstack/react-virtual`, qui aurait fait doublonner le rendu des tâches et cassé les 2 tests SEC-056 existants (lesquels dépendent du comportement inverse) — corrigé en isolant les nouveaux tests dans `TasksListViewBulkActions.test.tsx`, fichier séparé avec son propre mock, sans toucher au fichier existant. Polyfills `hasPointerCapture`/`setPointerCapture`/`scrollIntoView` ajoutés localement (non implémentés par JSDOM, requis par `@radix-ui/react-select` pour un clic réel sur le select bulk). Tests réels ajoutés : `server/test/taskBulkActions.test.ts` (4 cas d'intégration réelle contre une base migrée), `client/src/features/tasks/components/TasksListViewBulkActions.test.tsx` (6 cas). 366/366 tests serveur verts (4 nouveaux), 57/57 tests client verts (6 nouveaux), typecheck/lint (0/0 serveur ; 12 warnings client, exception SEC-049 stable)/build propres des deux côtés. `verifie: test`.** | **Suite de l'instruction « corrige » du porteur sur SEC-060 (3e des 4 items retenus, ordre confirmé : « pièces jointes → mentions @ → bulk → sous-tâches »). Aucune décision de portée supplémentaire nécessaire — le rapport initial précisait déjà « changement de statut/assignation/suppression groupée », et l'approche « réutiliser les méthodes existantes en boucle » découlait directement des contraintes déjà établies (scope MANAGER, restriction FREELANCER) sans ambiguïté à trancher. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-067 résolue (quatrième et dernier item de SEC-060, gravité `moyen`) : aucune sous-tâche n'existait sur une tâche (`model Task` sans `parentId` ni relation enfant, confirmé par lecture directe du schéma). Trois décisions de conception tranchées via AskUserQuestion avant tout code, chacune déterminante pour le modèle de données : profondeur (un seul niveau, pas d'imbrication récursive) ; autonomie (simple checklist titre + fait/pas fait, explicitement PAS une entité `Task` complète avec assignee/statut/échéance propres) ; complétion (aucune règle automatique ne lie le statut du parent à ses sous-tâches, statuts indépendants). Conséquence directe des deux premières décisions : nouveau modèle Prisma dédié et plus léger `TaskChecklistItem` (id, title, done, position, taskId) plutôt qu'un self-reference `Task.parentId` — un self-reference aurait laissé croire à tort qu'une sous-tâche est une vraie tâche, contredisant la décision du porteur. Migration `20260719193000_add_task_checklist_item`. `position` toujours dérivée côté serveur du nombre d'items existants (jamais transmise/fiée par le client) pour éviter toute collision d'index entre créations concurrentes. Autorisation : même audience que les commentaires de tâche (ADMIN/MANAGER/FREELANCER assigné, `taskRepository.existsInCompany` réutilisé tel quel) mais SANS restriction par auteur contrairement aux commentaires (SEC-059) et réunions (SEC-055/F6) — décision cohérente avec la nature de checklist partagée du concept retenu, n'importe qui ayant accès à la tâche peut cocher/modifier/supprimer n'importe quel item. Isolation cross-tâche testée explicitement (modifier/supprimer un item via un `taskId` qui n'est pas le sien 404, même garde déjà établie pour SEC-059/SEC-055). Nouvelles routes `GET`/`POST /tasks/:taskId/checklist`, `PUT`/`DELETE /tasks/:taskId/checklist/:itemId`. Côté client : nouveau composant `TaskChecklist.tsx` (case à cocher par item, barre de progression purement informative n'influençant jamais le statut de la tâche, ajout via champ + Entrée), câblé dans `TaskDetailDrawer.tsx` au-dessus de `TaskAttachments`. Tests réels ajoutés : `server/test/taskChecklist.test.ts` (4 cas d'intégration réelle contre une base migrée), `client/src/features/tasks/components/TaskChecklist.test.tsx` (4 cas). Les 4 items retenus par le porteur (SEC-064 pièces jointes, SEC-065 mentions, SEC-066 bulk, SEC-067 sous-tâches) sont désormais tous `resolu` sous leur propre ID, reliés à SEC-060 par le champ `classe` sans jamais y être fusionnés. SEC-060 elle-même reste `ouvert` : son critère de résolution original couvre les 6 items du constat P1, et l'item (2) dépendances entre tâches n'a reçu aucune décision de reprise du porteur — la déclarer `resolu` alors qu'un des items qu'elle décrit reste sans réponse serait une fabrication de statut, prohibée par CLAUDE.md. 370/370 tests serveur verts (4 nouveaux), 61/61 tests client verts (4 nouveaux), typecheck/lint (0/0 serveur ; 12 warnings client, exception SEC-049 stable)/build propres des deux côtés. `verifie: test`.** | **Suite de l'instruction « corrige » du porteur sur SEC-060 (4e et dernier des items retenus, ordre confirmé : « pièces jointes → mentions @ → bulk → sous-tâches »). Trois décisions de conception tranchées via AskUserQuestion avant tout code : profondeur (« Un seul niveau (Recommandé) »), autonomie (« Non, simple checklist » — plutôt que « Oui, entité complète »), complétion (« Non, statuts indépendants (Recommandé) » — plutôt que blocage automatique). `resolu` (SEC-067) déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie. SEC-060 elle-même délibérément laissée `ouvert` — pas une omission, une conséquence directe de l'item (2) non tranché.** |
| **2026-07-19** | **SEC-063 et SEC-068 résolues (gravité `majeur` et `bloquant`). SEC-063 : l'onglet « Mes livrables » (FREELANCER) appelait `POST /documents`, mais cette route était `authorize("ADMIN", "MANAGER")` seul — un FREELANCER recevait systématiquement 403 avant même `requirePermission`. Corrigé : `authorize("ADMIN", "MANAGER", "FREELANCER")` sur la route, garde d'autorisation ajoutée dans `documentService.create` (nouveau second paramètre `viewer`, absent jusqu'ici de cette méthode) — un FREELANCER ne peut créer qu'un `type: "DELIVERABLE"` sur un projet où il a une tâche assignée, 403 `FREELANCER_DELIVERABLE_ONLY`/`FREELANCER_NOT_STAFFED` sinon — sans cette garde service, `authorize()` seul aurait laissé n'importe quel freelancer créer un document de n'importe quel type sur n'importe quel projet (`requirePermission` ne fait rien pour les rôles non-MANAGER). Effet de bord corrigé : un test préexistant non écrit cette session (`freelancerSeesOwnDeliverable.test.ts`) appelait `documentService.create` à un seul argument, cassé par le nouveau paramètre obligatoire — corrigé en lui passant un `viewer` cohérent avec chacun de ses deux cas. SEC-068 (découverte incidemment en corrigeant SEC-063, enregistrée immédiatement) : `documentBaseSchema` (schéma partagé Zod) n'avait pas de champ `title`, alors que `Document.title` est requis sur le modèle Prisma — Zod retire silencieusement toute clé non déclarée, donc `validate()` vidait `title` du body avant que le contrôleur ne le voie, confirmé empiriquement. Portée bien plus large que SEC-063 seul : `DocumentsPage.tsx` (flux principal, tous rôles) envoie aussi `title`, donc TOUTE création de document via cette route était affectée — jamais détecté car aucun test existant n'exerçait la vraie route HTTP. Corrigée dans la même passe (sans quoi SEC-063 n'aurait jamais fonctionné réellement) : `title` ajouté et rendu requis. Test réel ajouté, partagé : `server/test/documentCreateHttp.test.ts`, 4 cas via `supertest` contre la vraie route HTTP `POST /documents`. 374/374 tests serveur verts (4 nouveaux + 1 préexistant adapté), 61/61 tests client verts, typecheck/lint (0/0 serveur ; 12 warnings client, exception SEC-049 stable)/build propres des deux côtés. `verifie: test`.** | **Choix « SEC-063 (Recommandé) » du porteur (AskUserQuestion, parmi les 3 anomalies restantes du périmètre). SEC-068 découverte en cours de correctif, portée précisée via AskUserQuestion : « Corriger SEC-068 aussi, dans la même passe (Recommandé) ». `resolu` (les deux) déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** || **2026-07-19** | **SEC-061 résolue (gravité `faible`) : le CLIENT ne voyait son projet qu'à travers une timeline synthétique en 7 étapes (`getTimelineStatus`) et un brief — jamais le détail des tâches. Contenu de la vue déjà précisé lors d'une question antérieure de cette session : tâches DONE uniquement, titre + date, pas les documents `DELIVERABLE`, pas le détail complet des tâches (assignee/description/priorité restent non exposés — la confidentialité interne du reste du module Task n'est pas remise en cause). Corrigé : nouvelle méthode `projectService.getCompletedTasksForClient(id, clientId)`, distincte de `getTimelineStatus` (celle-ci retourne un résumé synthétique en 7 étapes, la nouvelle de vraies lignes de tâche) — scope CLIENT via `where.clientId` (même pattern que `getTimelineStatus`), 404 si le projet n'appartient pas au client plutôt qu'une liste vide qui laisserait deviner son existence à un tiers. Nouvelle route dédiée `GET /projects/:id/completed-tasks` (`authorize("CLIENT")` seul, contrairement à `/timeline-status` partagée ADMIN/MANAGER/CLIENT/FREELANCER), non gated par `requireActivatedPortal` — cohérent avec la timeline déjà non gated (portail continu). Côté client : nouveau composant `CompletedTasksList.tsx` sous la timeline dans `ProjectsClientPage.tsx` (ne rend rien si la liste est vide, pas de section vide « Ce qui a été livré »). Hook `useProjectCompletedTasks` délibérément extrait dans son propre fichier (`hooks/useProjectCompletedTasks.ts`), pas colocalisé avec le composant comme `ProjectTimeline.tsx` le fait déjà — colocaliser aurait ajouté un 13e cas à l'exception documentée `react-refresh/only-export-components` (SEC-049), confirmé par un aller-retour (13 puis 12 warnings). Invariant de sécurité testé explicitement : un CLIENT ne peut pas lire le projet d'un autre client (404, pas une liste vide qui fuiterait l'existence du projet). Tests réels ajoutés : `server/test/clientCompletedTasks.test.ts` (2 cas d'intégration réelle contre une base migrée), `client/src/features/client-portal/components/CompletedTasksList.test.tsx` (3 cas). 376/376 tests serveur verts (2 nouveaux), 64/64 tests client verts (3 nouveaux), typecheck/lint (0/0 serveur ; 12 warnings client, exception SEC-049 stable)/build propres des deux côtés. `check-i18n.mjs` toujours introuvable (écart préexistant déjà signalé plus tôt dans la session, non retraité). `verifie: test`.** | **Instruction directe du porteur du projet (« continuer »), choix « SEC-061 (Recommandé) » via AskUserQuestion parmi les 2 dernières anomalies ouvertes du périmètre. Contenu de la vue déjà tranché lors d'une question antérieure de cette même session (« Taches DONE uniquement, titre + date (Recommandé) »), aucune nouvelle décision de conception nécessaire avant de coder. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-060 résolue (clôture finale, gravité `moyen`) : les deux derniers items du constat P1 restés sans réponse ont chacun reçu une décision explicite du porteur, rouverts après la clôture partielle initiale de SEC-060 (4 items sur 6 retenus alors). Item (2) dépendances entre tâches : question posée sur trois décisions de conception préalables (effet du blocage sur les transitions de statut, cardinalité many-to-many vs chaîne simple, contrôle de cycles) — réponse du porteur : rejet explicite, aucune dépendance entre tâches n'est implémentée. Décision de portée pure, aucun code écrit, aucun nouvel ID créé — le rejet lui-même constitue la résolution de cet item. Item (3) vue calendrier/Gantt : porteur a demandé sa mise en œuvre, portée technique précisée via AskUserQuestion (``Calendrier mensuel simple (Recommandé)`` plutôt qu'un vrai Gantt à barres de durée). Voir SEC-069 pour le correctif complet. Les 6 items du constat P1 ont désormais tous une décision explicite du porteur (4 corrigés sous SEC-064/065/066/067, 1 corrigé sous SEC-069, 1 rejeté) — SEC-060 passe `resolu`, condition posée lors de la clôture partielle précédente désormais remplie.** | **Instruction directe du porteur (« continuer » puis choix « Rouvrir SEC-060 (dépendances entre tâches) » via AskUserQuestion). Décisions de conception pour l'item dépendances toutes tranchées par rejet (« remove la dependance entre taches je ne veux pas », « meme » pour la cardinalité, « meme pas de dependance » pour les cycles) — aucune ambiguïté restante, rejet total et explicite. Pour l'item calendrier, décision de le traiter (contredisant le rejet précédent des dépendances dans la même réponse) puis portée technique précisée séparément. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-069 résolue (gravité `moyen`) : aucune vue calendrier n'existait sur le module Tâches (recherche exhaustive de "Gantt" dans client/src, zéro occurrence ; "Calendar" ne remontait que BookingCalendar.tsx, prise de rendez-vous commerciale sans rapport). Portée technique tranchée via AskUserQuestion avant tout code : calendrier mensuel simple (grille jour + tâches à échéance), pas un vrai Gantt à barres de durée — jugé nettement plus lourd (nouvelle librairie de rendu, alignement temporel par projet). Correctif : réutilisation du composant `Calendar` existant (`react-day-picker`, déjà une dépendance, déjà utilisé par BookingCalendar.tsx — non touché, module différent) via `modifiers`/`modifiersClassNames` pour marquer les jours portant une tâche à échéance. Nouveau composant `TasksCalendar.tsx`, troisième option du `ToggleGroup` déjà en place pour list/kanban dans `TasksPage.tsx` (`viewMode` étendu à `"list" | "kanban" | "calendar"`). Chargement des tâches sur le même modèle que le Kanban existant (`pageSize: 200`, non paginé) ; la bannière de troncature au-delà de 200 tâches, déjà en place pour le Kanban, étendue aux deux vues non paginées via un `isUnpaginatedView` commun plutôt que dupliquée. Seules les tâches avec `dueDate` renseigné apparaissent. Test réel ajouté : `client/src/features/tasks/components/TasksCalendar.test.tsx` (4 cas — tâches du jour affichées avec leur projet, état vide, clic déclenche `onView` avec la bonne tâche, une tâche sans `dueDate` n'apparaît jamais). Aucun changement serveur nécessaire ; suite serveur relancée par précaution et confirmée inchangée (376/376). Client `npx tsc --noEmit` (clean), `npm run lint` (12 warnings — exception SEC-049, stable), `npx vitest run` (68/68, 4 nouveaux), `npm run build` (succès). `verifie: test`.** | **Suite de la réouverture de SEC-060 (item 3, dernier restant). Portée technique tranchée via AskUserQuestion : « Calendrier mensuel simple (Recommandé) » plutôt qu'un vrai Gantt à barres de durée. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17), dérogation « no make it resolu » déjà établie.** |
| **2026-07-19** | **SEC-070 résolue (gravité `moyen`) : rapport de revue de code externe sur les correctifs SEC-055 à SEC-069 de cette session (8 constats numérotés 1.1 à 1.8, vérifiés un par un par un agent avant toute action). Point 1.1 confirmé vrai : `getCompletedTasksForClient` (SEC-061) dérivait `completedAt` de `task.updatedAt`, mis à jour par Prisma sur toute écriture de la ligne, pas seulement le passage à DONE — une correction ultérieure du titre d'une tâche déjà terminée aurait silencieusement avancé la date de complétion vue par le CLIENT. Correctif : nouveau champ `Task.completedAt` (migration `20260719200000_add_task_completedat_comment_editedat`), renseigné exclusivement par `task.service.ts#updateTask` sur la transition de/vers DONE, `updatedAt` gardé en repli uniquement pour les tâches DONE avant l'existence du champ. Test réel ajouté (`clientCompletedTasks.test.ts`, 1 cas — édite le titre d'une tâche déjà DONE via le vrai `taskService.updateTask`, prouve que la date client-visible ne bouge pas). Serveur 378/378, client 71/71, `npx tsc --noEmit` propre des deux côtés, lint 0 warning serveur / 12 client (stable), build client réussi. `verifie: test`.** | **Choix du porteur (AskUserQuestion, multiSelect) : "Corriger 1.1, 1.2, 1.3, 1.7 (Recommandé)" parmi les 8 constats du rapport. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17).** |
| **2026-07-19** | **SEC-071 résolue (gravité `faible`) : même rapport, point 1.2 confirmé vrai — un commentaire de tâche édité (SEC-059) était indiscernable d'un commentaire original, `model Comment` n'ayant aucun champ `updatedAt`/`editedAt`. Significatif car un ADMIN peut éditer le commentaire de n'importe qui sans qu'aucune traçabilité de la modification ne soit visible pour les autres collaborateurs. Correctif : `Comment.editedAt` (même migration que SEC-070), renseigné par `commentRepository.update` à chaque édition, affiché dans `TaskDetailDrawer.tsx` (« (modifié) », titre HTML = date/heure exacte). Tests réels ajoutés (`taskCommentUpdateDelete.test.ts`, 1 cas serveur — prouve qu'éditer un commentaire ne marque jamais un autre ; `TaskDetailDrawer.test.tsx`, 2 cas client). `verifie: test`.** | **Choix du porteur : "Corriger 1.1, 1.2, 1.3, 1.7 (Recommandé)". `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17).** |
| **2026-07-19** | **SEC-072 résolue (gravité `faible`) : même rapport, point 1.3 vérifié et infirmé dans sa formulation littérale — le commentaire de code de `TaskAttachments.tsx` citait SEC-063 pour justifier `canUpload={!isFreelancer}`, alors que SEC-063 est résolue depuis cette même session (FREELANCER est bien autorisé côté route depuis lors). Vérifié qu'il ne s'agit pas d'un vrai bug de permission : la restriction vient du fait que ce composant envoie toujours `type: "OTHER"`, incompatible avec la garde service `FREELANCER_DELIVERABLE_ONLY` (`document.service.ts#create`), pas d'un problème d'autorisation de route. Correctif : commentaire réécrit pour citer SEC-072 et décrire la cause réelle, aucun changement de comportement (déjà correct, déjà couvert par les tests SEC-063/SEC-068). `verifie: code_direct`.** | **Choix du porteur : "Corriger 1.1, 1.2, 1.3, 1.7 (Recommandé)". `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17).** |
| **2026-07-19** | **SEC-073, SEC-074, SEC-075 ouvertes (gravité `faible` chacune, non retenues cette passe) : points 1.4 (fenêtre de concurrence sur `projectTemplateService.applyToProject`, lecture du compte de tâches et insertion du lot hors transaction), 1.5 (même classe de défaut sur le calcul de `position` de `taskChecklistService.createItem`, commentaire affirmant à tort qu'aucune collision n'est possible), et 1.6 (aucune limite sur le nombre d'items de checklist par tâche, contrairement aux autres garde-fous du module) confirmés vrais par lecture directe mais explicitement écartés par le porteur cette passe — restent `ouvert` sans correctif. SEC-076 résolue (gravité `faible`) : point 1.7 confirmé vrai — le formulaire d'édition d'une réunion (`ProjectMeetingsTab.tsx`) est rendu après la liste paginée sans `scrollIntoView`, invisible sans défilement manuel sur une liste longue. Correctif : `ref` + `useEffect` appelant `scrollIntoView({ behavior: "smooth", block: "center" })` dès que `editingMeeting` devient non-null. Test réel ajouté (`ProjectMeetingsTab.test.tsx`, 1 cas). Point 1.8 (désarchivage de projet) identifié comme une reformulation non autorisée d'une décision déjà actée sous SEC-040 — cité tel quel, aucun nouvel ID créé, non traité de nouveau. `verifie: test` pour SEC-076.** | **Choix du porteur (AskUserQuestion, multiSelect) : "Corriger 1.1, 1.2, 1.3, 1.7 (Recommandé)" — exclut explicitement les transactions (1.4/1.5), le plafond checklist (1.6), et la réouverture de SEC-040 (1.8). `resolu` (SEC-076) déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17).** |
| **2026-07-19** | **SEC-073, SEC-074, SEC-075 résolues (gravité `faible` chacune) : reprise de session, le porteur confirme "oui on le fait" pour traiter les 3 points laissés ouverts (1.4/1.5/1.6). SEC-073 : `projectTemplateService.applyToProject` enveloppe désormais `countTasks` + insertion du lot dans un seul `$transaction` Prisma Serializable (même pattern que `auth.service.ts#resetPassword`) — deux applies strictement concurrents ne peuvent plus jamais tous deux lire count=0, le perdant reçoit 409 `TEMPLATE_ALREADY_APPLIED` (erreur Postgres P2034 explicitement mappée). Nettoyage corrélé : `projectRepository.countTasks` et l'ancienne version non transactionnelle de `projectTemplateRepository.applyToProject` supprimées (mortes après le déplacement de la logique). SEC-074 : même pattern appliqué à `taskChecklistRepository.create` (count + create dans une transaction Serializable), avec une différence de conception assumée par rapport à SEC-073 — une collision perdue ici n'est jamais une erreur métier (deux personnes qui ajoutent un item en même temps est un usage normal), donc le perdant retente automatiquement (jusqu'à 8 fois, backoff aléatoire court) plutôt que de faire remonter P2034 à l'utilisateur. SEC-075 : plafond de 100 items par tâche ajouté dans `taskChecklistService.createItem` (422 `CHECKLIST_LIMIT_REACHED`), cohérent avec le plafond des actions en masse (SEC-066) ; côté client, `TaskChecklist.tsx` masque le champ d'ajout et affiche un message une fois la limite atteinte. Précision honnête : le plafond borne la liste dans la pratique, mais la pagination/virtualisation de `findByTaskId` elle-même n'a délibérément pas été construite (jugée disproportionnée pour une liste maintenant bornée à 100). Tests réels ajoutés : `projectTemplateIdempotencyAndFreelancerFields.test.ts` (1 cas — deux applies concurrents via `Promise.allSettled`, un seul succès, jamais de duplication du lot), `taskChecklist.test.ts` (2 cas — 5 créations concurrentes jamais en collision de position ; rejet 422 au-delà de 100 items), `TaskChecklist.test.tsx` (2 cas client — message et masquage du champ à la limite). Serveur 381/381 (stable sur 2 exécutions malgré la contention volontaire des tests), client 73/73, `npx tsc --noEmit` propre des deux côtés, lint 0 warning serveur / 12 client (stable), build client réussi. `verifie: test` pour les 3.** | **Confirmation explicite du porteur (« oui on le fait ») en reprise de session, après clarification (AskUserQuestion) que cela désignait le traitement de SEC-073/074/075 laissées ouvertes. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17).** |
| **2026-07-19** | **SEC-077 résolue (gravité `faible`) : nouveau rapport de revue de code externe sur les correctifs SEC-070 à SEC-076, confirmé par lecture directe — `taskChecklistService.createItem` vérifiait le plafond de 100 items (SEC-075) via un `countByTaskId` séparé, hors de la transaction `Serializable` qui calcule ensuite `position` dans `taskChecklistRepository.create` (SEC-074). Ces deux comptages n'étaient pas la même opération atomique : sous une rafale de requêtes concurrentes proches de la limite, chacune pouvait lire un compte encore inférieur à 100 avant qu'aucune n'ait inséré — le plafond aurait pu être dépassé de quelques unités, rouvrant exactement la classe de défaut que SEC-074 venait de fermer pour `position`, mais cette fois pour le plafond. Corrigé : la vérification du plafond est déplacée à l'intérieur de la transaction Serializable, sur le même `count()` qui dérive `position` — un seul comptage sert aux deux fins. Distinction de conception assumée avec SEC-074 : un rejet pour plafond atteint est une réponse finale (jamais retentée), contrairement à un conflit de sérialisation Postgres P2034 (qui l'est) — la boucle de retry distingue explicitement les deux avant de décider s'il faut réessayer. `taskChecklistService.createItem` simplifié en relais direct ; `taskChecklistRepository.countByTaskId` devenu mort, supprimé (aucun autre appelant). Test réel ajouté (`taskChecklist.test.ts`, 1 cas — seed à 97 items, 5 créations réellement concurrentes visant les 3 dernières places, prouve qu'exactement 3 réussissent et 2 sont rejetées, jamais de dépassement). Aucun changement client (comportement observable inchangé). Serveur 382/382 (stable sur 2 exécutions), `npx tsc --noEmit` propre, lint 0 warning. `verifie: test`.** | **Constat remonté par le porteur via un rapport de revue de code externe sur les correctifs de la passe précédente (SEC-070 à SEC-076), traité dans la même session que sa remontée conformément à la règle d'enregistrement immédiat de tout écart constaté. `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17).** |
| **2026-07-20** | **SEC-078 résolue (gravité `mineur`) : le porteur demande explicitement de construire le désarchivage de projet, rouvrant le point 1.8 (précédemment classé comme reformulation non autorisée de SEC-040 sous SEC-076). Clarifications tranchées par AskUserQuestion avant tout code : état de retour = `archivedAt: null` seul (le `status` n'est jamais touché par `archive()`, confirmé par lecture directe) ; ADMIN seul (symétrique à l'archivage) ; portée minimale — endpoint + bouton sur `ProjectDetailPage.tsx`, pas de nouvelle liste des projets archivés (même portée « minimale » que SEC-040). Corrigé : `projectRepository.unarchive` (même forme que `restore()` pour `deletedAt`), `projectService.unarchiveProject` (cherche `archivedAt: { not: null }`, symétrique à `restoreProject` cherchant `deletedAt: { not: null }`, plutôt que `findByIdAdmin` qui filtre toujours les projets archivés par construction — 404 si le projet n'est pas archivé, jamais un no-op silencieux), route `POST /:id/unarchive` (`authorize("ADMIN")`). Côté client : `projectsApi.unarchive`, `useUnarchiveProject`, bouton « Désarchiver » visible uniquement si `isAdmin && project.archivedAt`, avec sa propre confirmation. Effet de bord corrigé : le texte du dialogue d'archivage affirmait à tort qu'aucun désarchivage n'existe — mis à jour. Tests réels ajoutés : `projectCreateArchiveRestore.test.ts` (4 cas serveur — désarchive réellement et vérifie la réapparition dans `findAll` + invariance du `status`, 404 sur jamais-archivé, 404 sur double désarchivage, 404 si seulement supprimé/pas archivé) ; `ProjectDetailPage.test.tsx` (3 cas client — bon bouton selon `archivedAt`, clic+confirmation appelle la mutation réelle avec l'id). Serveur 386/386, client 76/76, `npx tsc --noEmit` propre des deux côtés, lint 0 warning serveur / 12 client (stable), build client réussi. `verifie: test`.** | **Demande explicite du porteur (« on fait le desarchivage »), en reprise après confirmation que SEC-076/SEC-040 n'avaient délibérément pas construit cette fonctionnalité. Nouvel ID (pas une réouverture de SEC-040) : critère de résolution différent — SEC-040 exigeait de documenter l'irréversibilité, SEC-078 exige de construire l'endpoint manquant, conformément à la règle « même classe de défaut, critère de résolution différent → ID distinct ». `resolu` déclaré SANS confirmation CI : CI désactivée sur `origin/main` (workflow_dispatch seul, session du 2026-07-17).** |
| **2026-07-20** | **Audit exhaustif du module Gestion de Projets (agent dédié, lecture seule, lecture intégrale du périmètre Project/Task/ProjectMeeting/ProjectTemplate/Comment/TaskChecklistItem sur toute la stack) — 14 nouveaux constats (SEC-079 à SEC-092), tous vérifiés par lecture directe avant enregistrement, aucun doublon avec les 78 anomalies déjà enregistrées. Porteur : « Tout traiter (14 items) ». Deux points bloquants réels touchant des chemins d'usage standard : SEC-079 (créer/éditer une tâche sans dates échouait systématiquement en 422, le client envoyant des chaînes vides que `.optional()` ne tolère pas) et SEC-080 (un FREELANCER ne pouvait jamais changer le statut de sa tâche via le dialogue d'édition, seulement via le drag Kanban — `form.handleSubmit` soumettait tout le formulaire malgré une UI ne montrant que le statut). Trois élevés : SEC-081 (éditer le nom d'un projet déjà COMPLETED échouait toujours, la garde de blocage ne distinguait pas un no-op d'une vraie transition), SEC-082 (les mentions @ s'affichaient en markup brut `@[Nom](uuid)` dans le fil de commentaires, fuite d'UUID interne), SEC-083 (bouton Éditer projet visible pour FREELANCER, toujours 403). Arbitrages tranchés par AskUserQuestion : SEC-084 (masquer le sélecteur Client pour MANAGER, dont la valeur était silencieusement ignorée par le serveur), SEC-085 (ajouter la garde REVIEW manquante sur `clientApprove`), SEC-089 (geler aussi checklist/commentaires sur un projet archivé, cohérence stricte avec le gel déjà appliqué aux champs de tâche). Complétés : SEC-086 (findById filtre désormais deletedAt, symétrique à SEC-041/042 sur l'axe deletedAt), SEC-087 (taskScope.test.ts réécrit pour appeler le vrai taskService au lieu d'une réimplémentation companyId fictive), SEC-088 (bandeau de troncature >100 projets reformulé pour couvrir aussi l'affichage du nom en liste/Kanban, pas seulement le sélecteur), SEC-090 (typage Prisma propre sur taskRepository.create, cohérence avec SEC-012), SEC-092 (findDueForReminder filtre désormais deletedAt/COMPLETED). SEC-091 (N+1 requêtes portail client, polling timeline) documentée mais laissée `ouvert` sur décision explicite du porteur (gravité mineure, effort moyen, aucun symptôme réel observé). Nouveau composant `MentionText.tsx` (rendu des mentions), `assertProjectIsOpenForTaskChanges` déplacée de `task.service.ts` vers `serviceScope.ts` (même précédent que SEC-041) et réutilisée par `taskChecklist.service.ts`/`comment.service.ts`. Tests réels ajoutés sur les deux workspaces : `useTaskActions.test.tsx` (+2), `TaskEditDialog.test.tsx` (nouveau, 1 cas), `TaskDetailDrawer.test.tsx` (+2), `ProjectsPage.test.tsx` (+4), `projectCreateArchiveRestore.test.ts` (+3), `taskScope.test.ts` (réécrit, 3 cas), `taskChecklist.test.ts` (+1, 3 assertions), `taskCommentUpdateDelete.test.ts` (+1, 3 assertions), `projectMeetingDueReminderExclusions.test.ts` (nouveau, 3 cas). Vérification complète : serveur `npx tsc --noEmit` (clean), `npm run lint` (0/0), `npx tsx --test test/run-all.test.ts` (391/391) ; client `npx tsc --noEmit` (clean), `npm run lint` (12 warnings — exception SEC-049, stable), `npx vitest run` (85/85), `npm run build` (succès), `node scripts/check-i18n.mjs` (vert). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Audit lancé sur demande explicite du porteur (prompt d'audit exhaustif module Gestion de Projets), délégué à un agent dédié en lecture seule pour couvrir le périmètre complet sans saturer le contexte principal. Portée de correction choisie via AskUserQuestion : « Tout traiter (14 items) ». Arbitrages ponctuels rendus en cours de route (AskUserQuestion) : SEC-084 (masquer le sélecteur client), SEC-085 (ajouter la garde REVIEW), SEC-089 (geler aussi checklist/commentaires) — les trois « Recommandé » choisis.** |
| **2026-07-20** | **Audit accessibilité/UX du module Gestion de Projets (agent dédié, lecture seule) — 4 nouveaux constats (SEC-093 à SEC-096), tous mineurs, tous vérifiés par lecture directe, aucun doublon avec SEC-056/057/082 déjà résolus (portée déclarée distincte à chaque fois). Porteur : « Tout traiter (4 items) ». SEC-093 : le Kanban n'offrait aucun moyen clavier d'ouvrir le détail d'une carte (dnd-kit réclame Enter/Espace pour son propre ramassage) — corrigé par un `onKeyDown` dédié sur Enter (jamais utilisé par le KeyboardSensor), plus des annonces `accessibility.announcements` traduites FR/EN sur `DndContext`. SEC-094 : les 3 boutons icône de la table desktop de `TasksListView.tsx` n'avaient qu'un `title`, pas d'`aria-label` — incohérent avec sa propre variante mobile (déjà correcte depuis SEC-056) ; `aria-label` ajouté. SEC-095 : plusieurs mutations (TimeTracking, ProjectMeetings, TaskChecklist, Documents) n'avaient aucun `onError` ou seulement un message Axios opaque — approfondissement réalisé avant correctif a montré que la checklist et les documents étaient RÉELLEMENT silencieux (zéro toast), plus grave que le rapport initial ; nouvel utilitaire partagé `client/src/utils/apiError.ts#getServerErrorMessage` (même pattern que `TasksKanban.tsx#handleDragEnd`), câblé au niveau des hooks (pas des composants, pour éviter un double toast — React Query appelle les deux `onError` s'ils existent aux deux niveaux). SEC-096 : trois jeux divergents de couleurs/libellés de statut de tâche codés en dur (ProjectDetailPage, TasksKanban, vs le helper centralisé) — supprimés, routés sur `getTaskStatusBadgeClass`/`getStatusLabel` déjà utilisés ailleurs ; REVIEW affiche désormais partout « En revue » au lieu de 3 libellés distincts (« Révision », « En révision », et le seul correct). Tests réels ajoutés : `TasksListViewDesktopA11y.test.tsx` (nouveau), `useTaskChecklist.test.tsx` (nouveau, 2 cas), `TasksKanban.test.tsx` (nouveau, 1 cas), `ProjectDetailPage.test.tsx` (+1 cas). Vérification complète : client `npx tsc --noEmit` (clean), `npm run lint` (12 warnings — exception SEC-049, stable), `npx vitest run` (90/90), `npm run build` (succès), `node scripts/check-i18n.mjs` (vert). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Audit lancé sur demande explicite du porteur, angle choisi via AskUserQuestion : « Même module, angle accessibilité/UX (Recommandé) » plutôt qu'un autre module ou un autre angle (sécurité, performance). Délégué à un agent dédié en lecture seule (comme pour l'audit précédent SEC-079 à SEC-092), briefé explicitement sur la portée déjà couverte par SEC-056/057/082 pour éviter tout doublon. Portée de correction choisie via AskUserQuestion : « Tout traiter (4 items) ».** |
| **2026-07-20** | **Audit performance/scalabilité du module Gestion de Projets (agent dédié, lecture seule) — 2 nouveaux constats (SEC-097, SEC-098), tous deux mineurs, moins nombreux que les deux audits précédents (fonctionnel/sécurité puis a11y/UX) car le module avait déjà reçu une attention performance conséquente (SEC-037). Confirmé par l'agent : aucun index Prisma manquant sur ce périmètre, pas de N+1 réel sur la progression projet (`getProgressByProjectIds` fait une seule requête groupée pour toute une page), selects minimaux déjà en place, hooks client parallélisés sans cascade évitable. SEC-097 : `bulkUpdateStatus`/`bulkDelete` (task.service.ts) exécutaient jusqu'à 100 tâches strictement en série, chacune retraversant tout le chemin `updateTask`/`deleteTask` (~5-8 requêtes) — jusqu'à ~800 requêtes SQL sérialisées par appel HTTP ; corrigé par `Promise.allSettled` (chaque tâche reste indépendante, aucune règle métier contournée, seul le temps d'exécution change), prouvé par un test mesurant le temps réel d'un lot de 10 contre un appel unique. SEC-098 : le rapport initial affirmait qu'un compteur de résumé (commentCount/taskCount) restait périmé faute d'invalidation de cache sur les mutations de commentaire/checklist/réunion — vérification demandée avant tout correctif a révélé que c'était FAUX tel qu'énoncé : `summary.service.ts` écrit bien en cache mais ne le RELIT jamais nulle part dans le dépôt, donc aucune donnée périmée n'est réellement servie aujourd'hui (contrairement à `getEnhancedDashboardSummary`, qui fait un vrai cycle lecture-écriture). Constat reformulé en incohérence de code (cache écrit jamais consommé) plutôt qu'en bug utilisateur actif ; corrigé par cohérence sur décision du porteur malgré l'absence de symptôme réel — `invalidateTags` ajouté aux 3 services, prouvé par un test qui écrit une vraie entrée de cache taguée et confirme sa disparition après la mutation réelle. Tests réels ajoutés : `taskBulkActions.test.ts` (+1 cas, mesure de temps), `projectModuleCacheInvalidation.test.ts` (nouveau, 3 cas). Vérification complète : serveur `npx tsc --noEmit` (clean), `npm run lint` (0/0), `npx tsx --test test/run-all.test.ts` (395/395, stable sur 2 exécutions, aucun handle Redis resté ouvert). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Audit lancé sur demande explicite du porteur (« maintenant performance »), délégué à un agent dédié en lecture seule, briefé sur la portée déjà couverte par SEC-037/035/053/091 pour éviter tout doublon. Le porteur a explicitement demandé une vérification du constat SEC-098 avant correction (« comment le cache Redis pourrait-il causer une donnée périmée si personne ne le relit ») — la vérification a confirmé que le rapport initial était factuellement inexact sur ce point précis, corrigé dans le registre avant toute action, conformément à l'interdiction de citer une affirmation non vérifiée. Portée de correction choisie via AskUserQuestion : « Traiter les deux tels quels ».** |
| **2026-07-20** | **Audit du module 4.1 CRM & Pipeline commercial (agent dédié, lecture seule) — 2 nouveaux constats (SEC-099, SEC-100), aucun doublon avec SEC-005/028/032/039 déjà résolus sur ce périmètre. SEC-099 (majeur, RG-002) : `assertProposalInScope` et `proposalService.getAll` scopaient le MANAGER sur `Proposal.projectId` (relation « avant », alimentée seulement si la proposition est créée à partir d'un projet déjà existant — quasi toujours nulle) au lieu de `linkedProject` (le projet créé DEPUIS la proposition une fois acceptée, relation « ProjectProposal »). Conséquence vérifiée de bout en bout (routes → controller → service → repository) : un MANAGER ne pouvait ni lister, ni lire, ni modifier, envoyer, accepter ou gérer les sections de ses PROPRES propositions — alors que SEC-028 l'autorise explicitement à en créer. Corrigé en dérivant le pôle de `linkedProject.serviceId` en priorité, sinon du `leadId.serviceId`, sinon des projets existants du client — même logique que `assertProposalCreationInScope` (SEC-028), désormais cohérente entre création et lecture/écriture ; `findById`/`findProposalBySectionId` étendus pour charger les champs nécessaires ; `findAll` (liste) corrigé en miroir exact, exprimé en clause Prisma `OR`/`AND` (un filtre de liste ne peut pas être un throw comme le guard unitaire). Chemins accept/reject confirmés déjà couverts par un appel préalable à `getById` en guard (`proposal.controller.ts`), routes ADMIN-only (delete proposition/section) confirmées non concernées (Admin non scopé par pôle). SEC-100 (mineur) : trois fichiers de test CRM (`lead.repository.test.ts`, `leadService.test.ts`, `proposal.service.test.ts`) réimplémentent localement la logique testée sur un `companyId` fictif absent du dépôt mono-tenant, sans jamais importer le vrai code — vert trompeur, même famille que SEC-087 (task/idor) déjà corrigé, critère de résolution distinct (fichiers CRM) ; laissé `ouvert` sur décision explicite du porteur (« Enregistrer seulement »), aucun correctif dans cette session. Preuve SEC-099 : nouveau fichier `proposalScopeAfterCreation.test.ts` (4 cas, appelle le vrai proposalService contre une base migrée) — un MANAGER retrouve/lit sa proposition via lead avant tout projet, un MANAGER d'un autre pôle reçoit 404 et ne la voit pas dans sa liste, un MANAGER retrouve sa proposition après qu'`acceptWithCascade` ait créé son `linkedProject`, un MANAGER est rejeté sur une proposition liée (via client) exclusivement à un projet d'un autre pôle sans lead. Vérification complète : serveur `npx tsc --noEmit` (clean), `npm run lint` (0/0), `npx tsx --test test/run-all.test.ts` (399/399, stable sur 2 exécutions consécutives). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Audit lancé sur demande explicite du porteur (« existe t il un autre bug ? »), périmètre choisi via AskUserQuestion parmi 4 options (« 4.4 Facturation & Paiements », « 4.1 CRM & Pipeline commercial », « 4.2 Gestion de Projets, 4e passe », « auditLog.service.ts ») — le porteur a choisi 4.1, jamais audité en profondeur (couverture `partiel` dans EXPLORATION.md, repository/controller/frontend jamais lus avant cette session). Délégué à un agent dédié en lecture seule, briefé sur les 4 constats déjà résolus sur ce périmètre pour éviter tout doublon. Traitement de SEC-100 tranché via AskUserQuestion : « Enregistrer seulement » plutôt que corriger dans la même session.** |
| **2026-07-20** | **Question directe du porteur (« existe t il un autre bug ? ») après SEC-099 : partage manuel d'un rapport d'audit externe (5 constats CRM formulé par le porteur lui-même, pas un agent délégué) — tous vérifiés par lecture directe avant enregistrement, aucun doublon. 5 nouveaux constats, TOUS corrigés (SEC-101 à SEC-105). SEC-101 (majeur) : les 3 couches (LeadsKanban.tsx, LeadDetailDialog.tsx, proposal.service.ts) se contredisaient sur les statuts de lead autorisant la création d'une proposition — le Kanban n'affichait le bouton QUE sur WON, exactement le statut que le serveur rejette explicitement (LEAD_ALREADY_WON), donc 100% des clics échouaient ; corrigé en alignant LeadsKanban.tsx sur CONTACTED/QUALIFIED (déjà correct dans LeadDetailDialog.tsx). SEC-102 (majeur, RG-002) : un lead créé via le formulaire manuel « Ajouter un lead » n'avait jamais `serviceId`/`assignedManagerId` renseignés (contrairement au formulaire de contact public, qui les calcule via `resolveServiceIdForType`), le rendant invisible à tout MANAGER (visible seulement par un ADMIN non scopé) ; `lead.controller.ts#createLead` n'appelait même pas `buildScope(req)`. Corrigé : le contrôleur passe désormais le scope, `leadService.createLead` assigne par défaut le pôle et le créateur à un lead créé par un MANAGER. SEC-103 (mineur) : `proposalRepository.findAll` interpolait `options.orderBy` (chaîne arbitraire venant de `req.query`) directement dans la clause Prisma sans whitelist, contrairement à `leadRepository` déjà protégé par `buildOrderBy`/`SORTABLE_FIELDS` — un nom de champ invalide provoquait une 500 au lieu d'un tri par défaut silencieux ; corrigé en appliquant le même utilitaire. SEC-104 (mineur, périmètre élargi en session) : le rapport limitait le défaut de bornes de longueur à `lead.schema.ts`, mais la vérification a montré que `client.schema.ts` avait exactement le même défaut, ainsi que `clientOnboarding.schema.ts`, `freelancer.schema.ts`, `project.schema.ts`, `task.schema.ts` — motif systémique, pas une incohérence locale au module Lead ; en creusant, `server/src/validators/clientOnboarding.validator.ts` (module 4.3, jamais audité en profondeur) s'est révélé porter le même défaut sur ~12 champs texte libre côté serveur — étendu à la correction sur décision explicite du porteur. Bornes `.max(n)` ajoutées partout, dérivées des largeurs de colonnes réelles du schéma Prisma (VarChar/Text). SEC-105 (mineur) : `updateLeadSchema.params.id` validait avec `z.string()` simple alors que delete/convert/reopen exigent `z.string().uuid()` — incohérence de rigueur sur le même paramètre ; aligné. Tests réels ajoutés : `LeadsKanban.test.tsx` (nouveau, 2 cas), `leadCreateScope.test.ts` (nouveau, 2 cas), `proposalListOrderBy.test.ts` (nouveau, 2 cas). Vérification complète : serveur `npx tsc --noEmit` (clean), `npm run lint` (0/0), `npx tsx --test test/run-all.test.ts` (403/403, stable sur 2 exécutions) ; client `npx tsc --noEmit` (clean), `npm run lint` (12 warnings — exception SEC-049, stable), `npx vitest run` (92/92), `npm run build` (succès), `node scripts/check-i18n.mjs` (vert). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Le porteur a partagé un rapport d'audit CRM rédigé par lui-même (pas un agent délégué) après avoir demandé « existe t il un autre bug ? » suite à la clôture de SEC-099. Chacun des 5 constats a été vérifié par lecture directe avant tout enregistrement (procédure d'audit obligatoire), révélant que SEC-104 tel que formulé sous-estimait le périmètre réel (pas isolé au module Lead). Portée de correction choisie via AskUserQuestion : « Tout traiter (5 items) » ; extension du périmètre de SEC-104 à `clientOnboarding.validator.ts` choisie via AskUserQuestion : « Étendre SEC-104 à ce validator aussi ».** |
| **2026-07-20** | **Question directe du porteur (« autres corrections ici ? ») demandant une relecture des propres correctifs SEC-101 à SEC-105 de la session — a révélé un vrai défaut de test (`leadCreateScope.test.ts` laissait un utilisateur MANAGER orphelin en base si une assertion échouait avant le nettoyage manuel en fin de cas réussi), corrigé par tracking dans `createdUserIds` + nettoyage dans le hook `after()` global (403/403 reconfirmé). Puis partage d'un second rapport d'audit CRM par le porteur (volets Ingénieur Full-Stack/Sécurité/UI-UX/Product Owner) — 3 nouveaux constats confirmés (SEC-106, SEC-107), 1 confirmé mais laissé sans correctif de code sur décision explicite (SEC-108, question produit ouverte), tous corrigés/traités. SEC-106 (mineur) : `ClientsPage.tsx` affichait toujours le bouton « Ajouter un client », sans le garde `usePermission` déjà appliqué à `LeadsPage.tsx` — le rapport source citait aussi `ProposalsPage.tsx` comme touché, vérifié et INFIRMÉ (ce fichier n'a aucun bouton de création, les propositions se créent uniquement depuis les vues Lead) ; corrigé sur `ClientsPage.tsx` seul, vérifié que `POST /clients` est `authorize("ADMIN")` uniquement côté serveur donc le correctif ne bloque aucun usage légitime d'un Manager. SEC-107 (mineur) : la modale « Marquer comme perdu » de `LeadsKanban.tsx` avait son titre, sa description, son placeholder et ses 2 boutons en français codé en dur, seule zone non traduite d'un fichier qui utilise `react-i18next` partout ailleurs ; corrigé par 3 nouvelles clés FR/EN (`markAsLostTitle/Desc/Placeholder`) et réutilisation des clés génériques déjà existantes `common.cancel`/`common.confirm`. SEC-108 (mineur, laissé `ouvert`) : colonnes du Kanban Leads à largeur fixe (280-320px) avec défilement horizontal uniquement, non pensé mobile-first — confirmé conforme au rapport, mais qualifié de question produit ouverte (aucune exigence mobile documentée dans REFERENTIEL.md pour ce module), pas un bug contre une exigence existante ; pas de correctif sans décision produit préalable. Tests réels ajoutés : `ClientsPage.test.tsx` (nouveau, 2 cas), `leadsKanbanI18n.test.tsx` (nouveau, 2 cas — résolution i18n réelle + absence de texte source, pas de simulation de drag-and-drop dnd-kit jugée disproportionnée pour ce point précis). Vérification complète : client `npx tsc --noEmit` (clean), `npm run lint` (12 warnings — exception SEC-049, stable), `npx vitest run` (96/96, stable sur 2 exécutions), `npm run build` (succès), `node scripts/check-i18n.mjs` (vert) ; serveur inchangé cette passe, revérifié `npx tsc --noEmit`/`npm run lint` propres par précaution. Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Le porteur a demandé une relecture à froid des correctifs SEC-101-105 avant de partager un second rapport d'audit CRM rédigé par lui-même. Chaque constat vérifié par lecture directe avant enregistrement ; l'inexactitude sur `ProposalsPage.tsx` (pas de bouton de création sur cette page) signalée avant d'agir, périmètre de SEC-106 corrigé en conséquence. Portée de correction choisie via AskUserQuestion : « Tout corriger (3 items) » — incluant explicitement le traitement de SEC-108 comme limitation documentée plutôt que comme correctif de code, faute de décision produit sur l'usage mobile réel du module.** |
| **2026-07-20** | **Demande explicite du porteur (« Traiter SEC-100 maintenant ») après avoir choisi cette option parmi 4 propositions pour la suite de l'audit CRM. SEC-100 (mineur) résolu : les 3 fichiers de test déjà signalés comme réimplémentations locales sur un `companyId` fictif (`lead.repository.test.ts`, `leadService.test.ts`, `proposal.service.test.ts`) réécrits pour appeler le vrai code contre une base migrée. `lead.repository.test.ts` : appelle `leadRepository.findById`/`findAll` réels, couvre les 2 branches du vrai `OR` de scoping (`serviceId` ET `assignedManagerId`, cette dernière jamais testée par l'ancienne version), l'exclusion/inclusion des leads archivés, et le filtrage de liste MANAGER. `leadService.test.ts` : bloc `serviceMapping.serviceNameForType` (déjà réel) conservé, bloc `serviceFilter` fictif remplacé par des appels réels à `leadService.getLeads` couvrant les mêmes branches. `proposal.service.test.ts` : entièrement réécrit, appelle `proposalService.reject`/`send`/`update`/`acceptWithCascade` réels (transitions de statut, guards `INVALID_PROPOSAL_TRANSITION`/`PROPOSAL_VERSION_MISMATCH`, revert-to-draft sur contenu réellement modifié avec entrée d'historique réelle, absence de revert sur no-op ou champ non-contenu). En vérifiant SEC-100, un défaut analogue hors périmètre a été repéré et enregistré séparément (SEC-109, laissé `ouvert`) : `proposalAcceptCascade.test.ts` a le même défaut de réimplémentation `companyId` fictive, mais `acceptWithCascade` lui-même est déjà couvert par du code réel ailleurs (portalActivationOnPayment, projectCreateArchiveRestore, proposalScopeAfterCreation, et désormais le guard de version dans proposal.service.test.ts) — pas de trou de couverture réel, juste un test vert trompeur supplémentaire, non traité dans cette passe (hors périmètre de la tâche demandée). Vérification complète serveur : `npx tsc --noEmit` (clean), `npm run lint` (0/0), `npx tsx --test test/run-all.test.ts` (394/394, stable sur 2 exécutions consécutives — total de tests en baisse par rapport à avant cette passe car les nombreux tests fictifs unitaires sont remplacés par moins de tests réels contre une vraie base, chacun prouvant davantage). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Le porteur a choisi de traiter SEC-100 immédiatement plutôt que de changer de module ou de trancher SEC-108, parmi 4 options proposées via AskUserQuestion après un bilan de l'état du module CRM (3 passes d'audit déjà effectuées cette session). Le défaut analogue SEC-109, repéré incidemment pendant la vérification du périmètre exact de SEC-100, enregistré immédiatement dans ANOMALIES.yaml conformément à la règle d'enregistrement immédiat de tout écart constaté hors d'un audit formel, plutôt que différé à une session ultérieure.** |
| **2026-07-20** | **SEC-108 résolue (question produit tranchée par le porteur : « Oui, ajouter une vue mobile ») — le Kanban Leads (colonnes à largeur fixe, défilement horizontal uniquement) reçoit une vue mobile alternative, même pattern que SEC-056/U2 sur `TasksListView.tsx`. Différence délibérée : la liste de tâches était déjà linéaire (facile à empiler), le Kanban Leads est structuré par colonnes de statut — la vue mobile groupe donc les leads par statut (sections empilées, une par statut non vide, en-tête + compteur) plutôt que de les aplatir ensemble, pour préserver cette distinction. Kanban desktop existant encapsulé tel quel dans `hidden sm:block` (zéro changement de comportement) ; nouvelle vue `sm:hidden` avec un composant `MobileLeadCard` (mêmes informations que la carte desktop). Le drag-and-drop dnd-kit (basé pointeur, non fiable au toucher) est remplacé sur mobile par un `Select` n'offrant que les transitions valides (`NEXT_STATUSES[lead.status]`, déjà la source de vérité côté drag desktop) — aucune nouvelle règle métier, un second moyen d'invoquer la même mutation partageant la même confirmation obligatoire pour une transition vers LOST (modale déjà existante). Nouvelle clé i18n FR/EN `leadsPage.changeStatus`. Tests réels : `LeadsKanban.test.tsx` étendu de 2 cas (présence scopée des deux conteneurs, sélecteur de statut) ; les 2 cas SEC-101 existants corrigés pour scoper leurs assertions au conteneur desktop uniquement (JSDOM monte les deux vues simultanément, ne simulant aucune media query — sans ce scoping les tests auraient compté les boutons en double). Vérification complète client : `npx tsc --noEmit` (clean), `npm run lint` (12 warnings — exception SEC-049, stable), `npx vitest run` (98/98, stable sur 2 exécutions), `npm run build` (succès), `node scripts/check-i18n.mjs` (vert) ; serveur inchangé cette passe, revérifié `npx tsc --noEmit`/`npm run lint` propres par précaution. Note méthodologique : un fichier hors du périmètre de cette tâche (`client/src/features/client-portal/DocumentsClientPage.tsx`), non commité et modifié par une session antérieure non documentée, est apparu brièvement absent du disque pendant une vérification `tsc` puis réapparu — signalé tel quel sans y toucher, conformément à la règle d'attribution des changements (non attribuable à cette session). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Le porteur a choisi de trancher SEC-108 (« Trancher SEC-108 (Kanban mobile) ») parmi 3 options proposées après la résolution de SEC-100. Question de fond posée via AskUserQuestion avant tout code : « le Kanban Leads doit-il avoir une vue mobile alternative, comme SEC-056/U2 l'a fait pour la liste des tâches ? » — le porteur a choisi « Oui, ajouter une vue mobile (Recommandé) », tranchant définitivement la question produit qui bloquait toute correction depuis l'enregistrement initial du constat.** |
| **2026-07-20** | **Constat de sécurité transmis directement par le porteur (liens fichier/ligne), hors du périmètre CRM audité jusqu'ici — protection anti-rejeu des callbacks n8n. SEC-110 (majeur) résolue : `verifyN8nWebhook` ne s'appuyait que sur un garde Redis fail-open (« signature déjà vue ») comme unique barrière anti-rejeu — un callback capturé, valablement signé, restait rejouable indéfiniment si Redis était indisponible, ou pendant toute la fenêtre de 5 minutes même avec Redis opérationnel. Impact vérifié réel, pas hypothétique : `PATCH /projects/:id/ai-specs` (`regenerateSpecsWithAiContent`) n'est PAS idempotent — chaque appel crée un nouveau document versionné (`version: previous.version + 1`), un rejeu produit donc une pollution cumulative réelle de versions de documents. Corrigé par une nouvelle fonction `verifyN8nTimestamp` exigeant un champ `timestamp` (epoch ms) dans le corps signé, dans une fenêtre de fraîcheur de 5 minutes (rejette aussi un timestamp futur, contre horloge décalée ou forgée) — vérifiée indépendamment de Redis, juste après la signature HMAC et avant le contrôle Redis (qui reste une seconde barrière, comportement fail-open inchangé). Ceci constitue un changement de CONTRAT entre systèmes (pas seulement de code serveur) : tout workflow n8n rappelant un `callbackUrl` doit désormais inclure ce `timestamp` dans le corps qu'il signe — documenté dans `docs/n8n-events.md`. Preuve : nouveau fichier `server/test/verifyN8nWebhook.test.ts` (5 cas, vraie signature HMAC calculée avec le secret réel de l'environnement) — timestamp périmé rejeté malgré signature valide (scénario de rejeu exact), timestamp absent rejeté, timestamp futur rejeté, timestamp frais accepté, signature invalide toujours rejetée indépendamment de la fraîcheur. Vérification complète serveur : `npx tsc --noEmit` (clean), `npm run lint` (0/0), `npx tsx --test test/run-all.test.ts` (399/399, stable sur 2 exécutions consécutives). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Constat transmis directement par le porteur avec citations précises de fichier/ligne, en dehors de toute demande d'audit formel — enregistré et traité immédiatement (règle CLAUDE.md sur l'enregistrement immédiat de tout écart constaté). Vérifié par lecture directe avant toute action : le commentaire du code lui-même (déjà honnête sur sa limite) et l'impact réel confirmé sur `projectSpecs.service.ts` (non-idempotence, pas supposée). Portée de correction choisie via AskUserQuestion : « Corriger maintenant (Recommandé) ».** |
| **2026-07-20** | **Constat de performance/scalabilité (8 points) transmis directement par le porteur, hors du périmètre CRM audité jusqu'ici. 5 constats confirmés et corrigés (SEC-116, SEC-118, SEC-119, SEC-120 + SEC-117 infirmé/rejeté), 1 laissé hors décision produit (managerPermission, voir note distincte), 2 mineurs/informationnels non traités (prefetch navigation, observabilité — déjà qualifiés non prioritaires par le rapport lui-même). SEC-116 (mineur) : `ProjectsClientPage.tsx` montait un `ProjectTimeline` (polling 30s) par carte projet, jusqu'à 100 cartes par client, sans plafond — corrigé par un composant `LazyProjectTimeline` (IntersectionObserver, monte le vrai composant seulement quand la carte devient visible). SEC-117 (mineur, rejeté) : le rapport affirmait l'absence de garde Page Visibility API sur le polling — vérification du code source de la librairie (`@tanstack/query-core`) a INFIRMÉ ce point : `refetchInterval` est déjà conditionné par défaut à `focusManager.isFocused()` (câblé sur `visibilitychange`), aucun code de ce dépôt ne force `refetchIntervalInBackground: true` — rien à corriger, le comportement demandé existe déjà nativement. SEC-118 (majeur) : le rapport signalait `pageSize: 200` sur le Kanban Leads comme un simple souci de performance — vérification a révélé un défaut plus grave : `parseListQuery` plafonnait TOUT `pageSize` à 50 côté serveur, donc le Kanban ne chargeait JAMAIS 200 leads, seulement 50 au maximum, silencieusement — un pipeline de plus de 50 leads perdait une partie de ses leads sans aucune indication. Corrigé par un plafond spécifique à cet endpoint (`LEADS_MAX_PAGE_SIZE = 500`, `parseListQuery` accepte un `maxPageSize` optionnel, défaut 50 inchangé partout ailleurs). En vérifiant ce correctif, un test flaky préexistant a été trouvé et corrigé dans `leadService.test.ts` (commité sous SEC-100) : 4 appels à `getLeads` omettaient `orderDir` (champ non optionnel du type), produisant un tri Prisma non déterministe qui risquait de faire sortir les leads du test de la première page de résultats selon le volume déjà présent en base — corrigé par `orderDir: "desc"` explicite sur les 4 appels. SEC-119/SEC-120 (majeurs) : les jobs BullMQ (notification/email/génération de documents) n'avaient aucun `jobId` déterministe — un double enfilement du même événement métier (ex. requête HTTP cliente retentée après un crash serveur avant la réponse originale) produisait un envoi/document dupliqué, aggravé pour les documents par la non-idempotence de `regenerateSpecsWithAiContent` déjà établie sous SEC-110. Corrigé par des `jobId` déterministes dérivés de l'identité métier de chaque job (type+entité+destinataire pour les notifications, `dedupeKey` optionnel pour les emails sans identité inhérente, kind+entité pour les documents) — découverte en pratique que BullMQ rejette tout `jobId` contenant `:` (réservé à son espace de noms interne), `|` utilisé comme séparateur partout. Tests réels ajoutés : `ProjectsClientPage.test.tsx` (nouveau, 2 cas), `leadsKanbanMaxPageSize.test.ts` (nouveau, 3 cas), `jobDeduplication.test.ts` (nouveau, 5 cas, contre une vraie file BullMQ/Redis). Vérification complète serveur : `npx tsc --noEmit` (clean), `npm run lint` (0/0), `npx tsx --test test/run-all.test.ts` (415/415, stable sur 2 exécutions consécutives). Vérification client limitée par une session concurrente non liée : `npx tsc --noEmit` et `npm run lint` propres sur les fichiers de ce périmètre précis, mais le typecheck global, `npm run build` et `node scripts/check-i18n.mjs` échouent à cause d'un fichier tiers non commité (`ServiceRequestsAdminPage.tsx`, imports dupliqués) et d'une clé i18n manquante (`common.send`, `TaskDetailDrawer.tsx`) — aucun des deux n'est touché par cette session ; `npx vitest run` reste vert (100/100, stable sur 2 exécutions, esbuild ne bloque pas sur ces erreurs de type). Résolu SANS confirmation CI : workflow GitHub Actions sur `origin/main` en `workflow_dispatch` uniquement (déviation établie en session le 2026-07-17, citée à chaque clôture depuis).** | **Constat transmis directement par le porteur, en dehors de toute demande d'audit formel — enregistré et traité immédiatement. Portée de correction choisie via AskUserQuestion : « Traiter les 5 confirmes (#1,#2,#3,#5,#6) (Recommandé) ». Le constat #4 (managerPermission) décrivait du code non commité d'une session concurrente s'exécutant en parallèle sur la même copie de travail — enregistré séparément (SEC-121) avec statut `rejete` : rien à corriger dans le dépôt versionné tel qu'il existe, conformément à la règle d'attribution des changements (un changement n'est attribuable à cette session que s'il figure dans ses propres éditions).** |
| **2026-07-20** | **Décision rétroactivement écrite ici (existait seulement dans la note SEC-010 jusqu'à ce jour, en écart avec la règle « toute décision s'écrit dans §7 dans la même passe ») : ne PAS réactiver le déclenchement automatique `push`/`pull_request` de `.github/workflows/ci.yml`, ni le déclencher manuellement, à ce moment-là. `ci.yml` restait donc en `workflow_dispatch` seul.** | **AskUserQuestion, session du 2026-07-20 : le porteur a choisi de laisser SEC-010 `en_cours` plutôt que de réactiver le trigger ou de déclencher manuellement le workflow (citée mot pour mot dans la note SEC-010 : « SEC-010 reste `en_cours` en l'état »).** |
| **2026-07-22** | **Décision du 2026-07-20 ci-dessus RÉVOQUÉE : les déclencheurs `pull_request`/`push` de `.github/workflows/ci.yml` sont réactivés (décommentés). Le premier push vers `origin/main` qui en résulte doit être vu vert par la CI avant que SEC-010 (et tout autre `en_cours` dont le critère dépend d'une CI verte) ne passe `resolu`.** | **Confirmation explicite du porteur du projet, AskUserQuestion, session du 2026-07-22 : choix « Tout faire dans cet ordre, y compris réactiver le trigger CI » parmi 3 options proposées, en réponse directe à la question posant que la décision du 2026-07-20 devait être explicitement révoquée pour procéder.** |
| **2026-07-22** | **SEC-176 (rate limiting) — décision explicite sur les 7 derniers fichiers cités par son périmètre (`analytics`, `dashboard`, `search`, `service`, `summary`, `clientPortal.routes.ts`, plus le 7e non nommé explicitement par la demande) : AUCUN n'a besoin de `sensitiveWriteRateLimit` — vérifié fichier par fichier par lecture directe intégrale, confirmé par `grep -nE "\.(post|put|patch|delete)\("` sur chacun des 6 fichiers nommés : zéro résultat sur les 6. Ces 6 fichiers ne contiennent QUE des routes `GET` (lecture pure), donc le critère de résolution de SEC-176 (« chaque route d'écriture authentifiée POST/PUT/PATCH/DELETE ») ne s'applique littéralement à aucune route de ces fichiers — ce n'est pas une dérogation à motiver (aucune route à exempter), c'est une non-applicabilité du critère lui-même, vérifiée et tracée plutôt que supposée.** | **Demande explicite du porteur de trancher les 7 fichiers restants du périmètre SEC-176 (rate limiting), un par un, par ajout du middleware ou dérogation motivée — jamais par silence. Vérification fichier par fichier avant toute décision : aucun n'avait de route d'écriture à protéger.** |
