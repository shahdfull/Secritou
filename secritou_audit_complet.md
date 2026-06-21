# SECRITOU — RAPPORT D'AUDIT PRÉ-PRODUCTION
## Comité d'Architecture SaaS Enterprise

> **Classification :** CONFIDENTIEL — Usage interne  
> **Version :** 1.0  
> **Périmètre :** Audit métier complet, 120 questions, 20 modules  
> **Verdict préliminaire :** NON CERTIFIÉ POUR PRODUCTION COMMERCIALE

---

## LÉGENDE DES PRIORITÉS

| Priorité | Définition |
|----------|------------|
| **P0** | Bloquant absolu. Risque légal, financier ou sécuritaire immédiat. Production impossible. |
| **P1** | Critique. À corriger avant le premier client payant. |
| **P2** | Important. À corriger avant la montée en charge (>10 clients). |
| **P3** | Amélioration. À planifier dans les 3 prochains sprints. |

---

# MODULE 1 — CRM

---

### Q1 — Doublon de client à la conversion d'un lead

**Réponse métier idéale :** La conversion d'un lead en client doit obligatoirement déclencher une vérification d'unicité par email dans le scope de la company avant toute création. Si un client avec cet email existe, la conversion propose une fusion (merge) plutôt qu'une création. La fusion préserve l'historique du lead (source, date, interactions) sur la fiche client existante.

**Règle métier recommandée :** Un email est une clé d'unicité au sein d'une company. La conversion est bloquée avec un message explicite : "Un client avec cet email existe déjà — fusionner ou annuler." La fusion est tracée dans l'audit log avec l'identité de l'utilisateur qui l'a déclenchée.

**Impact utilisateur :** Sans cette règle, deux managers peuvent contacter le même client en parallèle, envoyer deux devis différents, voire deux onboardings. Le client reçoit deux accès portail distincts avec des données incohérentes.

**Impact financier :** Deux factures pour le même client, paiements impossibles à réconcilier, litige contractuel sur le devis applicable.

**Impact technique :** Contrainte d'unicité `UNIQUE(email, companyId)` sur la table `Client`. Service de merge avec stratégie de résolution de conflits (champ par champ). Middleware de détection avant `createClient`.

**Priorité : P1**

---

### Q2 — Suppression d'un lead avec historique d'activités

**Réponse métier idéale :** Un lead ayant généré au moins une interaction (note, email, appel) ne peut pas être hard-deleté. Il doit passer en `ARCHIVED` avec conservation complète de l'historique. Seul un ADMIN peut purger définitivement, après une fenêtre de 90 jours et avec saisie d'un motif obligatoire.

**Règle métier recommandée :** `DELETE` sur un lead avec activités → erreur `LEAD_HAS_ACTIVITY`. Action proposée : archiver. La purge physique est réservée à un endpoint `DELETE /admin/leads/:id/purge` avec double confirmation.

**Impact utilisateur :** Un manager ne peut pas effacer ses erreurs commerciales. La piste d'activité est préservée pour le reporting.

**Impact financier :** Conservation des données de performance commerciale. Possibilité d'audit rétroactif en cas de litige client.

**Impact technique :** Champ `archivedAt` + `archivedBy` sur `Lead`. Index partiel `WHERE archivedAt IS NULL` pour les requêtes courantes. Hook `beforeDelete` dans le repository.

**Priorité : P1**

---

### Q3 — Réassignation cross-tenant d'un lead

**Réponse métier idéale :** La réassignation d'un lead ne peut cibler qu'un utilisateur appartenant à la même company. L'interface ne doit même pas afficher les utilisateurs d'autres tenants.

**Règle métier recommandée :** Le service de réassignation vérifie que `targetUser.companyId === lead.companyId` avant toute modification. Cette vérification est doublée par la contrainte de clé étrangère en base.

**Impact utilisateur :** Aucune fuite d'information possible entre agences concurrentes utilisant la même instance.

**Impact financier :** Prévention d'une violation RGPD (communication de données d'un client à une company tierce) pouvant entraîner une amende CNIL.

**Impact technique :** Validation ajoutée dans `lead.service.ts::reassignLead`. Test unitaire dédié. Le test E2E `tenant-isolation.spec.ts` doit couvrir ce cas spécifiquement.

**Priorité : P2**

---

### Q4 — Leads orphelins après suppression d'un manager

**Réponse métier idéale :** La désactivation d'un utilisateur (manager, admin) déclenche obligatoirement une réassignation de ses ressources actives (leads, projets, tickets) avant que la désactivation ne soit effective. L'interface bloque la désactivation et présente la liste des ressources à réassigner.

**Règle métier recommandée :** `PATCH /users/:id/deactivate` vérifie les ressources actives. Si des leads non convertis existent, retour `409 USER_HAS_ACTIVE_RESOURCES` avec la liste. L'admin choisit un repreneur ou sélectionne "réassigner à moi-même". Après réassignation complète, la désactivation est autorisée.

**Impact utilisateur :** Aucun lead ne tombe dans l'oubli. Continuité commerciale garantie.

**Impact financier :** Un lead chaud non traité pendant 48h est statistiquement perdu. Perte directe de revenu.

**Impact technique :** Query préalable à la désactivation sur `Lead`, `Project`, `Question` filtrés par `assignedTo`. Transaction : réassignation + désactivation atomiques.

**Priorité : P1**

---

# MODULE 2 — LEADS

---

### Q5 — Double soumission du formulaire de contact

**Réponse métier idéale :** Le formulaire public doit être idempotent. Une soumission avec le même email dans une fenêtre de 24 heures ne crée pas de second lead mais met à jour le lead existant (message, date de contact) et notifie le manager responsable.

**Règle métier recommandée :** Vérification `email + companyId + createdAt > NOW() - 24h` avant création. Si match : update du lead existant + log de la tentative de doublon. La réponse côté formulaire est identique dans les deux cas (anti-énumération).

**Impact utilisateur :** Le client ne reçoit pas deux appels de deux managers différents. L'agence ne traite pas deux fois le même dossier.

**Impact financier :** Réduction du temps commercial gaspillé sur des doublons.

**Impact technique :** Index sur `(email, companyId, createdAt)`. Logique dans `lead.service.ts::createFromContactForm`. Rate limiting spécifique sur l'endpoint public.

**Priorité : P1**

---

### Q6 — Conversion d'un lead sans manager assigné

**Réponse métier idéale :** Un lead sans `assignedTo` ne peut pas être converti en client. Le service de conversion doit vérifier la présence d'un responsable avant de procéder. Si aucun manager n'est disponible, la conversion est proposée avec assignation forcée à l'ADMIN.

**Règle métier recommandée :** `convertLeadToClient` : si `lead.assignedTo === null` → erreur `LEAD_UNASSIGNED`. Message : "Veuillez assigner ce lead à un manager avant de le convertir." Fallback configurable par company : auto-assignation à l'ADMIN.

**Impact utilisateur :** Le client créé a toujours un interlocuteur identifié dès le premier jour.

**Impact financier :** Un client sans responsable ne reçoit pas ses devis, ses onboardings ne démarrent pas. Perte d'une relation commerciale pourtant qualifiée.

**Impact technique :** Vérification dans `lead.service.ts::convertToClient`. Contrainte NOT NULL sur `Client.assignedManagerId` à envisager.

**Priorité : P1**

---

### Q7 — Lead bloqué si quota utilisateurs dépassé

**Réponse métier idéale :** La gestion des quotas doit être découplée des workflows métier. Si un quota est atteint, les leads existants continuent d'être traités normalement. Seule la création de nouveaux utilisateurs est bloquée.

**Règle métier recommandée :** Les quotas s'appliquent à la création d'entités (utilisateurs, projets, stockage), jamais à la lecture ou modification des entités existantes. Un lead orphelin dû à un quota n'existe pas dans ce modèle.

**Impact utilisateur :** Aucune interruption opérationnelle pour les leads en cours de traitement.

**Impact financier :** Aucune perte de lead due à une limite technique de compte.

**Impact technique :** Middleware de vérification de quota uniquement sur les endpoints de création d'utilisateurs. Pas de vérification sur les workflows lead/client.

**Priorité : P3**

---

### Q8 — Collision Lead / FreelancerApplication sur même email

**Réponse métier idéale :** Le système doit détecter une même adresse email présente simultanément dans la pipeline Lead ET FreelancerApplication et générer une alerte de fusion potentielle. Les deux parcours sont fondamentalement différents : un lead est un prospect client, un candidat est un prestataire potentiel.

**Règle métier recommandée :** À la création de tout objet portant un email (Lead, FreelancerApplication, ContactRequest), un hook cross-module vérifie l'existence de l'email dans les autres entités et génère une notification `IDENTITY_CONFLICT` visible uniquement par les ADMINs.

**Impact utilisateur :** Un admin peut décider consciemment : la même personne peut être à la fois prospect et freelance, ou c'est une erreur à corriger.

**Impact financier :** Prévention du double-traitement commercial (appeler quelqu'un pour lui vendre des services alors qu'il postule pour en rendre).

**Impact technique :** Service `identityConflict.service.ts` avec query cross-tables sur email. Notification interne `ADMIN_ONLY`.

**Priorité : P2**

---

# MODULE 3 — CLIENTS

---

### Q9 — Suppression d'un client avec factures impayées

**Réponse métier idéale :** La suppression d'un client (même soft-delete) est strictement bloquée si l'une des conditions suivantes est vraie : (a) solde comptable non nul, (b) onboarding non terminé, (c) projet actif, (d) devis en cours. L'archivage (soft-delete) est autorisé uniquement si toutes les factures sont soldées ou annulées avec avoir.

**Règle métier recommandée :** `DELETE /clients/:id` → vérification en cascade : `Invoice.status IN ('DRAFT','SENT','PARTIAL','OVERDUE')` → erreur `CLIENT_HAS_PENDING_FINANCIALS`. Message détaillé listant les obstacles. L'admin doit solder ou annuler chaque obstacle manuellement avant de pouvoir archiver.

**Impact utilisateur :** Impossibilité d'effacer accidentellement un client actif. Protection contre les mauvaises manipulations.

**Impact financier :** Protection de la piste comptable. Obligation légale de conservation des données comptables (7 ans, CGI art. 54).

**Impact technique :** Transaction de vérification en cascade avant toute suppression. Soft-delete avec `deletedAt` + `deletedBy` + `deletionReason` (obligatoire). Hard-delete impossible via API.

**Priorité : P0**

---

### Q10 — Modification de l'email principal d'un client

**Réponse métier idéale :** Le changement d'email d'un compte client doit suivre un workflow de double confirmation : (1) email envoyé à l'ancienne adresse avec lien "Ce n'est pas moi" (24h pour annuler), (2) email envoyé à la nouvelle adresse avec lien de confirmation. Le changement n'est effectif qu'après confirmation de la nouvelle adresse ET absence d'annulation depuis l'ancienne.

**Règle métier recommandée :** Status intermédiaire `EMAIL_CHANGE_PENDING` avec `pendingEmail` + `emailChangeToken` + `emailChangeExpiresAt`. Cron de nettoyage des demandes expirées. Log d'audit horodaté avec IP + user-agent de la demande initiale.

**Impact utilisateur :** Protection totale contre la prise de contrôle de compte par modification d'email par un tiers malveillant ou un manager peu scrupuleux.

**Impact financier :** Prévention d'une fraude à la facturation (redirection des factures vers une adresse contrôlée par un tiers).

**Impact technique :** Champs `pendingEmail`, `emailChangeToken`, `emailChangeExpiresAt` sur `User`. Deux endpoints : `POST /auth/request-email-change` et `GET /auth/confirm-email-change?token=...`. Job de nettoyage.

**Priorité : P0**

---

### Q11 — Client mauvais payeur soumettant un nouveau devis

**Réponse métier idéale :** Le système doit calculer un indicateur de risque client visible au moment de la revue d'un devis. Si le client a ≥2 factures OVERDUE ou un score Client Success financier < 40/100, le devis ne peut pas être envoyé automatiquement — il nécessite une validation manuelle ADMIN avec motif.

**Règle métier recommandée :** `sendProposal` → calcul du `clientRiskScore` (nombre de factures OVERDUE + montant total impayé + délai moyen de paiement). Niveau `HIGH_RISK` : blocage de l'envoi automatique + notification urgente à l'ADMIN. L'ADMIN peut forcer l'envoi avec override documenté.

**Impact utilisateur :** L'agence ne s'expose pas à de nouveaux impayés pour un client déjà défaillant.

**Impact financier :** Prévention directe de pertes financières. Un client avec 3 factures OVERDUE qui reçoit un 4ème devis est un risque avéré.

**Impact technique :** `clientRiskScore.service.ts` appelé dans `proposal.service.ts::send`. Score composite stocké en cache Redis (TTL 5 min, invalidé à chaque paiement/facture).

**Priorité : P1**

---

### Q12 — Édition simultanée du profil client par deux admins

**Réponse métier idéale :** Optimistic locking obligatoire sur toutes les entités modifiables par plusieurs utilisateurs. Chaque entité porte un champ `version` (entier auto-incrémenté). La requête de mise à jour inclut la version connue du client. Si la version en base est supérieure, la mise à jour est rejetée avec `409 CONFLICT` et un diff des champs en conflit est renvoyé.

**Règle métier recommandée :** `UPDATE clients SET ..., version = version + 1 WHERE id = :id AND version = :expectedVersion`. Si 0 ligne affectée → conflit détecté → retour des données actuelles pour merge manuel.

**Impact utilisateur :** Le deuxième admin voit clairement "Ce champ a été modifié par [Nom] il y a 2 minutes — voici la valeur actuelle." Il peut merger ou écraser en connaissance de cause.

**Impact financier :** Prévention de l'écrasement de l'adresse de facturation d'un client, évitant des factures envoyées à la mauvaise adresse.

**Impact technique :** Champ `version INTEGER DEFAULT 1` sur `Client`, `Invoice`, `Proposal`. `@prisma/client` supporte le optimistic locking via `update` avec condition sur `version`.

**Priorité : P1**

---

### Q13 — Langue du portail et documents déjà générés

**Réponse métier idéale :** La langue du portail client est distincte de la langue des documents. Les documents PDF sont générés dans la langue active au moment de leur création et cette langue est figée sur le document. Un changement de langue du portail n'affecte que les futurs documents.

**Règle métier recommandée :** Champ `locale` sur chaque document généré (devis PDF, facture PDF) fixé à la création. La langue du portail client est un paramètre d'affichage uniquement, sans impact rétroactif sur les documents existants.

**Impact utilisateur :** Cohérence documentaire garantie. Un devis signé en français reste en français même si le client change la langue de son portail en anglais le lendemain.

**Impact financier :** Prévention de litiges contractuels ("j'ai signé en français mais la facture est en anglais").

**Impact technique :** Champ `locale VARCHAR(5)` sur `Invoice`, `Proposal`. Passé au moteur de rendu PDF à la génération.

**Priorité : P2**

---

# MODULE 4 — PROJETS

---

### Q14 — Projet suspendu avec missions freelance actives

**Réponse métier idéale :** La suspension d'un projet déclenche automatiquement : (1) passage de toutes les missions freelance liées en statut `PAUSED`, (2) notification immédiate à chaque freelance concerné avec motif de suspension, (3) gel de toute création de nouvelles entrées de temps ou livrables. La suspension est réversible — la reprise du projet réactive les missions `PAUSED`.

**Règle métier recommandée :** `suspendProject` : transaction atomique — `Project.status = SUSPENDED` + `FreelancerMission.status = PAUSED WHERE projectId = :id AND status = ACTIVE` + notifications asynchrones (queue). Pas de suppression de données, seulement un gel.

**Impact utilisateur :** Le freelance ne travaille pas "dans le vide" sur un projet gelé. Le client n'est pas facturé pour du travail fait sur un projet suspendu sans son accord.

**Impact financier :** Prévention de coûts freelance engagés sur un projet dont le client n'a pas encore validé la continuation.

**Impact technique :** Enum `ProjectStatus` enrichi de `SUSPENDED`. Cascade gérée dans le service. Index sur `(projectId, status)` dans `FreelancerMission`.

**Priorité : P1**

---

### Q15 — Suppression d'un projet avec factures associées

**Réponse métier idéale :** Un projet ayant généré au moins une facture émise (hors DRAFT) ne peut jamais être supprimé, même par un ADMIN. Il peut uniquement être archivé (soft-delete). Les données restent accessibles en lecture seule depuis le module Reporting et depuis la fiche client.

**Règle métier recommandée :** `archiveProject` (jamais `deleteProject` pour un projet avec factures) : `Project.archivedAt = NOW()`. Toutes les données (tâches, documents, missions) passent en lecture seule. Endpoint `GET /projects/:id` retourne les données archivées avec un bandeau "Projet archivé le [date]".

**Impact utilisateur :** Un client peut toujours consulter l'historique d'un projet terminé depuis son portail.

**Impact financier :** Conformité comptable. Les factures d'un projet doivent rester consultables pendant 7 ans minimum.

**Impact technique :** Soft-delete standard. Guard dans `project.service.ts::delete` : si `Invoice.count WHERE projectId > 0 AND status != DRAFT` → erreur `PROJECT_HAS_INVOICES`. Seul `archive` est autorisé.

**Priorité : P0**

---

### Q16 — Impact de la suppression d'un projet sur le score Client Success

**Réponse métier idéale :** Le score Client Success ne doit jamais être recalculé sur des données partielles. Si un projet est archivé, ses données historiques (taux de paiement, délais, objectifs complétés) sont conservées dans le calcul du score jusqu'à la date d'archivage, puis gelées. Les projets archivés contribuent au score historique mais ne dégradent pas le score actuel.

**Règle métier recommandée :** Le score est calculé sur deux fenêtres distinctes : score 12 mois glissants (inclut les projets archivés dans la fenêtre) + score actif (projets non archivés uniquement). Le score affiché est le composite des deux. La suppression physique de données invalide les deux composantes — raison supplémentaire pour interdire les hard-deletes.

**Impact utilisateur :** Un client dont un projet est terminé et archivé conserve un score cohérent et ne voit pas son évaluation se dégrader artificiellement.

**Impact financier :** Un score Client Success fiable est un outil commercial (upsell, renouvellement). Un score faussé génère de mauvaises décisions commerciales.

**Impact technique :** `clientSuccess.service.ts` doit filtrer sur `Project.archivedAt IS NULL` pour le score actif et inclure tous les projets dans la fenêtre 12 mois pour le score historique.

**Priorité : P2**

---

### Q17 — Changement de chef de projet

**Réponse métier idéale :** Le transfert de propriété d'un projet suit un workflow : (1) désignation du nouveau manager par un ADMIN, (2) notification au client, au nouveau manager, à l'ancien manager et aux freelances assignés, (3) l'ancien manager passe en lecture seule sur le projet pendant 30 jours (période de passation), (4) transfert des tâches et accès documentaires.

**Règle métier recommandée :** `transferProjectOwnership(projectId, newManagerId, oldManagerId)` : atomique. Champ `previousManagerId` conservé sur le projet pour l'historique. Email de passation généré avec la liste des points en cours.

**Impact utilisateur :** Le client sait qui contacter. Le nouveau manager a accès à tout le contexte. Aucune rupture de service.

**Impact financier :** Prévention de l'oubli de relances de paiement ou de livrables pendant une période de transition non gérée.

**Impact technique :** Champs `managerId` (actuel) + `previousManagerId` + `ownershipTransferredAt` sur `Project`. Notification via queue.

**Priorité : P2**

---

### Q18 — Deux projets avec le même nom pour le même client

**Réponse métier idéale :** Les noms de projets ne doivent pas être uniques en base (un client peut légitimement avoir deux phases d'un même projet portant le même nom). En revanche, l'interface doit afficher un avertissement visible si un nom identique existe déjà pour ce client.

**Règle métier recommandée :** Pas de contrainte d'unicité stricte sur `(name, clientId, companyId)`. Mais `warning` renvoyé par l'API si un projet actif porte déjà ce nom pour ce client : `DUPLICATE_PROJECT_NAME_WARNING`. L'admin peut ignorer l'avertissement et créer quand même.

**Impact utilisateur :** L'admin est alerté mais pas bloqué. Flexibilité métier préservée.

**Impact financier :** Réduction des erreurs d'association de factures au mauvais projet.

**Impact technique :** Query de détection avant création. Response enrichie d'un champ `warnings: []`.

**Priorité : P3**

---

# MODULE 5 — ONBOARDING

---

### Q19 — Signature du contrat sans encaissement de l'acompte

**Réponse métier idéale :** L'étape `Payment` est un verrou dur dans le workflow d'onboarding. Elle ne peut passer à `COMPLETED` que sur réception d'un événement de paiement confirmé (webhook Stripe `payment_intent.succeeded` ou confirmation manuelle ADMIN avec justificatif). L'étape suivante (`Questionnaire`) est physiquement inaccessible tant que `Payment.status !== COMPLETED`.

**Règle métier recommandée :** Chaque `OnboardingStep` a un champ `unlockedAt` qui n'est renseigné que lorsque les prérequis de l'étape précédente sont satisfaits. `Payment.complete()` → vérification du webhook Stripe → `Questionnaire.unlockedAt = NOW()`. Sans webhook : seul un ADMIN peut débloquer manuellement avec motif obligatoire tracé en audit.

**Impact utilisateur :** L'agence ne démarre jamais la production sans acompte encaissé. Le client sait que son paiement débloque la suite.

**Impact financier :** Protection directe contre les impayés d'acompte. Un acompte non encaissé = risque de 100% du montant si le client disparaît.

**Impact technique :** Webhook handler Stripe dans `onboarding.service.ts`. Idempotency sur les webhooks (traitement une seule fois via `idempotencyKey`). État machine stricte sur les étapes.

**Priorité : P0**

---

### Q20 — Client qui abandonne l'onboarding après signature

**Réponse métier idéale :** L'abandon d'un onboarding doit déclencher un workflow de relance commerciale automatisé : J+2, J+7, J+14. Si aucune réponse après J+14, création d'une tâche manuelle pour le manager. Les ressources (freelances) ne sont allouées qu'après la validation de l'étape `Payment`, jamais avant.

**Règle métier recommandée :** Les freelances ne peuvent être assignés à une mission que lorsque l'onboarding atteint l'étape `KickoffMeeting` au minimum. Les étapes antérieures sont purement documentaires et contractuelles — aucune ressource opérationnelle n'est engagée.

**Impact utilisateur :** L'agence ne réserve pas des créneaux de freelance pour un client qui n'a pas encore payé.

**Impact financier :** Prévention de coûts d'opportunité (freelance réservé et indisponible pour d'autres missions alors que le client n'a pas démarré).

**Impact technique :** Contrainte dans `missionApplication.service.ts` : `FreelancerMission` ne peut être créée que si `onboarding.currentStep >= KICKOFF_MEETING`. Job de relance dans la queue `communication`.

**Priorité : P1**

---

### Q21 — Saut d'étape d'onboarding

**Réponse métier idéale :** Les étapes d'onboarding sont séquentielles et non contournables par défaut. Un ADMIN peut marquer une étape comme `WAIVED` (dispensée) avec saisie obligatoire d'un motif. Cette action est tracée dans un audit log irréversible. Les étapes `Contract` et `Payment` ne peuvent jamais être `WAIVED` — elles sont protégées en dur dans le code.

**Règle métier recommandée :** Deux catégories d'étapes : `MANDATORY` (Contract, Payment) et `OPTIONAL_WAIVABLE` (Questionnaire, KickoffMeeting sous conditions). Le statut `WAIVED` est visible par le client dans son portail avec le motif (ex: "Réunion de lancement tenue en présentiel le [date]").

**Impact utilisateur :** Le client comprend pourquoi une étape est marquée "dispensée". L'agence garde la flexibilité nécessaire pour les clients grands comptes.

**Impact financier :** Un projet démarré sans contrat signé = risque juridique majeur en cas de litige. La protection sur `Contract` est non négociable.

**Impact technique :** Enum `OnboardingStepPolicy { MANDATORY, OPTIONAL_WAIVABLE }` sur `OnboardingStep`. Guard dans `onboarding.service.ts::waiveStep` : erreur `STEP_CANNOT_BE_WAIVED` pour les étapes MANDATORY.

**Priorité : P1**

---

### Q22 — Refus répété du cahier des charges

**Réponse métier idéale :** Un cahier des charges peut être soumis au maximum N fois (configurable par company, défaut : 3). Au-delà du seuil, l'étape passe en statut `ESCALATED` et une notification urgente est envoyée à l'ADMIN. L'ADMIN peut : (a) augmenter le quota pour ce client spécifiquement, (b) déclencher une médiation, (c) marquer le projet comme `AT_RISK`.

**Règle métier recommandée :** Champ `revisionsCount` sur l'étape `Specifications`. À chaque refus : `revisionsCount++`. Si `revisionsCount >= company.maxSpecRevisions` → statut `ESCALATED`. Email d'alerte automatique à l'ADMIN avec historique des commentaires de refus du client.

**Impact utilisateur :** Le client ne peut pas bloquer indéfiniment un projet. L'escalade force une conversation humaine.

**Impact financier :** Prévention du blocage de freelances payés à attendre une validation client qui ne vient pas.

**Impact technique :** Champ `revisionsCount INTEGER DEFAULT 0` + `escalatedAt` sur `OnboardingStep`. Hook `afterReject` dans le service.

**Priorité : P2**

---

### Q23 — Rétrogradation du pourcentage de progression

**Réponse métier idéale :** Le pourcentage de progression est monotone croissant par défaut. Une rétrogradation est possible mais nécessite un motif obligatoire et est visible dans l'historique d'audit du projet. Le client voit la rétrogradation avec l'explication du manager.

**Règle métier recommandée :** Si `newProgress < currentProgress` → champ `progressNote` obligatoire (min 20 caractères). L'entrée dans l'historique du projet marque la rétrogradation avec la note. Le client voit "Avancement ajusté : 80% → 65% — Note du manager : [texte]".

**Impact utilisateur :** La transparence sur les régressions renforce la confiance client à long terme.

**Impact financier :** Prévention de litiges sur l'état d'avancement facturable.

**Impact technique :** Validation dans `onboarding.service.ts::updateProgress`. Champ `progressHistory JSON[]` pour conserver les changements.

**Priorité : P3**

---

### Q24 — Onboarding lié à un projet supprimé

**Réponse métier idéale :** La contrainte d'intégrité référentielle `ClientOnboarding.projectId → Project.id` doit être appliquée en base avec `ON DELETE RESTRICT`. Toute tentative de suppression d'un projet ayant un onboarding actif doit être bloquée au niveau de la base de données, indépendamment du service applicatif.

**Règle métier recommandée :** Contrainte FK `ON DELETE RESTRICT` sur `ClientOnboarding.projectId`. Le service vérifie applicativement avant de tenter la suppression, mais la contrainte DB est le filet de sécurité ultime.

**Impact utilisateur :** Impossibilité absolue de créer un lien cassé entre onboarding et projet.

**Impact financier :** Prévention de données orphelines inaccessibles mais consommant des ressources.

**Impact technique :** Migration Prisma pour ajouter `onDelete: Restrict` sur la relation. Test de contrainte en staging.

**Priorité : P1**

---

# MODULE 6 — DEVIS

---

### Q25 — Race condition acceptation / modification simultanées

**Réponse métier idéale :** Le système utilise l'optimistic locking avec versionnage des devis. L'acceptation du client porte le numéro de version du devis qu'il a consulté. Si la version en base a changé entre la consultation et l'acceptation, la transition est rejetée avec message : "Ce devis a été modifié depuis votre dernière consultation — veuillez le relire avant de l'accepter."

**Règle métier recommandée :** Champ `version INTEGER` sur `Proposal`. L'endpoint d'acceptation client inclut la version : `POST /proposals/:id/accept { version: 3 }`. Le service valide `proposal.version === requestedVersion` avant transition.

**Impact utilisateur :** Le client ne peut pas accepter une version qu'il n'a pas lue. L'admin ne peut pas modifier un devis que le client est en train d'accepter.

**Impact financier :** Prévention de litiges contractuels sur le montant et le contenu du devis accepté.

**Impact technique :** Version dans Prisma. Test de concurrence obligatoire en staging (deux requêtes simultanées avec `Promise.all`).

**Priorité : P0**

---

### Q26 — Expiration d'un devis pendant une signature active

**Réponse métier idéale :** L'expiration d'un devis est traitée par un batch horaire, pas en temps réel. Si un client a chargé la page de signature avant l'expiration, il dispose d'une fenêtre de grâce de 15 minutes pour compléter son action. Une session de signature active (détectée par un flag `viewedAt` récent) repousse l'expiration effective.

**Règle métier recommandée :** À la consultation d'un devis `SENT` ou `VIEWED` : `proposal.activeSessionUntil = NOW() + 15min`. Le batch `expireProposals` ignore les devis avec `activeSessionUntil > NOW()`. Si l'acceptation arrive après expiration stricte mais dans la fenêtre de grâce → transition `EXPIRED` directement annulée, devis réactivé automatiquement, log d'audit.

**Impact utilisateur :** Zéro friction pour un client qui accepte un devis au dernier moment. L'expiration ne lui "explose pas à la figure" pendant qu'il lit.

**Impact financier :** Prévention de la perte d'une conversion à cause d'un timing malheureux du batch.

**Impact technique :** Champ `activeSessionUntil TIMESTAMPTZ` sur `Proposal`. Mise à jour dans `proposal.service.ts::view`. Condition dans le batch `expireProposals`.

**Priorité : P1**

---

### Q27 — Modification d'un devis SENT sans repasser en DRAFT

**Réponse métier idéale :** Toute modification du contenu d'un devis `SENT` ou `VIEWED` force obligatoirement le retour en `DRAFT`, avec génération d'un nouvel envoi. Il est impossible de modifier silencieusement un devis que le client a déjà reçu. L'historique des versions du devis est conservé intégralement.

**Règle métier recommandée :** Les endpoints de modification du contenu d'un devis (sections, lignes, montants) vérifient le statut. Si `status IN (SENT, VIEWED)` → transition automatique vers `DRAFT` + invalidation du lien d'accès client précédent + log d'audit avec diff des changements. Le manager doit renvoyer explicitement le devis.

**Impact utilisateur :** Le client reçoit toujours un email indiquant qu'un nouveau devis lui a été envoyé. Jamais de modification silencieuse.

**Impact financier :** Protection contractuelle absolue. Le devis accepté correspond exactement au dernier document envoyé.

**Impact technique :** Guard dans `proposal.service.ts::updateContent`. Invalidation du token d'accès client. Nouvelle entrée dans `ProposalHistory`.

**Priorité : P0**

---

### Q28 — Prestation supprimée après acceptation d'un devis

**Réponse métier idéale :** Les lignes d'un devis sont des snapshots immuables au moment de la création. Elles ne sont pas liées dynamiquement au catalogue de prestations. La suppression ou modification d'une prestation du catalogue n'affecte aucun devis ou facture existant.

**Règle métier recommandée :** `ProposalItem` et `InvoiceItem` contiennent une copie des données au moment de la création : `serviceId` (référence optionnelle), `label`, `description`, `unitPrice`, `quantity`, `total`. Si `serviceId` est supprimé du catalogue, l'item conserve ses données figées et affiche "Prestation archivée" en annotation.

**Impact utilisateur :** Aucune disruption sur les devis et factures existants suite aux évolutions du catalogue.

**Impact financier :** Conformité : le devis accepté et la facture doivent correspondre exactement, indépendamment des évolutions tarifaires ultérieures.

**Impact technique :** Pas de FK obligatoire `serviceId → Service.id` sur `ProposalItem`. Copie des champs au moment de la création. `serviceId` est une référence optionnelle soft.

**Priorité : P1**

---

### Q29 — Destinataires de la notification de refus de devis

**Réponse métier idéale :** La notification de refus de devis est envoyée à : (1) le manager assigné au projet, (2) tous les ADMINs de la company. Le client voit une confirmation de son refus. Le manager reçoit une tâche automatique de suivi commercial créée dans son tableau de bord.

**Règle métier recommandée :** Notification configurable par company : liste des destinataires des événements commerciaux (refus, acceptation, expiration). Par défaut : ADMIN + manager assigné. Notification in-app + email.

**Impact utilisateur :** Le manager sait immédiatement qu'il doit reprendre contact avec le client. Aucun refus ne "disparaît dans la nature".

**Impact financier :** Chaque refus de devis non suivi est une opportunité commerciale perdue.

**Impact technique :** `notificationTargets` configurable par event type dans les paramètres company. Job dans la queue `communication`.

**Priorité : P2**

---

### Q30 — Double devis concurrent pour le même client et besoin

**Réponse métier idéale :** À la création d'un devis, le système vérifie si un devis actif (statut `DRAFT`, `SENT`, ou `VIEWED`) existe déjà pour le même client dans les 30 derniers jours. Si oui, un avertissement bloquant est affiché : le manager doit confirmer explicitement qu'il s'agit bien d'un devis distinct.

**Règle métier recommandée :** Détection de doublon : `Proposal WHERE clientId = :id AND status NOT IN (ACCEPTED, REJECTED, EXPIRED) AND createdAt > NOW() - 30 days`. Si match → confirmation requise avec saisie du motif ("Devis alternatif", "Avenant", etc.). Le motif est visible dans la liste des devis.

**Impact utilisateur :** L'admin ne découvre pas après coup qu'un client a reçu deux devis contradictoires.

**Impact financier :** Prévention de litiges sur "quel devis dois-je payer ?"

**Impact technique :** Query de détection dans `proposal.service.ts::create`. Champ `proposalType ENUM(PRIMARY, ALTERNATIVE, AMENDMENT)` optionnel.

**Priorité : P2**

---

### Q31 — Conflit entre expiration batch et rejet manuel

**Réponse métier idéale :** Les deux transitions (EXPIRED via batch et REJECTED via action manuelle) sont mutuellement exclusives. Le batch vérifie le statut courant avant d'appliquer la transition. Si le statut est déjà `REJECTED` quand le batch s'exécute, le batch ignore ce devis sans erreur.

**Règle métier recommandée :** Toutes les transitions d'état utilisent un pattern de mise à jour conditionnelle : `UPDATE proposals SET status = 'EXPIRED' WHERE id = :id AND status IN ('SENT', 'VIEWED') AND expiresAt <= NOW()`. Si 0 ligne affectée → le statut a déjà changé → aucune action, log informatif.

**Impact utilisateur :** Aucune incohérence d'état visible. Le devis a toujours un seul état final.

**Impact financier :** Aucun.

**Impact technique :** Pattern de conditional update standard. Retour du nombre de lignes affectées dans le repository pour détecter les no-ops.

**Priorité : P3**

---

# MODULE 7 — FACTURES

---

### Q32 — Annulation d'une facture PAID

**Réponse métier idéale :** Une facture PAID ne peut jamais être annulée directement. Le seul mécanisme légal est l'émission d'un avoir (credit note) : document comptable distinct, numéroté, qui réduit ou annule la créance. L'avoir est lié à la facture originale. Si un remboursement physique doit suivre, il est enregistré séparément.

**Règle métier recommandée :** Endpoint `POST /invoices/:id/credit-note { amount, reason }`. Crée un document `CreditNote` numéroté (`CN-AAAAMM-XXXX`), lié à `invoice.id`, avec montant ≤ montant total payé. La facture reste en statut `PAID`. Le solde client est mis à jour : `client.creditBalance += creditNote.amount`. Ce crédit peut être consommé sur une prochaine facture.

**Impact utilisateur :** L'admin dispose d'un outil légal et comptable pour gérer les retours et erreurs. Le client voit son crédit disponible dans le portail.

**Impact financier :** Conformité comptable et fiscale absolue. L'absence d'avoir est une non-conformité légale en France (article 289 du CGI).

**Impact technique :** Nouvelle entité `CreditNote` en base. Relation `CreditNote.invoiceId → Invoice.id`. Numérotation séquentielle dans la même logique que les factures. `client.creditBalance DECIMAL(10,2) DEFAULT 0`.

**Priorité : P0**

---

### Q33 — Collision de numéros de facture en concurrence

**Réponse métier idéale :** La génération du numéro de facture doit utiliser une séquence PostgreSQL atomique, pas une logique applicative (`MAX(id) + 1`). La séquence est définie par company et par mois, garantissant l'unicité sans verrou applicatif.

**Règle métier recommandée :** Séquence PostgreSQL : `CREATE SEQUENCE invoice_seq_{companyId}_{YYYYMM} START 1`. Le numéro est généré par `nextval('invoice_seq_...')` dans la même transaction que la création de la facture. Contrainte `UNIQUE(number, companyId)` en base comme filet de sécurité.

**Impact utilisateur :** Aucune collision possible, même sous charge maximale.

**Impact financier :** Deux factures avec le même numéro = problème légal grave (falsification involontaire de comptabilité, article L. 441-9 du Code de commerce).

**Impact technique :** Migration pour créer les séquences par company. Service `invoiceNumbering.service.ts`. Contrainte `UNIQUE` sur `(number, companyId)`.

**Priorité : P0**

---

### Q34 — Suppression d'une facture SENT ou OVERDUE

**Réponse métier idéale :** Toute facture ayant quitté le statut `DRAFT` est immuable dans son existence. Elle peut changer de statut (CANCELLED via avoir) mais ne peut jamais être supprimée physiquement. La suppression est uniquement autorisée sur les factures `DRAFT` et bloquée par une contrainte logicielle ET une politique d'accès (seul ADMIN).

**Règle métier recommandée :** `DELETE /invoices/:id` → vérifie `invoice.status === DRAFT`. Sinon → erreur `INVOICE_CANNOT_BE_DELETED`. Pour "annuler" une facture émise : `POST /invoices/:id/cancel` qui crée automatiquement un avoir si nécessaire et passe le statut en `CANCELLED`. Les factures CANCELLED restent en base pour toujours.

**Impact utilisateur :** Aucune facture ne peut disparaître du système. L'historique comptable est indestructible.

**Impact financier :** Conformité légale obligatoire. La destruction d'une facture émise est passible de sanctions fiscales (article 1737 du CGI : amende de 50% du montant).

**Impact technique :** Guard `invoice.status === DRAFT` dans `invoice.service.ts::delete`. Retrait du bouton "Supprimer" sur les factures non-DRAFT côté frontend. Audit log de toute tentative de suppression bloquée.

**Priorité : P0**

---

### Q35 — Perte de la remise commerciale à la conversion devis → facture

**Réponse métier idéale :** La conversion d'un devis en facture est un mapping 1:1 des lignes. Chaque `ProposalItem` génère exactement un `InvoiceItem` avec les mêmes champs : `label`, `unitPrice`, `quantity`, `discountPercent`, `discountAmount`, `total`. Le total de la facture doit être strictement égal au total du devis accepté.

**Règle métier recommandée :** `createFromProposal` : après création des items, assertion de cohérence : `abs(invoice.amount - proposal.totalAmount) < 0.01`. Si l'assertion échoue → rollback de la transaction + erreur `INVOICE_AMOUNT_MISMATCH` + alerte Sentry. L'écart de plus de 1 centime est une anomalie critique.

**Impact utilisateur :** Le client reçoit une facture correspondant exactement au devis qu'il a signé.

**Impact financier :** Prévention de litiges : "je n'ai pas accepté ce montant". Risque de non-paiement si l'écart est en défaveur du client.

**Impact technique :** Assertion dans le service de conversion. Test unitaire obligatoire sur des devis avec remises multiples (pourcentage + montant fixe).

**Priorité : P1**

---

### Q36 — Échéance tombant un jour férié ou week-end

**Réponse métier idéale :** L'échéance de paiement (+30 jours) est calculée en jours ouvrés, avec report automatique au prochain jour ouvré si elle tombe un samedi, dimanche ou jour férié. La liste des jours fériés est configurable par pays au niveau de la company.

**Règle métier recommandée :** Service `businessDays.service.ts` avec calendrier de jours fériés par `company.country`. `calculateDueDate(startDate, days)` retourne toujours un jour ouvré. La liste des jours fériés est rechargée annuellement (job cron en janvier).

**Impact utilisateur :** Les relances automatiques ne partent jamais un dimanche ou un jour férié. La relation client n'est pas dégradée par une relance inopportune.

**Impact financier :** En France, une échéance contractuelle un jour non ouvré est réputée reportée au lendemain ouvré (article 641 du Code de procédure civile). La facture doit refléter cette règle.

**Impact technique :** Bibliothèque `date-holidays` (npm) ou table `CompanyHoliday` en base. Service injecté dans `invoice.service.ts`.

**Priorité : P2**

---

### Q37 — Modification des lignes d'une facture SENT

**Réponse métier idéale :** Une facture `SENT` est verrouillée en écriture. Toute modification nécessite : (1) émission d'un avoir annulant la facture originale, (2) création d'une nouvelle facture corrigée, (3) notification au client des deux documents. Ce processus est assisté par un workflow "corriger cette facture" dans l'interface admin.

**Règle métier recommandée :** Bouton "Corriger cette facture" sur une facture SENT → ouvre un assistant en 3 étapes : prévisualisation de l'avoir, saisie de la nouvelle facture, envoi des deux documents simultanément. La facture originale passe en `CANCELLED`, la nouvelle en `SENT`.

**Impact utilisateur :** Le client reçoit une communication claire sur la correction. Il comprend ce qui a changé et pourquoi.

**Impact financier :** Conformité légale. Impossible de modifier une facture émise sans trace comptable.

**Impact technique :** Workflow dans `invoice.service.ts::correct(invoiceId, corrections)` : transaction atomique créant l'avoir + la nouvelle facture. Notifications groupées.

**Priorité : P0**

---

### Q38 — Changement de taux de TVA entre DRAFT et SENT

**Réponse métier idéale :** Le taux de TVA est verrouillé au moment de la validation/envoi de la facture, pas à la création du DRAFT. Si le taux de TVA applicable a changé depuis la dernière sauvegarde du DRAFT, l'interface affiche un avertissement avant envoi : "Le taux de TVA a changé — nouveau taux : 20% (anciennement 10%)."

**Règle métier recommandée :** `sendInvoice` : recalcul de la TVA avec le taux en vigueur à la date d'envoi. Si le taux diffère de celui du DRAFT → avertissement non bloquant avec diff. L'admin confirme l'envoi avec le nouveau taux. Le taux effectif est stocké sur chaque `InvoiceItem`.

**Impact utilisateur :** Aucune facture n'est envoyée avec un taux de TVA périmé sans alerte.

**Impact financier :** Prévention de la facturation à un taux de TVA erroné, entraînant une obligation de régularisation et potentiellement une pénalité fiscale.

**Impact technique :** Champ `vatRate DECIMAL(5,2)` sur `InvoiceItem` fixé au moment de `sendInvoice`. Service `taxRate.service.ts` avec le taux applicable par date et pays.

**Priorité : P1**

---

### Q39 — Double facture sur le même devis accepté

**Réponse métier idéale :** La protection anti-double-conversion doit être assurée par une contrainte en base, pas uniquement par une vérification applicative. Une contrainte d'unicité `UNIQUE(proposalId, companyId) WHERE status != 'CANCELLED'` garantit qu'un devis ne génère jamais deux factures actives.

**Règle métier recommandée :** Index partiel PostgreSQL : `CREATE UNIQUE INDEX idx_invoice_proposal ON invoices (proposalId, companyId) WHERE status NOT IN ('CANCELLED')`. La vérification applicative reste en place comme premier filtre, mais la contrainte DB est le filet de sécurité indestructible.

**Impact utilisateur :** Impossibilité absolue de double-facturation, même en cas de bug applicatif.

**Impact financier :** Protection contre la double-facturation d'un client, qui génère litiges et remboursements coûteux.

**Impact technique :** Migration Prisma pour l'index partiel. Test de concurrence en staging.

**Priorité : P0**

---

# MODULE 8 — PAIEMENTS

---

### Q40 — Double enregistrement simultané d'un paiement

**Réponse métier idéale :** Chaque paiement porte une `idempotencyKey` générée côté client (UUID v4). Deux requêtes d'enregistrement de paiement avec la même `idempotencyKey` dans une fenêtre de 24h ne créent qu'un seul paiement. La deuxième requête retourne le résultat de la première (idempotent).

**Règle métier recommandée :** Table `Payment` avec contrainte `UNIQUE(idempotencyKey)`. Service : `INSERT INTO payments ... ON CONFLICT (idempotencyKey) DO NOTHING RETURNING *`. Si `RETURNING` est vide → doublon détecté → retour du paiement existant avec flag `{ duplicate: true }`.

**Impact utilisateur :** Aucune double comptabilisation possible, même si l'admin double-clique sur "Enregistrer le paiement".

**Impact financier :** Un paiement en double comptabilisé = solde client faux = facture marquée PAID deux fois = perte de recouvrement.

**Impact technique :** Champ `idempotencyKey UUID UNIQUE` sur `Payment`. Généré par le frontend à l'ouverture du formulaire d'enregistrement. Constraint DB + vérification applicative.

**Priorité : P0**

---

### Q41 — Absence de mécanisme d'avoir et remboursement

**Réponse métier idéale :** Le système doit implémenter trois concepts distincts : (1) `CreditNote` (avoir) — annulation comptable d'une facture ou partie de facture, (2) `ClientCredit` — solde créditeur disponible pour imputation sur une prochaine facture, (3) `Refund` — remboursement physique de sommes déjà encaissées.

**Règle métier recommandée :** Workflow complet : `CreditNote` → crédite `Client.creditBalance`. `Refund` → débite `Client.creditBalance` + enregistre le mode de remboursement (virement, chèque). L'imputation d'un crédit sur une facture future → `Invoice.amountPaid += creditApplied` + `Client.creditBalance -= creditApplied`. Toutes les opérations sont tracées avec référence croisée.

**Impact utilisateur :** L'admin peut gérer toutes les situations réelles (retour, insatisfaction, surpaiement) sans bidouillage manuel.

**Impact financier :** Sans avoir ni remboursement, chaque situation anormale est ingérable légalement. C'est un bloquant absolu pour la mise en production.

**Impact technique :** Nouvelles entités : `CreditNote`, `Refund`. Champ `creditBalance DECIMAL(10,2)` sur `Client`. Services dédiés. Ce chantier est le plus structurant de toute l'architecture financière.

**Priorité : P0**

---

### Q42 — Chargeback non géré

**Réponse métier idéale :** Les chargebacks (contestations de paiement par le porteur de carte) doivent être traités via des webhooks du processeur de paiement. À réception d'un événement `dispute.created` : la facture passe en statut `DISPUTED`, le client est marqué `AT_RISK`, une notification urgente est envoyée aux ADMINs, un délai de réponse est affiché (généralement 7 jours pour répondre à la banque).

**Règle métier recommandée :** Statut `DISPUTED` ajouté à l'enum `InvoiceStatus`. Webhook handler `stripeWebhook.service.ts::handleDispute`. Tâche créée automatiquement pour l'ADMIN avec deadline de réponse à la banque. Si le chargeback est perdu → `Invoice.status = OVERDUE` + `Payment.status = REVERSED`.

**Impact utilisateur :** L'admin est alerté immédiatement et dispose du temps nécessaire pour constituer son dossier de réponse.

**Impact financier :** Sans gestion des chargebacks, des sommes remboursées par la banque restent comptabilisées comme encaissées. Perte financière invisible et cumulable.

**Impact technique :** Nouveau statut dans l'enum. Handler webhook idempotent. Entité `Dispute` liée au `Payment`. Intégration Stripe Radar recommandée.

**Priorité : P1**

---

### Q43 — Paiement en devise étrangère

**Réponse métier idéale :** Secritou doit définir une politique de devise explicite : mono-devise (EUR uniquement) ou multi-devises. En mono-devise, les paiements en devise étrangère sont refusés à la saisie avec message explicite. En multi-devises, chaque paiement porte sa devise + taux de change du jour + montant converti en devise de référence.

**Règle métier recommandée :** Phase 1 (MVP) : mono-devise EUR obligatoire. Champ `currency` sur `Invoice` avec valeur par défaut EUR, non modifiable. Champ `currency` sur `Payment` avec vérification `payment.currency === invoice.currency`. Phase 2 : multi-devises avec table de taux de change quotidiens.

**Impact utilisateur :** Clarté totale sur la devise de facturation dès la signature du devis.

**Impact financier :** Les écarts de change non tracés sont des pertes invisibles. En mode mono-devise, le risque est éliminé.

**Impact technique :** Contrainte `CHECK (currency = 'EUR')` en Phase 1. Service `exchangeRate.service.ts` en Phase 2 (API ECB ou Fixer.io).

**Priorité : P2**

---

### Q44 — Visibilité du surpaiement

**Réponse métier idéale :** Un surpaiement est affiché en bannière orange sur la fiche facture admin et sur le portail client, avec le montant exact du trop-perçu. Un avoir est automatiquement suggéré (pré-rempli) pour le montant du surpaiement. Le client reçoit un email l'informant du crédit disponible sur son compte.

**Règle métier recommandée :** `addPayment` : si `totalPaid > invoice.amount` → `overpayAmount = totalPaid - invoice.amount` → `Client.creditBalance += overpayAmount` → notification email client → notification in-app admin. Le warning actuel dans les logs est insuffisant : ce doit être une action métier visible.

**Impact utilisateur :** Le client sait que son argent n'est pas perdu. L'admin ne découvre pas un surpaiement 3 mois plus tard lors d'une révision comptable.

**Impact financier :** Un surpaiement non tracé est une dette implicite de l'agence envers son client. Cumulés, ces écarts peuvent représenter des sommes significatives.

**Impact technique :** Logique dans `invoice.service.ts::addPayment` déjà partielle (warning log). À transformer en action métier : création de `CreditNote`, mise à jour `Client.creditBalance`, notification queue.

**Priorité : P1**

---

### Q45 — Absence de notification d'échec du job markOverdueInvoices

**Réponse métier idéale :** Chaque job de maintenance doit écrire son résultat dans une table `JobExecutionLog` : job, company cible, statut (SUCCESS/PARTIAL/FAILURE), nombre d'entités traitées, durée, erreur. Un job en échec déclenche : (1) alerte Sentry, (2) notification in-app à l'ADMIN de la company affectée, (3) tentative de retry automatique dans les 15 minutes.

**Règle métier recommandée :** `MaintenanceProcessor` : chaque processor enveloppe son exécution dans un try/catch avec écriture du résultat dans `JobExecutionLog`. L'interface admin expose un tableau de bord des jobs (dernier run, statut, erreur). Un job en FAILURE depuis >24h déclenche une alerte escaladée.

**Impact utilisateur :** L'admin de chaque company est notifié si ses factures n'ont pas été marquées OVERDUE automatiquement.

**Impact financier :** Une facture OVERDUE non marquée n'est pas relancée automatiquement. Perte de trésorerie directe sur chaque facture affectée.

**Impact technique :** Table `JobExecutionLog(id, jobName, companyId, status, processedCount, errorMessage, startedAt, finishedAt)`. Un dashboard admin minimaliste suffit en V1.

**Priorité : P1**

---

### Q46 — Date comptable vs date de saisie

**Réponse métier idéale :** Le paiement porte deux dates distinctes : `paymentDate` (date valeur — quand l'argent a réellement été reçu, saisie par l'admin) et `recordedAt` (date de saisie dans le système, automatique). Les rapports comptables utilisent `paymentDate`. Les logs d'audit utilisent `recordedAt`.

**Règle métier recommandée :** `Payment.paymentDate DATE` (obligatoire, saisi par l'admin, peut être antérieur à aujourd'hui) + `Payment.recordedAt TIMESTAMPTZ DEFAULT NOW()` (automatique). L'interface propose la date d'aujourd'hui par défaut mais permet de la modifier (ex: "virement reçu le 15, saisi le 17").

**Impact utilisateur :** La clôture mensuelle est correcte : un paiement reçu le 31/12 mais saisi le 2/01 est comptabilisé en décembre.

**Impact financier :** Conformité comptable. Les rapports de trésorerie par période sont basés sur la date valeur, pas la date de saisie.

**Impact technique :** Deux champs distincts sur `Payment`. Les rapports filtrent sur `paymentDate`, les logs sur `recordedAt`.

**Priorité : P2**

---

# MODULE 9 — APPROBATIONS

---

### Q47 — Double approbation simultanée

**Réponse métier idéale :** L'approbation d'un livrable utilise l'optimistic locking. Le premier approbateur valide la transition. Le deuxième reçoit un message clair : "Ce livrable a déjà été approuvé par [Prénom Nom] il y a 3 secondes." Aucune donnée n'est corrompue, la timeline d'audit ne contient qu'une entrée d'approbation.

**Règle métier recommandée :** `UPDATE approvals SET status = 'APPROVED', approvedBy = :userId, approvedAt = NOW(), version = version + 1 WHERE id = :id AND status = 'PENDING' AND version = :expectedVersion`. Si 0 ligne affectée → conflit → retour du statut actuel.

**Impact utilisateur :** Le second approbateur comprend immédiatement la situation sans erreur cryptique.

**Impact financier :** La timeline d'audit est propre et utilisable en cas de litige sur la date d'approbation.

**Impact technique :** Champ `version` sur `Approval`. Pattern identique aux devis et factures.

**Priorité : P1**

---

### Q48 — Révocation d'une approbation

**Réponse métier idéale :** Une approbation peut être révoquée dans les 24 heures par son auteur ou par un ADMIN, avec commentaire obligatoire. Au-delà de 24h, seul un ADMIN peut révoquer avec motif tracé. La révocation ne supprime pas l'approbation originale — elle crée une entrée `REVOKED` dans la timeline avec référence à l'approbation révoquée.

**Règle métier recommandée :** Nouvelle action `revokeApproval(approvalId, reason)`. Crée une entrée `ApprovalTimeline { type: REVOKED, reason, revokedBy, revokedAt }`. Le livrable repasse en `PENDING_APPROVAL`. Notification au client et au manager.

**Impact utilisateur :** Un admin peut corriger une erreur d'approbation sans perdre la trace de ce qui s'est passé.

**Impact financier :** Prévention de la mise en production d'un livrable approuvé par erreur, qui pourrait entraîner des coûts de correction.

**Impact technique :** Enum `ApprovalTimelineType { SUBMITTED, APPROVED, REJECTED, REVOKED, RESUBMITTED }`. Contrainte de délai (24h) vérifiée dans le service.

**Priorité : P2**

---

### Q49 — Client sans accès portail avec une approbation en attente

**Réponse métier idéale :** Si un client ne peut pas accéder à son portail (compte PENDING, mot de passe expiré, compte désactivé), toutes ses approbations en attente déclenchent automatiquement une alerte à l'ADMIN. Après N jours sans action (configurable, défaut 7), l'ADMIN peut approuver "par substitution" avec justification tracée (ex: "Approbation téléphonique obtenue le [date]").

**Règle métier recommandée :** Job quotidien : `Approval WHERE status = PENDING AND createdAt < NOW() - 3 days` → notification ADMIN. `Approval WHERE status = PENDING AND createdAt < NOW() - 7 days` → escalade avec possibilité d'approbation par substitution ADMIN.

**Impact utilisateur :** Le workflow de production n'est jamais bloqué indéfiniment par un problème d'accès client.

**Impact financier :** Un projet bloqué 2 semaines sur une approbation = coût freelance qui tourne à vide.

**Impact technique :** Job quotidien dans `maintenance.processor.ts`. Nouvelle action `approveBySubstitution(approvalId, adminId, justification)`.

**Priorité : P2**

---

### Q50 — Visibilité des commentaires de rejet vers les freelances

**Réponse métier idéale :** Les commentaires de rejet d'approbation client sont `AGENCY_ONLY` par défaut. Le manager décide explicitement quels éléments communiquer au freelance, via un champ "Note au freelance" distinct. Le client ne doit jamais savoir qu'un freelance existe sur son dossier (sauf accord contractuel explicite).

**Règle métier recommandée :** Champ `rejectionComment` (visible client + agence) distinct de `freelanceNote` (visible agence + freelance concerné uniquement). Le manager remplit `freelanceNote` après avoir lu le `rejectionComment` et filtré ce qui doit être partagé.

**Impact utilisateur :** Le client ne voit pas ses commentaires relayés verbatim à un prestataire qu'il ne connaît peut-être même pas. Le freelance reçoit les instructions utiles sans contexte confidentiel.

**Impact financier :** Prévention de litiges liés à la divulgation d'informations confidentielles client à des tiers.

**Impact technique :** Deux champs distincts sur `Approval`. ACL : `rejectionComment` visible par `CLIENT + ADMIN + MANAGER`, `freelanceNote` visible par `ADMIN + MANAGER + assigned FREELANCER only`.

**Priorité : P2**

---

# MODULE 10 — DOCUMENTS

---

### Q51 — Changement accidentel de niveau d'accès vers ALL

**Réponse métier idéale :** Le changement du niveau d'accès d'un document depuis `ADMIN_ONLY` vers un niveau plus permissif nécessite une double confirmation et est tracé en audit. L'interface présente un avertissement fort : "Ce document contient des informations confidentielles — êtes-vous certain de vouloir le rendre visible aux clients ?"

**Règle métier recommandée :** Champ `sensitivityFlag BOOLEAN DEFAULT FALSE` positionné automatiquement sur tout document créé avec niveau `ADMIN_ONLY`. Toute transition vers un niveau plus permissif sur un document `sensitivityFlag = TRUE` → `confirm required` + `audit log irréversible`.

**Impact utilisateur :** Protection contre la divulgation accidentelle de documents internes (marges, notes stratégiques, échanges confidentiels).

**Impact financier :** Prévention d'une violation de confidentialité pouvant constituer une rupture de NDA ou une violation du RGPD.

**Impact technique :** Champ `sensitivityFlag` sur `Document`. Guard dans `document.service.ts::updateAccessLevel`. Notification à tous les ADMINs lors d'un tel changement.

**Priorité : P1**

---

### Q52 — Purge à 365 jours des documents comptables

**Réponse métier idéale :** La règle d'archivage à 365 jours ne s'applique JAMAIS aux documents comptables. Les factures, avoirs, contrats, bons de commande ont une durée de rétention légale de 7 à 10 ans selon la nature du document (article L. 123-22 du Code de commerce). Le job d'archivage doit exclure explicitement ces catégories.

**Règle métier recommandée :** Enum `DocumentRetentionPolicy { ACCOUNTING_10Y, LEGAL_7Y, PROJECT_3Y, TEMP_90D }` sur `Document`. La politique est assignée à la création selon le type de document. Le job d'archivage filtre : `WHERE retentionPolicy = TEMP_90D AND lastAccessedAt < NOW() - 90 DAYS`.

**Impact utilisateur :** Aucune destruction accidentelle de pièces comptables ou légales.

**Impact financier :** Violation de l'article L. 123-22 : amende jusqu'à 150 000 € + redressement fiscal si les pièces justificatives ont été détruites.

**Impact technique :** Champ `retentionPolicy` sur `Document`. Migration pour classifier les documents existants. Refactoring du job d'archivage.

**Priorité : P0**

---

### Q53 — Document parent supprimé avec enfants actifs

**Réponse métier idéale :** La suppression d'un document parent archive automatiquement tous ses enfants (versions) dans un groupe d'archive lié. Les versions restent accessibles depuis une vue "Archives" ou via l'API admin. Aucune version n'est jamais orpheline.

**Règle métier recommandée :** `softDeleteDocument(id)` : transaction → `Document.deletedAt = NOW()` (parent) + `Document.deletedAt = NOW()` (tous les enfants WHERE `parentId = :id`). Champ `archiveGroupId` pour relier les orphelins potentiels. Contrainte FK `ON DELETE SET NULL` sur `parentId` + guard applicatif.

**Impact utilisateur :** La navigation dans l'historique des versions fonctionne même après la suppression du document principal.

**Impact financier :** Prévention de la perte de versions intermédiaires de contrats ou cahiers des charges.

**Impact technique :** Cascade de soft-delete dans le service. Index sur `parentId` pour la query cascade.

**Priorité : P2**

---

### Q54 — Conformité RGPD des logs d'accès aux documents

**Réponse métier idéale :** Les logs d'accès (IP, user-agent, timestamp) sont des données personnelles au sens du RGPD. Leur conservation doit être limitée à 12 mois maximum, avec mention dans la politique de confidentialité de Secritou. L'accès aux logs est réservé aux ADMINs désignés DPO. Un utilisateur peut demander l'effacement de ses logs d'accès (droit à l'oubli).

**Règle métier recommandée :** Table `DocumentAccessLog` avec politique de rétention automatique : `DELETE WHERE createdAt < NOW() - 12 months` (job mensuel). Champ `legalBasis` (ex: "intérêt légitime — sécurité"). Export des logs possible pour répondre à une demande RGPD (droit d'accès). Anonymisation après 3 mois (masquer l'IP complète, conserver seulement les 3 premiers octets).

**Impact utilisateur :** Conformité RGPD de l'agence vis-à-vis de ses propres clients.

**Impact financier :** Non-conformité RGPD : amende CNIL jusqu'à 4% du CA mondial ou 20M€.

**Impact technique :** Job mensuel de purge sur `DocumentAccessLog`. Anonymisation partielle après 3 mois : `UPDATE SET ip = regexp_replace(ip, '\d+$', '0')`.

**Priorité : P1**

---

### Q55 — Deux fichiers avec le même nom dans le même dossier

**Réponse métier idéale :** L'upload d'un fichier avec un nom identique à un fichier existant dans le même dossier/projet déclenche le versioning automatique : le nouveau fichier devient une version enfant du fichier existant, pas un doublon séparé.

**Règle métier recommandée :** À l'upload : détection par `(name, folderId, companyId, deletedAt IS NULL)`. Si match → nouvelle version créée automatiquement (`parentId = existingDocument.id`, `version = maxVersion + 1`). L'utilisateur est notifié : "Une version précédente existe — votre fichier a été enregistré comme version 2."

**Impact utilisateur :** Le versioning est transparent et automatique. Plus de doublons confus.

**Impact financier :** Aucun.

**Impact technique :** Query de détection avant insertion. Logic de versionnage dans `document.service.ts::upload`.

**Priorité : P3**

---

# MODULE 11 — SUPPORT

---

### Q56 — Absence d'escalade automatique SLA

**Réponse métier idéale :** Chaque company configure ses SLA de support (délai de première réponse, délai de résolution). Le système calcule automatiquement si un ticket est en retard et l'affiche visuellement (badge rouge). Un job horaire identifie les tickets en breach SLA et crée des tâches d'escalade pour le manager superviseur.

**Règle métier recommandée :** Table `SlaConfig(companyId, firstResponseHours, resolutionHours)`. Champs calculés sur `Question` : `slaFirstResponseDeadline`, `slaResolutionDeadline`, `slaStatus ENUM(ON_TRACK, AT_RISK, BREACHED)`. Job horaire : `UPDATE questions SET slaStatus = 'BREACHED' WHERE slaFirstResponseDeadline < NOW() AND status = 'OPEN'` + notification escalade.

**Impact utilisateur :** Les clients ne restent jamais sans réponse. L'agence respecte ses engagements contractuels de support.

**Impact financier :** Non-respect des SLA peut constituer une violation contractuelle entraînant des pénalités ou une résiliation.

**Impact technique :** Table `SlaConfig`. Champs calculés ou indexés sur `Question`. Job dans `maintenance.processor.ts`.

**Priorité : P2**

---

### Q57 — Fermeture d'un ticket sans réponse

**Réponse métier idéale :** Un ticket ne peut passer en `CLOSED` que si son statut est `ANSWERED` ou si l'admin fournit un motif de fermeture catégorisé (SPAM, DUPLICATE, OUT_OF_SCOPE, NO_RESPONSE_FROM_CLIENT). La fermeture sans réponse par un MANAGER (non-ADMIN) est bloquée.

**Règle métier recommandée :** `closeQuestion(id, closureType)` : si `question.status === OPEN` et `closureType` non fourni → erreur `QUESTION_NEVER_ANSWERED`. Si `closureType` fourni (ADMIN seulement) → fermeture autorisée avec motif tracé. L'historique de clôture est visible par le client.

**Impact utilisateur :** Le client voit toujours pourquoi son ticket a été fermé, même sans réponse.

**Impact financier :** Prévention des mauvaises évaluations de satisfaction générées par des fermetures abusives.

**Impact technique :** Enum `ClosureType` sur `Question`. Guard dans le service selon le rôle.

**Priorité : P2**

---

### Q58 — Réouverture d'un ticket CLOSED

**Réponse métier idéale :** Un client peut rouvrir un ticket CLOSED dans les 14 jours suivant sa fermeture. Au-delà, il doit créer un nouveau ticket (avec référence optionnelle au ticket original). Le nombre de réouvertures est illimité dans la fenêtre de 14 jours.

**Règle métier recommandée :** `reopenQuestion(id)` : vérifie `question.closedAt > NOW() - 14 days`. Si oui → statut `OPEN` + notification au manager. Si non → erreur `QUESTION_REOPEN_WINDOW_EXPIRED` avec suggestion de créer un nouveau ticket en référençant celui-ci.

**Impact utilisateur :** Équilibre entre flexibilité client (réouverture possible) et prévention des abus (fenêtre de 14 jours).

**Impact financier :** Aucun.

**Impact technique :** Champ `closedAt` sur `Question`. Vérification dans le service.

**Priorité : P3**

---

### Q59 — Pièces jointes dans les tickets — URLs sécurisées

**Réponse métier idéale :** Toute pièce jointe dans un ticket de support est stockée sur S3 avec une URL signée à durée limitée (expiration : 1 heure). L'URL n'est jamais stockée en base — seule la clé S3 l'est. À chaque accès, une nouvelle URL signée est générée à la volée.

**Règle métier recommandée :** `getAttachmentUrl(attachmentId, userId)` : vérification que `userId` est autorisé à voir cet attachement (appartient à la même company, ou est le client du ticket) + génération d'une `presigned URL` S3 valide 1 heure. La clé S3 en base est du type `support/{companyId}/{ticketId}/{filename}`.

**Impact utilisateur :** Un lien partagé par email ou copié-collé devient invalide après 1 heure — pas d'accès permanent à des fichiers sensibles.

**Impact financier :** Prévention d'une violation de données via un lien S3 public permanent (coût RGPD + réputation).

**Impact technique :** Refactoring du stockage d'attachements : remplacer `url TEXT` par `s3Key TEXT`. Service `attachmentUrl.service.ts` avec génération de presigned URLs.

**Priorité : P1**

---

# MODULE 12 — FREELANCES

---

### Q60 — Freelance qui abandonne une mission

**Réponse métier idéale :** L'inactivité d'un freelance sur une mission active pendant 3 jours ouvrés génère une alerte MANAGER. Après 7 jours sans activité ni communication, la mission passe automatiquement en `INACTIVE_REVIEW` et le manager doit décider : relancer le freelance, réassigner ou clôturer. Le client est notifié uniquement si l'impact sur son livrable est avéré.

**Règle métier recommandée :** Champ `lastActivityAt` sur `FreelancerMission`. Job quotidien : si `lastActivityAt < NOW() - 3 business days AND status = ACTIVE` → `status = AT_RISK` + notification MANAGER. Si `lastActivityAt < NOW() - 7 business days` → `status = INACTIVE_REVIEW` + escalade ADMIN.

**Impact utilisateur :** Le manager est alerté avant que le client ne réalise qu'il y a un problème.

**Impact financier :** Prévention du paiement d'un freelance inactif et du dépassement de délai client.

**Impact technique :** Champ `lastActivityAt TIMESTAMPTZ` mis à jour à chaque livrable/commentaire/entrée de temps. Job quotidien dans `maintenance.processor.ts`.

**Priorité : P1**

---

### Q61 — Conflit d'intérêts freelance / client direct

**Réponse métier idéale :** À l'acceptation d'une candidature freelance sur une mission, le système vérifie si l'email du freelance existe dans la base `Client` ou `Lead` de la même company. Si oui, alerte au manager avec détail du conflit. Le manager peut procéder en connaissance de cause ou rejeter la candidature.

**Règle métier recommandée :** Hook `beforeAcceptApplication` : query cross-tables sur email du candidat. Si présent dans `Lead` ou `Client` → notification `CONFLICT_OF_INTEREST_DETECTED` à l'ADMIN. L'acceptation nécessite une confirmation explicite avec case à cocher "Je confirme avoir vérifié la situation."

**Impact utilisateur :** L'agence ne se retrouve pas dans une situation où elle paie un prestataire qui est également son prospect client.

**Impact financier :** Prévention de situations contractuelles ambiguës pouvant générer des litiges.

**Impact technique :** Service de détection cross-module. Pas de blocage automatique — alerte et confirmation uniquement.

**Priorité : P2**

---

### Q62 — Modification d'une note freelance après publication

**Réponse métier idéale :** Une note est modifiable par son auteur dans les 14 jours suivant sa publication. Au-delà, seul un ADMIN peut la supprimer (pas la modifier) sur preuve de fraude ou erreur manifeste. La suppression administrative est tracée en audit. La modification crée une nouvelle version de la note avec horodatage.

**Règle métier recommandée :** `updateRating(id, newScore, newComment)` : vérifie `rating.createdBy === currentUser.id AND rating.createdAt > NOW() - 14 days`. Crée `RatingHistory { previousScore, previousComment, modifiedAt, modifiedBy }`. La moyenne du freelance est recalculée.

**Impact utilisateur :** Un auteur peut corriger une erreur de saisie. Un freelance ne peut pas se voir attribuer une note injuste de manière permanente.

**Impact financier :** La réputation d'un freelance impacte son accès aux missions. Une note erronée non corrigeable est une injustice avec impact économique direct.

**Impact technique :** Table `RatingHistory`. Guard de modification dans le service. Recalcul de moyenne en cascade.

**Priorité : P2**

---

### Q63 — Compte freelance jamais activé après acceptation

**Réponse métier idéale :** Un compte freelance créé après acceptation d'une candidature dispose d'une fenêtre de 7 jours pour compléter son profil et se connecter. Sans activation dans ce délai, le compte passe en `PENDING_ACTIVATION` et un email de relance est envoyé. Après 30 jours sans activation, le compte est désactivé automatiquement et la candidature peut être rerouverte.

**Règle métier recommandée :** Champ `activationDeadline` sur le compte `User` créé pour un freelance. Job quotidien : si `activationDeadline < NOW() AND lastLoginAt IS NULL` → désactivation + notification ADMIN. Le manager peut renvoyer l'invitation manuellement.

**Impact utilisateur :** Les admins ne se retrouvent pas avec des comptes fantômes consommant des quotas sans être utilisés.

**Impact financier :** Prévention de paiements de licences ou quotas pour des comptes inactifs.

**Impact technique :** Champ `activationDeadline TIMESTAMPTZ` sur `User`. Job dans `maintenance.processor.ts`.

**Priorité : P2**

---

### Q64 — Conservation des CV rejetés sur S3

**Réponse métier idéale :** Les CV et portfolios des candidats rejetés sont supprimés de S3 automatiquement 2 mois après la décision de rejet, conformément au délai légal français (CNIL, délibération 2012-113). Un email de confirmation de suppression est envoyé au candidat.

**Règle métier recommandée :** `FreelancerApplication.rejectedAt` + job mensuel : `WHERE status = REJECTED AND rejectedAt < NOW() - 60 days` → suppression S3 + `cv_s3key = NULL` + `portfolio_s3key = NULL` + email candidat. Un flag `documentsDeletedAt` trace la suppression.

**Impact utilisateur :** Les candidats rejetés voient leurs données personnelles supprimées dans les délais légaux.

**Impact financier :** Non-conformité RGPD : amende CNIL. Coût S3 de conservation inutile.

**Impact technique :** Job mensuel avec `aws s3 rm` via SDK. Champ `documentsDeletedAt` sur `FreelancerApplication`.

**Priorité : P1**

---

# MODULE 13 — MARKETPLACE

---

### Q65 — Suppression d'un profil freelance avec mission active

**Réponse métier idéale :** La suppression d'un profil freelance est bloquée si une mission active (`status IN (ACTIVE, PAUSED, AT_RISK)`) existe. Le message d'erreur liste les missions en cours. L'admin doit d'abord clôturer ou réassigner chaque mission avant de pouvoir archiver le profil.

**Règle métier recommandée :** `deleteFreelancerProfile(id)` : query sur `FreelancerMission WHERE freelancerId = :id AND status NOT IN (COMPLETED, CANCELLED)`. Si résultats → erreur `FREELANCER_HAS_ACTIVE_MISSIONS` avec liste. Soft-delete uniquement (archivage, pas suppression physique).

**Impact utilisateur :** Aucune mission ne devient orpheline sans processus de clôture ou réassignation.

**Impact financier :** Prévention de la perte de données de mission (heures, livrables) qui pourraient être nécessaires pour la facturation.

**Impact technique :** Guard dans le service. Soft-delete. Conservation des données historiques des missions liées même après archivage du profil.

**Priorité : P1**

---

### Q66 — Double assignation d'une mission

**Réponse métier idéale :** Une mission ne peut avoir qu'un seul freelance assigné à la fois. À l'acceptation d'une candidature, toutes les autres candidatures actives pour cette mission sont automatiquement refusées avec notification. La mission passe en statut `ASSIGNED` immédiatement, bloquant toute nouvelle assignation.

**Règle métier recommandée :** `acceptApplication(applicationId)` : transaction → `FreelancerMission.assignedFreelancerId = :freelancerId AND status = ASSIGNED` + `MissionApplication.status = REJECTED WHERE missionId = :missionId AND id != :applicationId`. Contrainte `UNIQUE(missionId) WHERE status = ACCEPTED` sur `MissionApplication`.

**Impact utilisateur :** Clarté totale sur qui est assigné. Aucune ambiguïté.

**Impact financier :** Prévention du double paiement de deux freelances pour le même travail.

**Impact technique :** Contrainte d'unicité partielle PostgreSQL. Transaction atomique dans le service.

**Priorité : P1**

---

### Q67 — Visibilité des TJM freelance par les clients

**Réponse métier idéale :** Les TJM freelance sont strictement `ADMIN_ONLY` et ne sont jamais exposés via l'API portail client (`/client/...`). La marge de l'agence est confidentielle. Le portail client affiche uniquement les montants facturés (devis + factures), jamais les coûts de revient.

**Règle métier recommandée :** Middleware `requireCompanyTenant` sur tous les endpoints exposant des données freelance (TJM, candidatures, évaluations internes). L'API portail client n'a aucun endpoint pour lire `FreelancerProfile.dailyRate`. Le champ est exclu des DTOs portail.

**Impact utilisateur :** Le client ne découvre jamais la marge de l'agence. La relation commerciale reste équilibrée.

**Impact financier :** La divulgation des marges détruit la relation commerciale et peut pousser le client à traiter directement avec le freelance.

**Impact technique :** DTO `FreelancerPublicProfile` (sans `dailyRate`) vs `FreelancerAdminProfile` (complet). Sérialisation conditionnelle selon le middleware actif.

**Priorité : P1**

---

### Q68 — Note freelance sous seuil critique sans alerte

**Réponse métier idéale :** Un freelance dont la note moyenne passe sous 3/5 après sa dernière évaluation reçoit une notification de l'ADMIN et est mis sous surveillance. En dessous de 2.5/5, le profil est automatiquement désactivé de la marketplace (visible ADMIN uniquement) jusqu'à révision manuelle.

**Règle métier recommandée :** Hook `afterRatingCreated` : recalcul de la moyenne. Si `avg < 3.0` → notification ADMIN. Si `avg < 2.5` → `FreelancerProfile.marketplaceVisible = FALSE` + notification ADMIN + email au freelance avec motif.

**Impact utilisateur :** Les clients ne se voient jamais proposer un freelance mal noté de manière chronique.

**Impact financier :** Protection de la réputation de l'agence. Un freelance mal noté ternit l'image de la marketplace.

**Impact technique :** Champ `marketplaceVisible BOOLEAN DEFAULT TRUE`. Hook post-calcul de moyenne.

**Priorité : P3**

---

# MODULE 14 — AUTHENTIFICATION

---

### Q69 — Refresh token multi-appareils et rotation par famille

**Réponse métier idéale :** La rotation par famille doit intégrer un `reuse interval` de 30 secondes. Deux requêtes de refresh avec le même token dans cet intervalle (réseau lent, double-tap, reconnexion mobile) sont considérées comme légitimes. Au-delà de 30 secondes, la réutilisation d'un token révoqué révoque toute la famille.

**Règle métier recommandée :** Champ `lastUsedAt` sur le refresh token. Condition de révocation : `tokenUsedAt AND NOW() - tokenUsedAt > 30 seconds`. Pour les sessions multi-appareils légitimes, chaque appareil maintient sa propre rotation de token dans sa propre famille. Un utilisateur peut avoir N familles actives simultanément (une par appareil).

**Impact utilisateur :** Un utilisateur légitime sur mobile + desktop n'est pas déconnecté de force par la détection de vol.

**Impact financier :** Prévention de la frustration utilisateur qui pourrait conduire à l'abandon du produit.

**Impact technique :** Champ `reuse_interval_seconds INTEGER DEFAULT 30` configurable. Condition dans `auth.service.ts::refreshToken`.

**Priorité : P1**

---

### Q70 — Suppression du dernier ADMIN d'une company

**Réponse métier idéale :** La suppression ou le downgrade de rôle d'un utilisateur qui est le dernier ADMIN actif d'une company est strictement bloqué. L'interface ne propose pas l'action et l'API renvoie `409 LAST_ADMIN_CANNOT_BE_REMOVED`. Pour supprimer le dernier admin, il faut d'abord promouvoir un autre utilisateur au rôle ADMIN.

**Règle métier recommandée :** `deleteUser(id)` et `updateUserRole(id, newRole)` : si `user.role === ADMIN AND company.adminCount === 1` → erreur. `company.adminCount` est un compteur maintenu à jour à chaque changement de rôle. Vérification aussi lors de la désactivation de compte.

**Impact utilisateur :** Aucune company ne devient ingérable suite à une suppression accidentelle.

**Impact financier :** Une company sans admin ne peut plus gérer ses factures, ses clients, ses paiements. Blocage opérationnel total avec impact financier immédiat.

**Impact technique :** Compteur `adminCount INTEGER` dénormalisé sur `Company` (maintenu via trigger ou service). Guard systématique dans `user.service.ts`.

**Priorité : P0**

---

### Q71 — Lien de reset password à usage multiple

**Réponse métier idéale :** Le lien de réinitialisation de mot de passe est à usage unique. Il est invalidé dès le premier clic sur le lien (pas seulement après soumission du nouveau mot de passe). Si l'utilisateur clique le lien mais ferme la page sans soumettre, il doit demander un nouveau lien.

**Règle métier recommandée :** À la visite de l'URL de reset : `UPDATE password_reset_tokens SET usedAt = NOW() WHERE token = :hash AND usedAt IS NULL`. Si 0 ligne affectée → token déjà utilisé → erreur `TOKEN_ALREADY_USED`. Le nouveau mot de passe peut alors être soumis dans une fenêtre de 15 minutes après ce premier clic (token one-time + session temporaire côté client).

**Impact utilisateur :** Si quelqu'un intercepte le lien de reset et clique dessus avant la victime, la victime voit "token déjà utilisé" et est alertée d'une tentative suspecte.

**Impact financier :** Prévention de la prise de contrôle de compte, qui peut entraîner des modifications de RIB de facturation ou d'adresse de livraison.

**Impact technique :** Champ `usedAt TIMESTAMPTZ` sur `PasswordResetToken`. Update conditionnel à la visite de l'URL.

**Priorité : P0**

---

### Q72 — Contournement de mustChangePassword via API directe

**Réponse métier idéale :** Le flag `mustChangePassword` doit être encodé dans le JWT lui-même comme claim custom (`"mcp": true`). Tout endpoint protégé vérifie ce claim AVANT de traiter la requête — indépendamment du middleware HTTP. Même un appel API direct avec un token valide mais portant `mcp: true` est rejeté.

**Règle métier recommandée :** Claim `mcp` dans le payload JWT. Le middleware `authenticate` ajoute `req.user.mustChangePassword` depuis le JWT. Un deuxième middleware `enforceMustChangePassword` bloque si `req.user.mustChangePassword === true` et que l'endpoint n'est pas `/auth/change-password`. Ce contrôle est incontournable car il vient du JWT signé.

**Impact utilisateur :** Un compte créé par un admin avec mot de passe temporaire est totalement verrouillé sur les opérations métier jusqu'au changement de mot de passe.

**Impact financier :** Prévention de l'utilisation d'un compte avec des credentials temporaires connus par un tiers.

**Impact technique :** Ajout du claim `mcp` dans `auth.service.ts::generateAccessToken`. Middleware `enforceMustChangePassword` vérifie le JWT, pas la DB.

**Priorité : P1**

---

### Q73 — Révocation immédiate des tokens après désactivation

**Réponse métier idéale :** La désactivation d'un compte utilisateur ajoute son `userId` à une blacklist Redis avec TTL égal à la durée maximale de vie d'un access token. Chaque requête authentifiée vérifie cette blacklist. Un utilisateur désactivé est déconnecté en moins de la durée de l'access token (quelques secondes si le TTL est court).

**Règle métier recommandée :** `deactivateUser(id)` : `Redis.setex('blacklist:userId:{id}', ACCESS_TOKEN_TTL_SECONDS, '1')` + révocation de tous les refresh tokens de la famille. Le middleware `authenticate` vérifie `Redis.get('blacklist:userId:{req.user.id}')` à chaque requête.

**Impact utilisateur :** Un employé licencié perd l'accès en quelques secondes, pas dans 15 minutes à l'expiration du JWT.

**Impact financier :** Prévention d'accès malveillants post-désactivation (extraction de données clients, modification de factures, etc.).

**Impact technique :** Ajout d'une vérification Redis dans le middleware `authenticate`. Coût : 1 GET Redis par requête — négligeable (< 1ms). TTL sur la blacklist = durée access token.

**Priorité : P1**

---

### Q74 — Logs de tentatives de connexion échouées

**Réponse métier idéale :** Les logs de connexions échouées sont conservés pendant 90 jours maximum, avec l'email tenté hashé (SHA-256, non réversible) et l'IP complète. La base légale est l'intérêt légitime de sécurité. La politique de conservation est mentionnée dans la politique de confidentialité.

**Règle métier recommandée :** Log : `{ hashedEmail: sha256(email), ip, userAgent, attemptedAt, success: false }`. Jamais l'email en clair. Purge automatique après 90 jours. Accès limité aux ADMINs de Secritou (pas des tenants). Utile pour la détection de brute-force et de credential stuffing.

**Impact utilisateur :** Sécurité améliorée sans violation de vie privée.

**Impact financier :** Conformité RGPD. Base légale documentée pour éviter une sanction CNIL.

**Impact technique :** Hash SHA-256 côté applicatif avant insertion. Table `LoginAttempt` avec TTL géré par job mensuel.

**Priorité : P3**

---

# MODULE 15 — MULTI-TENANT

---

### Q75 — Absence de Row-Level Security PostgreSQL

**Réponse métier idéale :** La sécurité multi-tenant ne peut pas reposer uniquement sur des filtres applicatifs. PostgreSQL RLS doit être configuré sur toutes les tables contenant des données tenant-spécifiques. La RLS est une couche de sécurité indépendante du code applicatif — un bug de code ne peut pas la bypasser.

**Règle métier recommandée :** `ALTER TABLE clients ENABLE ROW LEVEL SECURITY`. `CREATE POLICY tenant_isolation ON clients USING (company_id = current_setting('app.current_company_id')::uuid)`. Le `company_id` est positionné en début de chaque connexion DB : `SET LOCAL app.current_company_id = :companyId`. Prisma peut émettre ce `SET LOCAL` via un middleware de transaction.

**Impact utilisateur :** Aucune fuite de données possible entre tenants, même en cas de bug applicatif critique.

**Impact financier :** Une fuite de données inter-tenant est un incident RGPD majeur (notification CNIL obligatoire dans les 72h, amende jusqu'à 4% du CA).

**Impact technique :** Migration de RLS sur toutes les tables `companyId`. Prisma middleware pour `SET LOCAL`. Tests de RLS en staging avec deux tenants et un utilisateur malveillant.

**Priorité : P0**

---

### Q76 — Transfert de propriété d'une company

**Réponse métier idéale :** Le transfert de propriété d'une company est une opération rare et critique qui nécessite : (1) confirmation de l'ancien owner, (2) confirmation du nouvel owner, (3) validation par le support Secritou (Super Admin). Toutes les factures, contrats et historiques restent liés à la company (entité légale) et non à son owner.

**Règle métier recommandée :** Workflow `CompanyOwnershipTransfer { status: PENDING | CONFIRMED_BY_OLD | CONFIRMED_BY_NEW | VALIDATED_BY_PLATFORM }`. Seul le passage à `VALIDATED_BY_PLATFORM` modifie effectivement le champ `company.ownerId`. Log irréversible dans `CompanyAuditLog`.

**Impact utilisateur :** Aucun changement non autorisé de propriété possible.

**Impact financier :** Le nouveau propriétaire hérite de toutes les obligations financières de la company (factures impayées, contrats en cours).

**Impact technique :** Table `CompanyOwnershipTransfer`. Endpoint Super Admin dans une zone d'administration Secritou séparée (non accessible aux tenants).

**Priorité : P2**

---

### Q77 — Même email dans deux companies différentes

**Réponse métier idéale :** Un email peut exister dans plusieurs tenants. L'identité est `(email, companyId)`, pas `email` seul. À la connexion, si l'email appartient à plusieurs companies, un sélecteur de tenant est présenté avant la saisie du mot de passe.

**Règle métier recommandée :** Table `User` avec clé unique `(email, companyId)`. À la connexion, query : `SELECT companyId FROM users WHERE email = :email AND status = ACTIVE`. Si plusieurs résultats → sélecteur de tenant. Le JWT inclut `companyId` dans ses claims.

**Impact utilisateur :** Un consultant multi-agences peut avoir des comptes séparés sur le même outil sans confusion.

**Impact financier :** Prévention du cross-tenant data access qui serait une violation RGPD.

**Impact technique :** Unique constraint sur `(email, companyId)` au lieu de `(email)` seul. Flow de connexion multi-tenant.

**Priorité : P1**

---

### Q78 — Injection de companyId dans les exports

**Réponse métier idéale :** Le `companyId` utilisé pour tout export, rapport ou filtrage est TOUJOURS extrait du JWT de l'utilisateur connecté. Tout `companyId` présent dans les paramètres de requête (query string, body) est ignoré ou comparé au JWT — si différent → erreur `403 FORBIDDEN`.

**Règle métier recommandée :** Middleware `requireCompanyTenant` : `req.companyId = req.user.companyId` (du JWT). Tout paramètre `companyId` extérieur est ignoré. Les services utilisent exclusivement `req.companyId`. Test de sécurité automatisé : tenter d'exporter avec un `companyId` différent du JWT → doit retourner 403.

**Impact utilisateur :** Aucune donnée inter-tenant n'est jamais exposée par manipulation de paramètres.

**Impact financier :** Prévention d'espionnage concurrentiel entre agences sur la même instance.

**Impact technique :** Le middleware `requireCompanyTenant` existant doit être vérifié sur TOUS les endpoints d'export. Test de sécurité à ajouter dans `tenant-isolation.spec.ts`.

**Priorité : P1**

---

### Q79 — Noisy neighbor et quotas de performance

**Réponse métier idéale :** Chaque company est limitée en ressources : nombre de requêtes/minute, taille des exports, nombre de jobs simultanés. Ces quotas sont configurables par plan d'abonnement. Un tenant qui dépasse ses quotas reçoit un `429 Too Many Requests` — il ne peut pas dégrader l'expérience des autres tenants.

**Règle métier recommandée :** Rate limiting par `companyId` (en plus du rate limiting par IP existant) : `rateLimit({ keyGenerator: req => req.user.companyId, max: 1000/min })`. Quotas de jobs : `BullMQ.addBulk` limité par company. Monitoring Prometheus par `companyId`.

**Impact utilisateur :** Les performances sont prévisibles pour tous les tenants.

**Impact financier :** Un tenant en croissance rapide ne dégrade pas le service des autres tenants qui paient leur abonnement.

**Impact technique :** Rate limiter Redis par `companyId`. Dashboard Grafana avec métriques par tenant.

**Priorité : P3**

---

# MODULE 16 — NOTIFICATIONS

---

### Q80 — Perte d'emails critiques sur chute de BullMQ

**Réponse métier idéale :** Les emails critiques (reset password, relances de paiement) doivent avoir une durée de rétention dans la dead-letter queue de 30 jours minimum. Un dashboard admin expose les jobs en échec avec possibilité de retry manuel. Un email d'alerte opérationnelle est envoyé à l'équipe Secritou si la queue est down depuis > 5 minutes.

**Règle métier recommandée :** Configuration BullMQ : `removeOnComplete: 7 days, removeOnFail: 30 days`. Dashboard BullMQ Board (ou Bull Arena) exposé en ADMIN Secritou uniquement. Alerte Prometheus : `bullmq_queue_failed_total > 0` → alert critique. Les emails de reset password ont une priorité CRITICAL dans la queue.

**Impact utilisateur :** Aucun email critique définitivement perdu. Le support peut les rejouer manuellement.

**Impact financier :** Un lien de reset perdu = utilisateur bloqué = appel support = coût opérationnel.

**Impact technique :** Configuration `removeOnFail` dans `queues.ts`. Intégration Bull Board en interne.

**Priorité : P1**

---

### Q81 — Client avec filtre anti-spam sur les emails Secritou

**Réponse métier idéale :** Le système doit disposer d'un fallback in-app pour chaque notification critique envoyée par email. Si un email n'est pas ouvert en 48h (tracking par pixel ou webhook d'ouverture), une notification in-app équivalente est créée automatiquement. Le client voit la notification au prochain login.

**Règle métier recommandée :** À chaque email critique envoyé : création simultanée d'une `Notification` in-app de priorité normale. Si l'email est ouvert (webhook provider) → la notification in-app est marquée `read`. Si non ouvert après 48h → la notification in-app passe en priorité `HIGH` avec badge visible.

**Impact utilisateur :** Le client ne rate jamais un devis à signer ou une facture à payer, même si ses emails Secritou sont en spam.

**Impact financier :** Prévention de devis expirés et de factures impayées dus à des emails non reçus.

**Impact technique :** Webhook d'ouverture email (Postmark, Sendgrid) → update `Notification.emailOpened = true`. Job quotidien pour escalader les notifications non-ouvertes.

**Priorité : P2**

---

### Q82 — Notifications archivées inaccessibles après 90 jours

**Réponse métier idéale :** Les notifications lues sont archivées après 90 jours dans des tables partitionnées (en accord avec la stratégie d'archivage existante). Une recherche admin permet de retrouver les notifications archivées par client, type et période. L'interface client n'affiche que les 90 derniers jours — pour les archives, une demande admin est nécessaire.

**Règle métier recommandée :** Table `NotificationArchive` partitionnée par mois (cohérent avec la stratégie d'archivage). API admin : `GET /admin/clients/:id/notifications/archived?from=&to=`. Interface client : bandeau "Vous cherchez des notifications plus anciennes ? Contactez votre manager."

**Impact utilisateur :** Les notifications critiques récentes (90 jours) sont toujours accessibles en self-service.

**Impact financier :** Les litiges sur "je n'ai jamais reçu ce devis" peuvent être résolus via les archives.

**Impact technique :** Cohérent avec la stratégie d'archivage existante. Endpoint d'accès admin aux archives.

**Priorité : P3**

---

### Q83 — Absence de préférences de notifications utilisateur

**Réponse métier idéale :** Chaque utilisateur peut configurer ses préférences de notification : canal (email, in-app, les deux), fréquence (temps réel, digest quotidien), types d'événements (commercial, technique, admin). Les préférences sont stockées par utilisateur et respectées par le service de notification.

**Règle métier recommandée :** Table `NotificationPreference(userId, eventType, channel, enabled)`. Service de notification vérifie les préférences avant d'envoyer. Certaines notifications sont non-désactivables (reset password, facture envoyée, alerte sécurité).

**Impact utilisateur :** L'utilisateur contrôle les notifications qu'il reçoit. Réduction du sentiment de spam.

**Impact financier :** Réduction du désabonnement email. Amélioration de l'engagement avec les notifications critiques.

**Impact technique :** Table simple avec defaults. UI dans les paramètres utilisateur.

**Priorité : P3**

---

# MODULE 17 — IA

---

### Q84 — Données sensibles envoyées au modèle IA tiers

**Réponse métier idéale :** Aucune donnée personnelle identifiable (nom, email, téléphone, montant de facture nominatif) ne doit être envoyée à l'API IA sans anonymisation préalable. Le DPO de Secritou doit valider la base légale (intérêt légitime ou consentement) et l'inscrire dans les mentions RGPD. Un accord de traitement des données (DPA) doit être signé avec le fournisseur IA.

**Règle métier recommandée :** Service `aiAnonymizer.service.ts` : avant tout envoi à l'API IA, remplace les entités nommées par des tokens (`[CLIENT_1]`, `[AMOUNT_1]`) via une bibliothèque de NER. La réponse de l'IA est de-anonymisée côté serveur avant affichage. L'utilisateur ne voit aucune différence mais le modèle ne reçoit jamais de PII.

**Impact utilisateur :** Les utilisateurs peuvent utiliser l'IA en toute confiance sur des données métier sans risque de fuite.

**Impact financier :** Violation RGPD sur les données envoyées à un LLM tiers : amende jusqu'à 20M€ ou 4% du CA mondial.

**Impact technique :** Librairie de NER (SpaCy en Python ou un modèle léger en Node). Service d'anonymisation asynchrone. DPA signé avec OpenAI/Anthropic.

**Priorité : P1**

---

### Q85 — Accès admin aux conversations IA des utilisateurs

**Réponse métier idéale :** Les conversations IA sont privées par défaut. Un ADMIN ne peut accéder aux conversations de ses collaborateurs que sur décision judiciaire ou dans le cadre d'un audit de sécurité interne documenté. Cette politique est écrite dans les CGU et la politique de confidentialité.

**Règle métier recommandée :** Les conversations IA ne sont pas visibles dans l'interface admin. Un endpoint `GET /admin/ai-conversations/:userId` existe mais est protégé par un middleware supplémentaire `requireLegalJustification` qui exige un motif documenté stocké en audit avant d'accéder aux données. L'utilisateur est notifié de tout accès à ses conversations.

**Impact utilisateur :** Confiance dans l'outil. Les collaborateurs utilisent l'IA librement sans craindre une surveillance.

**Impact financier :** Non-conformité RGPD (surveillance des employés sans cadre légal) : sanctions CNIL + risque prud'homal.

**Impact technique :** Middleware `requireLegalJustification`. Table `AiConversationAccessLog`. Notification email à l'utilisateur concerné.

**Priorité : P2**

---

### Q86 — Indisponibilité du service IA

**Réponse métier idéale :** Le module IA est un module optionnel. Son indisponibilité ne doit jamais provoquer d'erreur 500 sur les routes non-IA. Le circuit breaker doit être activé dès la première erreur de l'API IA et rester ouvert pendant 60 secondes. L'interface affiche un message non alarmant : "L'assistant IA est temporairement indisponible."

**Règle métier recommandée :** Pattern circuit breaker (bibliothèque `opossum` ou similaire) sur le client HTTP de l'API IA. Fallback : réponse `{ available: false, message: "Service IA indisponible" }`. Métrique Prometheus `ai_circuit_breaker_open`. Alerte si le circuit est ouvert depuis > 30 min.

**Impact utilisateur :** Aucune disruption sur les modules CRM, Facturation, Projets si l'IA est down.

**Impact financier :** Les opérations critiques (envoi de factures, enregistrement de paiements) ne sont jamais bloquées par une dépendance tierce non-critique.

**Impact technique :** Circuit breaker sur `aiClient.ts`. Tests d'isolation : simuler l'échec de l'API IA et vérifier que les autres modules fonctionnent.

**Priorité : P2**

---

### Q87 — Suppression des conversations IA (droit à l'effacement)

**Réponse métier idéale :** La suppression d'une conversation IA par l'utilisateur est une suppression physique (hard delete) dans les 30 jours suivant la demande, conformément au droit à l'effacement du RGPD. Aucun soft-delete ne suffit pour satisfaire une demande d'effacement RGPD — les données doivent être physiquement supprimées de tous les systèmes (DB + backups si techniquement possible).

**Règle métier recommandée :** `deleteAiConversation(id)` : hard delete de `AiConversation` + `AiMessage` cascade. Enregistrement de la demande d'effacement dans `GdprErasureLog { userId, dataType: AI_CONVERSATION, requestedAt, completedAt }`. Si les données existent dans les backups, elles sont exclues lors de la prochaine rotation de backup.

**Impact utilisateur :** Le droit à l'effacement est effectif et documenté.

**Impact financier :** Non-conformité au droit à l'effacement : amende CNIL.

**Impact technique :** Hard delete avec cascade. `GdprErasureLog`. Politique de backup avec exclusion des données effacées.

**Priorité : P2**

---

# MODULE 18 — DASHBOARD

---

### Q88 — Cache de 60 secondes sur les données de paiement

**Réponse métier idéale :** Les données financières critiques (paiements encaissés, factures soldées) doivent être invalidées en temps réel, pas avec un TTL fixe. L'invalidation du cache doit être déclenchée par l'événement métier (paiement enregistré → `invalidateTags(['invoices', 'client-financials', 'dashboard-summary'])`).

**Règle métier recommandée :** La stratégie de cache actuelle (TTL + tags) est bonne mais les événements d'invalidation sont incomplets. Chaque `addPayment`, `markInvoicePaid`, `createCreditNote` doit déclencher une invalidation des tags liés au dashboard. Le TTL de 60s devient un fallback, pas la règle principale.

**Impact utilisateur :** Le dashboard est toujours à jour après une opération critique. Aucun admin ne relance un client à tort.

**Impact financier :** Un admin qui voit une facture impayée alors qu'elle vient d'être réglée peut créer une friction client inutile.

**Impact technique :** Ajout des invalidations dans chaque service financier. La liste des tags à invalider doit être documentée et testée.

**Priorité : P2**

---

### Q89 — Portée des données du dashboard manager

**Réponse métier idéale :** Le dashboard d'un MANAGER affiche par défaut uniquement les clients et projets dont il est le responsable désigné. Une vue "Toute la company" est accessible via un bouton, réservée aux ADMIN. Les KPIs financiers (revenus, marges) sont toujours ADMIN uniquement.

**Règle métier recommandée :** `getDashboardSummary(userId, role)` : si `role === MANAGER` → filtre `WHERE assignedManagerId = :userId`. Si `role === ADMIN` → aucun filtre. Les KPIs financiers sont dans un endpoint séparé `GET /admin/dashboard/financial` protégé par `authorize('ADMIN')`.

**Impact utilisateur :** Un manager junior ne voit pas les informations commerciales et financières des clients gérés par ses collègues.

**Impact financier :** Prévention de la fuite de données commerciales sensibles entre équipes concurrentes au sein d'une même agence.

**Impact technique :** Filtre conditionnel dans `dashboard.service.ts`. Endpoint financier séparé avec autorisation ADMIN stricte.

**Priorité : P2**

---

### Q90 — Affichage TTC vs HT dans le portail client

**Réponse métier idéale :** Le portail client affiche les montants TTC, avec mention de la TVA détaillée (montant HT + taux + montant TVA + montant TTC) sur chaque facture et devis. La cohérence avec les documents PDF envoyés est obligatoire.

**Règle métier recommandée :** `company.displayTaxInclusive BOOLEAN` configurable par l'agence. Par défaut : TTC avec détail. Le devis et la facture PDF doivent utiliser le même paramètre. Un changement de ce paramètre ne rétroagit pas sur les documents déjà générés.

**Impact utilisateur :** Le client ne découvre pas que "le prix affiché" était HT au moment de payer.

**Impact financier :** Litige sur le montant dû si le devis était affiché HT et la facture TTC sans cohérence.

**Impact technique :** Champ `displayTaxInclusive` sur `Company`. Rendu conditionnel dans les templates PDF et l'UI.

**Priorité : P2**

---

# MODULE 19 — REPORTING

---

### Q91 — Intégrité des exports de rapports financiers

**Réponse métier idéale :** Chaque rapport exporté (PDF ou CSV) est horodaté avec la date de génération, l'identité de l'utilisateur qui l'a demandé et un hash SHA-256 du contenu. Ce hash est stocké en base et peut être vérifié ultérieurement pour prouver que le rapport n'a pas été modifié après export.

**Règle métier recommandée :** `generateReport(type, period)` : génère le document → calcule `sha256(content)` → stocke `ReportExportLog { generatedBy, generatedAt, type, period, contentHash }` → retourne le document avec en-tête `X-Content-Hash: {hash}`. L'admin peut vérifier l'intégrité d'un rapport exporté via un endpoint `POST /reports/verify { hash }`.

**Impact utilisateur :** Les rapports exportés sont des preuves vérifiables en cas d'audit fiscal ou de litige.

**Impact financier :** Un rapport financier falsifié après export peut entraîner des sanctions pénales. Le hash de vérification protège l'agence.

**Impact technique :** `crypto.createHash('sha256').update(content).digest('hex')`. Table `ReportExportLog`. Endpoint de vérification.

**Priorité : P1**

---

### Q92 — Cohérence des rapports générés pendant l'archivage nocturne

**Réponse métier idéale :** Les jobs d'archivage nocturnes et les demandes de génération de rapports ne doivent pas s'exécuter simultanément. Un verrou d'exclusion mutuelle (mutex Redis) est posé par les jobs d'archivage sur les tables concernées. Si une demande de rapport arrive pendant l'archivage, elle est mise en file d'attente et exécutée après.

**Règle métier recommandée :** `Redis.set('lock:archive:running', '1', 'EX', 3600)` au début du job d'archivage. Le service de génération de rapports vérifie ce lock : si présent → retourne `{ status: 'QUEUED', estimatedDelay: '30min' }`. Les rapports de clôture comptable (mensuelle) sont planifiés explicitement après les jobs d'archivage.

**Impact utilisateur :** Les rapports de clôture sont toujours cohérents et complets.

**Impact financier :** Un rapport de revenus mensuel avec des données à moitié migrées fausse les décisions de gestion.

**Impact technique :** Mutex Redis dans `maintenance.processor.ts`. Queue prioritaire pour les rapports de clôture.

**Priorité : P2**

---

### Q93 — Rapports sur des périodes antérieures à l'activation

**Réponse métier idéale :** Les rapports ont une date de début minimale correspondant à la date d'activation de la company sur Secritou (`company.activatedAt`). Toute tentative de rapport sur une période antérieure retourne un avertissement clair : "Données disponibles à partir du [date d'activation]."

**Règle métier recommandée :** `generateReport(from, to)` : if `from < company.activatedAt` → `from = company.activatedAt` + `warnings: ['Data available from {activatedAt} only']`. Le rapport est généré avec la période effective, pas la période demandée.

**Impact utilisateur :** Pas d'erreur cryptique. Le rapport est généré avec ce qui est disponible, avec un avertissement transparent.

**Impact financier :** Prévention de rapports avec des trous de données (0 avant la date d'activation) qui pourraient fausser des moyennes ou des totaux.

**Impact technique :** Champ `activatedAt TIMESTAMPTZ` sur `Company`. Vérification dans `report.service.ts`.

**Priorité : P3**

---

### Q94 — Accès des clients aux rapports de l'agence

**Réponse métier idéale :** Les clients n'ont accès, via le portail, qu'aux rapports les concernant personnellement : historique de leurs factures, état de leurs projets, évolution de leur score d'avancement. Les rapports de l'agence (revenus globaux, marges, performance commerciale) sont strictement ADMIN/MANAGER.

**Règle métier recommandée :** Deux familles d'endpoints de reporting : `/api/v1/reports/...` (ADMIN/MANAGER) et `/api/v1/client/reports/...` (CLIENT, scope = clientId du JWT). Le middleware `requireClientTenant` sur la deuxième famille garantit l'isolation.

**Impact utilisateur :** Le client a accès à ses données sans voir celles de l'agence ou des autres clients.

**Impact financier :** Prévention de la divulgation des marges et revenus de l'agence à ses clients.

**Impact technique :** Séparation claire des routes et middlewares. Tests E2E : un token CLIENT ne peut pas accéder aux routes de reporting ADMIN.

**Priorité : P1**

---

# MODULE 20 — ARCHIVAGE

---

### Q95 — Archivage de leads avec données personnelles

**Réponse métier idéale :** Les leads non convertis contenant des données personnelles (nom, email, téléphone) sont soumis au RGPD. La base légale de leur traitement (intérêt légitime commercial) a une durée limitée. Les leads non convertis et sans interaction depuis 3 ans doivent être supprimés (pas archivés) automatiquement, avec notification préalable à l'agence.

**Règle métier recommandée :** Politique de rétention des leads : `ACTIVE (< 12 mois depuis dernière interaction)` → traitement normal. `DORMANT (12-36 mois)` → archivage. `EXPIRED (> 36 mois)` → suppression physique programmée avec notification 30 jours avant. Les leads convertis en clients suivent la politique de rétention clients (7 ans pour les données comptables liées).

**Impact utilisateur :** L'agence est protégée légalement. Elle ne conserve pas de données personnelles sans base légale.

**Impact financier :** Non-conformité RGPD sur la conservation excessive de données personnelles : amende CNIL.

**Impact technique :** Champ `lastInteractionAt` sur `Lead`. Tâche cron mensuelle. Email de notification 30 jours avant suppression.

**Priorité : P1**

---

### Q96 — Atomicité du DELETE + INSERT d'archivage

**Réponse métier idéale :** L'opération d'archivage est encapsulée dans une transaction PostgreSQL unique. Le `BEGIN` est posé avant le `DELETE RETURNING`, et le `COMMIT` n'est effectué qu'après l'`INSERT` réussi. Si le serveur tombe entre les deux, PostgreSQL rollback automatiquement la transaction entière à la reconnexion.

**Règle métier recommandée :** ```sql
BEGIN;
WITH archived AS (DELETE FROM leads WHERE id IN (...) RETURNING *)
INSERT INTO leads_archive SELECT * FROM archived;
COMMIT;
```
Ce pattern garantit l'atomicité en SQL pur. Aucune donnée ne peut être perdue entre le DELETE et l'INSERT car ils sont dans la même transaction.

**Impact utilisateur :** Aucune perte de données en cas de panne pendant l'archivage.

**Impact financier :** Prévention de la perte irréversible de données qui pourraient être nécessaires pour un audit ou un litige.

**Impact technique :** Prisma supporte les transactions SQL brutes via `prisma.$transaction`. Le CTE `WITH archived AS (DELETE ... RETURNING *)` est supporté par PostgreSQL 9.1+.

**Priorité : P0**

---

### Q97 — Backups incluant les tables d'archives partitionnées

**Réponse métier idéale :** La politique de backup PostgreSQL doit explicitement lister toutes les tables et partitions, y compris les partitions créées dynamiquement par le job d'archivage. `pg_dump` ou `pgBackRest` doivent être configurés pour inclure les tables partitionnées. Un test de restauration mensuel doit vérifier que les données archivées sont bien récupérables.

**Règle métier recommandée :** Script de backup : vérification post-dump du nombre de tables sauvegardées vs nombre de tables en production. Si écart > 0 → alerte critique. Test de restauration mensuel : restauration sur un environnement de staging, vérification de l'intégrité des données archivées via checksums.

**Impact utilisateur :** En cas de disaster recovery, toutes les données historiques sont récupérables.

**Impact financier :** Perte des archives = perte de données comptables légalement obligatoires = sanctions fiscales.

**Impact technique :** `pgBackRest` avec liste explicite des schémas et tables. Script de vérification post-backup. Job mensuel de test de restauration.

**Priorité : P1**

---

### Q98 — Archivage partiel en cas d'échec à mi-chemin

**Réponse métier idéale :** Le job d'archivage traite les données par batches de 500 enregistrements maximum. Chaque batch est une transaction indépendante. En cas d'échec d'un batch, les batches précédents sont déjà commités et loggés comme archivés. Le batch en échec est logué et retentée au prochain run. Aucune donnée n'est ni en double état ni perdue.

**Règle métier recommandée :** Le job d'archivage maintient une table `ArchiveBatch { jobName, batchId, startId, endId, status, processedAt }`. Chaque batch archivé est marqué SUCCESS. En cas d'échec, le batch est marqué FAILED et rejoué en priorité au prochain run. Le dashboard admin expose l'état des batches.

**Impact utilisateur :** L'archivage progresse même si un batch échoue. Pas de blocage total.

**Impact financier :** Les tables de production restent légères même en cas d'échecs partiels d'archivage.

**Impact technique :** Table `ArchiveBatch`. Logique de checkpoint dans `maintenance.processor.ts`.

**Priorité : P2**

---

### Q99 — Interface d'accès aux données archivées

**Réponse métier idéale :** Une interface admin minimaliste permet de rechercher dans les données archivées par company, type d'entité, période et identifiant. Les résultats sont affichés en lecture seule. Un bouton "Désarchiver" est disponible pour les ADMINs (ramène l'enregistrement dans la table active).

**Règle métier recommandée :** Endpoint `GET /admin/archives?entity=leads&companyId=&from=&to=&search=`. Vue read-only des données archivées. Action `POST /admin/archives/:id/restore` pour désarchiver (transaction inverse : DELETE de l'archive + INSERT en actif). Log d'audit de chaque désarchivage.

**Impact utilisateur :** Un manager peut retrouver un lead archivé sans appeler le support technique.

**Impact financier :** Réduction des coûts de support pour accéder à des données historiques.

**Impact technique :** Queries sur les tables `*_archive` partitionnées. Vue en lecture seule dans l'interface admin.

**Priorité : P2**

---

### Q100 — Chiffrement des archives

**Réponse métier idéale :** Les archives S3 sont chiffrées avec SSE-KMS (AWS Key Management Service), avec des clés d'archive distinctes des clés de production. La rotation des clés est annuelle. L'accès aux archives nécessite un rôle IAM spécifique `secritou-archive-reader`, distinct du rôle de production.

**Règle métier recommandée :** Deux buckets S3 distincts : `secritou-production-{env}` et `secritou-archive-{env}`, chacun avec sa propre KMS key. La politique IAM de l'application n'a accès qu'au bucket de production. L'accès aux archives est possible uniquement via une élévation de privilèges temporaire (durée 1h) loguée dans CloudTrail.

**Impact utilisateur :** Aucune fuite possible des données archivées même en cas de compromission du bucket de production.

**Impact financier :** Les archives contiennent 7+ ans de données comptables et personnelles. Une fuite serait catastrophique.

**Impact technique :** Configuration IAM et KMS dans Terraform/CDK. `aws s3 cp --sse aws:kms --ssekms-key-id arn:...`.

**Priorité : P2**

---

### QUESTIONS TRANSVERSALES (Q101–Q120)

---

### Q101 — Invitation première connexion client (mustChangePassword)

**Réponse métier idéale :** L'invitation est envoyée dans les 5 minutes suivant la création du compte. Le lien est unique, à usage unique, expire en 72h (pas 1h — trop court pour un client qui reçoit l'email le vendredi soir). Le compte reste en `PENDING` jusqu'au premier login. Un ADMIN peut renvoyer l'invitation manuellement depuis la fiche client. Passé 7 jours sans activation, une relance automatique est envoyée.

**Règle métier recommandée :** Statut `User.status ENUM(PENDING, ACTIVE, SUSPENDED, DEACTIVATED)`. Le portail client bloque l'accès si `status !== ACTIVE`. Lien d'invitation : `InvitationToken { token: uuid, userId, expiresAt: 72h, usedAt }`. Job quotidien : relance si `status = PENDING AND createdAt < NOW() - 7 days`.

**Impact utilisateur :** Le client n'est jamais bloqué par un lien expiré trop vite. L'agence voit clairement quels clients n'ont pas encore activé leur compte.

**Impact financier :** Un client qui n'a pas accès à son portail ne peut pas signer son devis ni payer ses factures.

**Impact technique :** Enum `UserStatus`. Table `InvitationToken`. Job de relance quotidien. Dashboard "comptes en attente d'activation" pour l'admin.

**Priorité : P1**

---

### Q102 — Dépassement budgétaire de projet sans alerte

**Réponse métier idéale :** Chaque projet dispose d'un budget configurable. Le système calcule en temps réel le budget consommé = somme des factures émises (hors CANCELLED) liées au projet. Des alertes sont déclenchées à 75% et 100% du budget. Au-delà de 100%, la création de nouvelles factures sur ce projet est bloquée sans override ADMIN explicite.

**Règle métier recommandée :** Champ `budget DECIMAL(10,2)` sur `Project`. Champ calculé `budgetConsumed` = `SUM(Invoice.amount WHERE projectId AND status NOT IN (CANCELLED))`. Hook `beforeCreateInvoice` : si `budgetConsumed + newAmount > budget * 1.0` → erreur `PROJECT_BUDGET_EXCEEDED` + override ADMIN requis. Notification à 75% et 100%.

**Impact utilisateur :** L'admin est alerté avant de dépasser le budget. Le client n'est pas surpris par une facture dépassant ce qui avait été convenu.

**Impact financier :** Prévention de litiges budgétaires. Maîtrise des coûts de production.

**Impact technique :** Champ `budget` sur `Project`. Agrégat `budgetConsumed` calculé à la demande ou maintenu en cache. Notifications via queue.

**Priorité : P2**

---

### Q103 — Company désactivée (abonnement expiré)

**Réponse métier idéale :** L'expiration de l'abonnement d'une company déclenche une séquence progressive : J0 expiration → mode lecture seule pour tous les utilisateurs (aucune création, aucune modification). J+15 → accès export uniquement (téléchargement des données). J+30 → suspension totale. J+90 → notification de purge imminente avec délai de 30 jours supplémentaires. J+120 → purge des données non-comptables.

**Règle métier recommandée :** Enum `Company.subscriptionStatus { ACTIVE, GRACE_PERIOD, READ_ONLY, SUSPENDED, PENDING_DELETION }`. Middleware global : si `status !== ACTIVE` → restrictions progressives selon le statut. Les données comptables (factures, avoirs) ne sont jamais purgées avant 7 ans.

**Impact utilisateur :** Un client dont l'abonnement expire n'est pas privé brutalement de ses données. Il a le temps d'exporter ou de renouveler.

**Impact financier :** Le droit d'accès aux données personnelles (RGPD Art. 15) subsiste même après expiration de l'abonnement.

**Impact technique :** Middleware `checkSubscriptionStatus`. Job quotidien de mise à jour des statuts d'abonnement. Intégration avec le système de facturation Secritou (méta-niveau).

**Priorité : P1**

---

### Q104 — Questionnaire d'onboarding avec JSON malformé

**Réponse métier idéale :** Le questionnaire d'onboarding est défini par un schéma Zod côté serveur. Toute soumission est validée contre ce schéma avant d'être acceptée. Les erreurs de validation sont retournées par champ avec des messages compréhensibles par le client. Une soumission partielle (questions obligatoires manquantes) est refusée.

**Règle métier recommandée :** Schéma Zod `QuestionnaireResponseSchema` défini dans `shared/`. Middleware `validate(QuestionnaireResponseSchema)` sur l'endpoint de soumission. Réponse d'erreur : `{ errors: [{ field: 'budget', message: 'Champ obligatoire' }] }`. Le frontend affiche les erreurs par champ.

**Impact utilisateur :** Le client sait exactement quels champs corriger. Pas de message d'erreur générique.

**Impact financier :** Prévention du blocage de l'onboarding sur une erreur de validation invisible.

**Impact technique :** Schéma partagé dans `shared/`. Le schéma est la source de vérité pour le frontend (génération de formulaire) et le backend (validation).

**Priorité : P2**

---

### Q105 — Données de candidats freelances rejetés

**Réponse métier idéale :** Dès la décision de rejet, un job asynchrone est planifié pour supprimer les fichiers S3 (CV, portfolio) dans exactement 60 jours (CNIL : délai de recours). À J+60, la suppression S3 est effectuée, les champs `cvS3Key` et `portfolioS3Key` sont mis à NULL, et un email de confirmation est envoyé à l'adresse email du candidat.

**Règle métier recommandée :** `rejectApplication(id)` : `FreelancerApplication.rejectedAt = NOW()` + `BullMQ.add('deleteRejectedDocuments', { applicationId }, { delay: 60 * 24 * 60 * 60 * 1000 })`. Le processor vérifie que le statut est toujours REJECTED avant de supprimer (un recours pourrait avoir été initié). Email de confirmation après suppression.

**Impact utilisateur :** Les candidats savent que leurs données seront supprimées dans un délai précis.

**Impact financier :** Conformité RGPD. Non-conformité : amende CNIL + risque réputationnel.

**Impact technique :** Job BullMQ différé de 60 jours. SDK S3 dans le processor. Email de confirmation.

**Priorité : P1**

---

### Q106 — Déclenchement automatique de l'onboarding après acceptation de devis

**Réponse métier idéale :** L'acceptation d'un devis déclenche automatiquement la création d'un `ClientOnboarding` en statut `PENDING_SETUP` avec les étapes standard pré-configurées. Une notification est envoyée à l'ADMIN pour personnaliser et activer l'onboarding. Le client voit son portail passer en mode "Onboarding en préparation" immédiatement.

**Règle métier recommandée :** `acceptProposal(id)` : transaction → `Proposal.status = ACCEPTED` + `ClientOnboarding.create({ proposalId, projectId, status: PENDING_SETUP, steps: defaultSteps })` + notification ADMIN. L'ADMIN a 24h pour personnaliser l'onboarding avant que le client ne le voie activé.

**Impact utilisateur :** Le client perçoit une réactivité immédiate après avoir accepté son devis. L'agence n'oublie jamais de créer l'onboarding.

**Impact financier :** Prévention des projets "fantômes" — devis acceptés mais jamais démarrés faute de déclenchement manuel.

**Impact technique :** Transaction dans `proposal.service.ts::accept`. Étapes par défaut configurables par company dans `company.settings.defaultOnboardingSteps`.

**Priorité : P1**

---

### Q107 — Métriques de conversion dans les rapports

**Réponse métier idéale :** Le module Reporting expose des métriques de conversion par pipeline : `Leads → Clients` (taux de conversion), ventilées par manager assigné, par source de lead, par période et par plan tarifaire. Ces métriques permettent d'identifier les managers les plus performants et les sources de leads les plus qualifiées.

**Règle métier recommandée :** Vue matérialisée PostgreSQL `conversion_metrics` recalculée quotidiennement. Métriques : taux de conversion (%), délai moyen de conversion (jours), valeur moyenne du premier devis, taux d'acceptation des devis par manager. Filtrables par période, manager, source.

**Impact utilisateur :** Les ADMIN peuvent piloter leur performance commerciale avec des données objectives.

**Impact financier :** L'identification des canaux et managers les plus performants permet d'optimiser les investissements commerciaux.

**Impact technique :** Vue matérialisée PostgreSQL avec `REFRESH MATERIALIZED VIEW CONCURRENTLY` (sans lock de lecture). Exposée via `GET /admin/reports/conversion`.

**Priorité : P2**

---

### Q108 — Paiements manuels vs intégration processeur

**Réponse métier idéale :** La saisie manuelle de paiements doit être la méthode de dernier recours, pas la méthode principale. Une intégration avec un processeur de paiement (Stripe) est recommandée pour les paiements en ligne. Les paiements manuels (virement, chèque) doivent être soumis à un workflow de validation à deux niveaux : saisie par MANAGER + validation par ADMIN.

**Règle métier recommandée :** `Payment.source ENUM(STRIPE_WEBHOOK, MANUAL_ADMIN, MANUAL_MANAGER)`. Les paiements `MANUAL_MANAGER` ont le statut `PENDING_VALIDATION`. Un ADMIN doit les valider pour qu'ils soient comptabilisés. Les paiements Stripe sont directement `CONFIRMED`. Log d'audit de chaque validation manuelle.

**Impact utilisateur :** L'agence dispose d'un contrôle interne sur les paiements manuels, réduisant le risque de fraude interne.

**Impact financier :** Un paiement manuel non validé ne comptabilise pas le revenu. Contrôle interne renforcé.

**Impact technique :** Enum `PaymentSource`. Statut `PENDING_VALIDATION` sur `Payment`. Endpoint ADMIN de validation.

**Priorité : P2**

---

### Q109 — Édition simultanée de documents

**Réponse métier idéale :** En l'absence de collaboration temps réel (non mentionnée dans la documentation), le système doit utiliser le verrouillage pessimiste : un document en cours d'édition par un utilisateur est marqué comme "verrouillé" pour les autres. Les autres utilisateurs voient "Document verrouillé par [Prénom] depuis 5 minutes" et peuvent uniquement consulter.

**Règle métier recommandée :** `Document.editingBy USER_ID` + `Document.editingUntil TIMESTAMPTZ`. `beginEdit(documentId)` : si `editingBy IS NOT NULL AND editingUntil > NOW()` → erreur `DOCUMENT_LOCKED`. Sinon → `editingBy = currentUser, editingUntil = NOW() + 30min`. L'éditeur doit renouveler le verrou toutes les 5 minutes (keepalive). `endEdit(documentId)` libère le verrou.

**Impact utilisateur :** Clarté totale sur qui édite quoi. Prévention de la perte de travail.

**Impact financier :** Prévention de la corruption d'un contrat ou cahier des charges par une édition simultanée.

**Impact technique :** Champs `editingBy` + `editingUntil` sur `Document`. Endpoint keepalive. Job de nettoyage des verrous expirés.

**Priorité : P2**

---

### Q110 — Insuffisance du rate limiting face au credential stuffing

**Réponse métier idéale :** La protection de l'endpoint de login doit être multi-couches : (1) rate limit par IP (existant), (2) rate limit par compte cible (détecte les attaques sur un compte spécifique depuis plusieurs IPs), (3) blocage temporaire du compte après 10 échecs (quelle que soit l'IP), (4) CAPTCHA après 3 échecs consécutifs, (5) notification email à l'utilisateur en cas de blocage.

**Règle métier recommandée :** `LoginAttempt { email_hash, ip, success, attemptedAt }`. Rate limits : IP → 5 tentatives/minute. Compte → 10 tentatives/heure toutes IPs confondues. Blocage compte : `User.loginBlockedUntil = NOW() + 15min` après 10 échecs. Email de sécurité automatique. CAPTCHA (hCaptcha) après 3 échecs consécutifs.

**Impact utilisateur :** Les comptes légitimes sont protégés contre le credential stuffing sans être pénalisés excessivement (déblocage automatique après 15 minutes).

**Impact financier :** Une compromission de compte admin = accès à toutes les données clients de la company. Impact financier et réputationnel catastrophique.

**Impact technique :** Table `LoginAttempt`. Deux niveaux de rate limiting Redis (`ip:...` et `account:...`). Intégration hCaptcha sur le frontend.

**Priorité : P1**

---

### Q111 — Génération PDF synchrone vs asynchrone

**Réponse métier idéale :** La génération de PDF est asynchrone, déclenchée à l'envoi de la facture ou du devis. Le document est d'abord stocké avec un statut `PDF_GENERATING`. Une fois le PDF généré (job), le statut passe à `PDF_READY` et une notification est envoyée. En attendant, l'interface affiche un bouton "PDF en cours de génération" (non-cliquable) avec un spinner.

**Règle métier recommandée :** `sendInvoice(id)` → enqueue `generatePdf` job → `Invoice.pdfStatus = GENERATING`. Processor : génère le PDF → upload S3 → `Invoice.pdfS3Key = key, pdfStatus = READY` → notification. Fallback : si `pdfStatus = GENERATING` depuis > 5 min → alerte + retry automatique.

**Impact utilisateur :** Aucune erreur 404 sur "télécharger la facture". L'état du PDF est toujours visible.

**Impact financier :** Un PDF inaccessible = client qui ne peut pas payer en ligne = retard de paiement.

**Impact technique :** Champ `pdfStatus ENUM(NONE, GENERATING, READY, FAILED)` sur `Invoice` et `Proposal`. Job asynchrone dans la queue `communication`.

**Priorité : P2**

---

### Q112 — Scope des profils freelance dans le contexte multi-tenant

**Réponse métier idéale :** Les profils freelance sont globaux à l'instance Secritou (marketplace partagée). Les données de mission, évaluations et rémunérations sont scopées par company. Un freelance peut travailler pour plusieurs agences sans que celles-ci ne se voient mutuellement. Le freelance voit uniquement ses missions dans chaque contexte.

**Règle métier recommandée :** `FreelancerProfile.userId` est global (un compte user unique). `FreelancerMission.companyId` est tenant-scoped. `FreelancerRating.companyId` est tenant-scoped (une agence ne voit pas les évaluations d'une autre agence pour le même freelance). Le freelance accède à toutes ses missions depuis son profil global.

**Impact utilisateur :** Le freelance a une vision unifiée de ses missions. Chaque agence maintient la confidentialité de ses évaluations.

**Impact financier :** La confidentialité des évaluations protège la relation agence-freelance. Un freelance mal noté par une agence A ne l'est pas automatiquement pour l'agence B.

**Impact technique :** `FreelancerProfile` sans `companyId`. `FreelancerMission.companyId` obligatoire. Filtre sur `companyId` dans toutes les queries de mission et d'évaluation.

**Priorité : P2**

---

### Q113 — Email existant via formulaire d'inscription public

**Réponse métier idéale :** Le formulaire d'inscription public ne révèle jamais si un email existe déjà dans la base (anti-énumération). Si un email existe, un email de récupération de compte est envoyé à cette adresse ("Vous avez déjà un compte — connectez-vous ou réinitialisez votre mot de passe"). L'interface affiche systématiquement "Si cet email est disponible, vous recevrez un lien de confirmation."

**Règle métier recommandée :** `register(email, password)` : si email existe → email de récupération (pas d'erreur applicative) → retour identique au cas "email disponible". L'attaquant ne peut pas distinguer un email existant d'un email inexistant. Log interne de la tentative avec l'IP pour détection de scan.

**Impact utilisateur :** Aucune fuite d'information sur l'existence d'un compte.

**Impact financier :** Prévention de l'énumération d'emails de clients de l'agence par des concurrents.

**Impact technique :** Pattern déjà utilisé dans `requestPasswordReset` (documenté) — à appliquer de manière cohérente sur `register`.

**Priorité : P1**

---

### Q114 — Accès aux livrables après expiration d'abonnement

**Réponse métier idéale :** Les livrables déposés à l'étape `Delivery` de l'onboarding sont stockés sur S3 avec des URLs permanentes (ou de très longue durée). L'expiration de l'abonnement Secritou de l'agence ne supprime pas les fichiers pendant 90 jours. Pendant cette période, le client peut télécharger ses livrables directement depuis un lien "d'urgence" envoyé par email.

**Règle métier recommandée :** Dès la mise en `READ_ONLY` (J0 d'expiration), un email est envoyé au client listant tous ses livrables avec liens de téléchargement valides 90 jours. Les fichiers S3 sont marqués `retention: LEGAL_HOLD` pour 90 jours supplémentaires après l'expiration totale.

**Impact utilisateur :** Un client n'est jamais privé de livrables qu'il a payés, même si son agence cesse d'utiliser Secritou.

**Impact financier :** Obligation légale : les livrables d'une prestation payée appartiennent au client. Ne pas y donner accès expose Secritou (et l'agence) à une action en restitution.

**Impact technique :** Job déclenché lors du passage en `GRACE_PERIOD` : email récapitulatif avec presigned URLs longue durée (90 jours) pour chaque livrable.

**Priorité : P1**

---

### Q115 — Portée des tickets de support pour les managers

**Réponse métier idéale :** Un MANAGER voit uniquement les tickets des clients qu'il gère directement (filtre `assignedManagerId`). Un ADMIN voit tous les tickets de sa company. Un MANAGER ne peut pas accéder aux tickets d'un client géré par un collègue, même si le contenu semble non-confidentiel.

**Règle métier recommandée :** `getQuestions(userId, role, companyId)` : si `role === MANAGER` → `WHERE client.assignedManagerId = :userId AND companyId = :companyId`. Si `role === ADMIN` → `WHERE companyId = :companyId`. Filtre systématique, non-contournable par paramètre de requête.

**Impact utilisateur :** Confidentialité des échanges client-manager préservée entre pairs.

**Impact financier :** Prévention de fuites d'informations concurrentielles entre managers d'une même agence.

**Impact technique :** Filtre conditionnel dans `question.repository.ts::findAll`.

**Priorité : P3**

---

### Q116 — Chiffrement différencié des archives

*(Voir Q100 — réponse identique et consolidée.)*

**Priorité : P2**

---

### Q117 — Sécurisation du contenu des emails de relance

**Réponse métier idéale :** Les emails de relance ne contiennent jamais de montants, de numéros de facture ou d'informations financières en clair. Ils contiennent uniquement un lien sécurisé (HTTPS, token signé JWT à durée limitée) vers la page de paiement du portail client. Le destinataire doit s'authentifier pour voir les détails.

**Règle métier recommandée :** Template email de relance : "Vous avez une facture en attente de paiement. Cliquez ici pour la consulter et procéder au règlement : [lien signé valide 7 jours]". Le lien contient un JWT d'accès direct à la facture, valide uniquement pour cet email et cette facture. Après authentification automatique, le client voit les détails.

**Impact utilisateur :** Le client clique directement sur le lien et accède à sa facture sans friction (pré-authentification). La sécurité est maintenue car le lien est unique et expirant.

**Impact financier :** Protection des informations financières confidentielles contre l'interception email.

**Impact technique :** JWT à portée limitée (`scope: invoice:view:${invoiceId}`). Endpoint `GET /invoice-access?token=...` qui authentifie et redirige.

**Priorité : P2**

---

### Q118 — Quotas et gestion de la fenêtre de contexte IA

**Réponse métier idéale :** Chaque company dispose d'un quota mensuel de tokens IA (configurable par plan). Un tableau de bord admin expose la consommation en temps réel. À 80% du quota → avertissement. À 100% → désactivation du module IA pour la company jusqu'au renouvellement. Le contexte des conversations longues est résumé automatiquement pour rester dans la fenêtre du modèle.

**Règle métier recommandée :** Table `AiUsage { companyId, month, tokensUsed, tokensLimit }`. Middleware dans `ai.service.ts` : vérification du quota avant chaque appel. Résumé automatique si `conversationTokens > modelContextWindow * 0.8` → appel récapitulatif → nouveau message système de contexte.

**Impact utilisateur :** Le coût IA est maîtrisé. La qualité des réponses ne se dégrade pas silencieusement sur des conversations longues.

**Impact financier :** Sans quotas, un seul utilisateur peut générer des coûts IA disproportionnés (conversations très longues, usage intensif).

**Impact technique :** Table `AiUsage`. Comptage des tokens dans le middleware. Bibliothèque de tokenisation compatible avec le modèle utilisé.

**Priorité : P2**

---

### Q119 — Dépassement budgétaire sur un projet au forfait

**Réponse métier idéale :** Le système calcule en temps réel le coût interne d'un projet (somme des TJM freelance × jours travaillés) et le compare au montant facturé au client. L'alerte "dépassement budgétaire" se déclenche dès que le coût interne dépasse 80% du montant facturé. À 100%, aucune nouvelle entrée de temps n'est possible sans validation ADMIN.

**Règle métier recommandée :** `Project.internalCost DECIMAL(10,2)` mis à jour à chaque entrée de temps freelance. `Project.clientRevenue` = somme des factures PAID liées. Alerte si `internalCost / clientRevenue > 0.8`. Blocage si `internalCost >= clientRevenue` sans override ADMIN avec motif.

**Impact utilisateur :** L'agence réalise en temps réel qu'elle est en train de perdre de l'argent sur un projet.

**Impact financier :** Un projet en dépassement silencieux peut représenter des dizaines de milliers d'euros de pertes non détectées.

**Impact technique :** Champ `internalCost` sur `Project`, maintenu par hook `afterCreateTimeEntry`. Calcul de marge en temps réel.

**Priorité : P1**

---

### Q120 — Correction en masse d'une erreur de TVA

**Réponse métier idéale :** L'ADMIN dispose d'un outil de "correction de TVA en masse" qui : (1) identifie toutes les factures non soldées avec le taux erroné, (2) génère automatiquement un avoir pour chacune, (3) génère de nouvelles factures corrigées avec le bon taux, (4) envoie une communication groupée aux clients concernés. Cette opération nécessite une double validation ADMIN et est irréversible.

**Règle métier recommandée :** Endpoint `POST /admin/tax-correction { oldRate, newRate, fromDate, toDate }` : mode `preview` (liste les factures affectées, calcule l'impact) puis mode `execute` (double confirmation requise). Transaction massive : pour chaque facture identifiée → `CreditNote` + nouvelle `Invoice`. Log d'audit de l'opération avec les IDs avant/après. Notification email aux clients affectés.

**Impact utilisateur :** La correction est transparente pour le client — il reçoit un avoir + une nouvelle facture avec explication claire.

**Impact financier :** Sans cet outil, la correction manuelle de dizaines de factures est une erreur humaine garantie. L'impact fiscal d'une mauvaise TVA sur toute une période peut être très significatif.

**Impact technique :** Transaction PostgreSQL massive avec savepoints. Job asynchrone (pas de timeout HTTP). Rapport de correction exportable.

**Priorité : P1**

---

---

# TABLEAU RÉCAPITULATIF — SYNTHÈSE DES 120 RISQUES

| # | Module | Problème détecté | Risque | Solution recommandée | Priorité |
|---|--------|------------------|--------|----------------------|----------|
| 1 | CRM | Doublon client à la conversion de lead | Données incohérentes, double facturation | Vérification unicité email + workflow de fusion | P1 |
| 2 | CRM | Suppression lead avec historique | Perte de piste d'audit commerciale | Soft-delete obligatoire, purge admin uniquement | P1 |
| 3 | CRM | Réassignation lead cross-tenant | Fuite de données RGPD | Validation `targetUser.companyId === lead.companyId` | P2 |
| 4 | CRM | Leads orphelins post-suppression manager | Perte de revenus commerciaux | Réassignation forcée avant désactivation | P1 |
| 5 | Leads | Double soumission formulaire public | Doublon prospect, conflit commercial | Idempotence par `(email, companyId, 24h)` | P1 |
| 6 | Leads | Conversion sans manager assigné | Client fantôme, aucun suivi | Blocage conversion si `assignedTo === null` | P1 |
| 7 | Leads | Quota utilisateurs vs leads actifs | Blocage opérationnel | Quotas limités à la création, jamais à l'existant | P3 |
| 8 | Leads | Collision Lead / FreelancerApplication | Confusion de workflows | Hook cross-module sur email à la création | P2 |
| 9 | Clients | Suppression client avec impayés | Violation légale, perte comptable | Blocage suppression si solde non nul | P0 |
| 10 | Clients | Modification email principal | Prise de contrôle de compte | Double confirmation email + délai 24h + audit | P0 |
| 11 | Clients | Mauvais payeur recevant nouveau devis | Perte financière | Score de risque client + blocage envoi automatique | P1 |
| 12 | Clients | Édition simultanée du profil client | Données corrompues | Optimistic locking avec champ `version` | P1 |
| 13 | Clients | Changement de langue et documents existants | Incohérence documentaire | Langue figée sur chaque document à la génération | P2 |
| 14 | Projets | Suspension projet avec missions actives | Freelances travaillent sans le savoir | Cascade `PAUSED` sur missions + notifications | P1 |
| 15 | Projets | Suppression projet avec factures | Violation légale comptable | Archive uniquement, suppression physique impossible | P0 |
| 16 | Projets | Score Client Success après archivage projet | Score faussé | Score historique 12 mois vs score actif séparés | P2 |
| 17 | Projets | Changement de chef de projet | Rupture de continuité | Workflow de transfert avec notifications et accès transitoire | P2 |
| 18 | Projets | Deux projets même nom même client | Confusion opérationnelle | Avertissement non bloquant | P3 |
| 19 | Onboarding | Acompte non encaissé malgré signature | Risque financier majeur | Verrou dur sur étape Payment, webhook obligatoire | P0 |
| 20 | Onboarding | Abandon après signature, ressources engagées | Coûts sans revenu | Ressources allouées seulement après KickoffMeeting | P1 |
| 21 | Onboarding | Saut d'étape par un admin | Risque juridique (projet sans contrat) | Étapes MANDATORY non contournables, OPTIONAL_WAIVABLE avec motif | P1 |
| 22 | Onboarding | Refus répété du cahier des charges | Blocage production | Limite de révisions configurable + escalade automatique | P2 |
| 23 | Onboarding | Rétrogradation du % de progression | Opacité sur l'avancement | Motif obligatoire + visible dans historique | P3 |
| 24 | Onboarding | Onboarding lié à projet supprimé | Lien cassé, erreurs navigation | FK `ON DELETE RESTRICT` en base | P1 |
| 25 | Devis | Race condition acceptation/modification | Litige contractuel sur le montant | Optimistic locking avec numéro de version | P0 |
| 26 | Devis | Expiration pendant signature active | Friction commerciale, vente perdue | Fenêtre de grâce 15 min + champ `activeSessionUntil` | P1 |
| 27 | Devis | Modification silencieuse d'un devis SENT | Violation contractuelle | Retour en DRAFT obligatoire + renvoi + diff historique | P0 |
| 28 | Devis | Prestation supprimée après devis accepté | Ligne orpheline sur facture | Snapshot des lignes à la création, FK optionnelle | P1 |
| 29 | Devis | Destinataires de la notification de refus | Manager non informé | Notification configurable : ADMIN + manager assigné | P2 |
| 30 | Devis | Double devis concurrent même client | Confusion commerciale client | Détection de doublon + confirmation obligatoire | P2 |
| 31 | Devis | Conflit expiration batch vs rejet manuel | Incohérence d'état | Conditional update SQL (`WHERE status IN (...)`) | P3 |
| 32 | Factures | Annulation facture PAID sans avoir | Non-conformité comptable et légale | Avoir (CreditNote) obligatoire avant annulation | P0 |
| 33 | Factures | Collision numéros de factures concurrents | Violation légale (double numéro) | Séquence PostgreSQL atomique par company/mois | P0 |
| 34 | Factures | Suppression facture SENT/OVERDUE | Infraction Code général des impôts | Soft-delete ou CANCELLED uniquement, jamais de suppression | P0 |
| 35 | Factures | Perte de remise à la conversion devis→facture | Litige contractuel sur montant | Assertion de cohérence devis/facture post-conversion | P1 |
| 36 | Factures | Échéance tombant jour férié/week-end | Non-conformité juridique | Service `businessDays` avec calendrier configurable | P2 |
| 37 | Factures | Modification lignes facture SENT | Violation légale comptable | Facture SENT verrouillée, workflow avoir + nouvelle facture | P0 |
| 38 | Factures | TVA erronée entre DRAFT et SENT | Risque fiscal | Recalcul TVA à l'envoi avec alerte si changement | P1 |
| 39 | Factures | Double facture sur même devis | Double facturation client | Index partiel UNIQUE PostgreSQL + vérification applicative | P0 |
| 40 | Paiements | Double enregistrement simultané | Solde client faux | Idempotency key UUID sur Payment + contrainte UNIQUE | P0 |
| 41 | Paiements | Absence d'avoir et remboursement | Intenable légalement et opérationnellement | Entités CreditNote + Refund + ClientCredit indispensables | P0 |
| 42 | Paiements | Chargeback non géré | Argent remboursé mais comptabilisé encaissé | Webhook dispute + statut DISPUTED + dossier de réponse | P1 |
| 43 | Paiements | Paiement en devise étrangère | Écarts de change non tracés | Mono-devise EUR en Phase 1 + policy explicite | P2 |
| 44 | Paiements | Surpaiement non visible | Dette implicite de l'agence | Surpaiement = CreditNote automatique + notification | P1 |
| 45 | Paiements | Echec job markOverdueInvoices sans alerte | Relances non envoyées, perte trésorerie | JobExecutionLog + alerte Sentry + dashboard admin | P1 |
| 46 | Paiements | Date comptable vs date de saisie | Clôture mensuelle incorrecte | Champs `paymentDate` (valeur) et `recordedAt` (saisie) | P2 |
| 47 | Approbations | Double approbation simultanée | Timeline d'audit incohérente | Optimistic locking sur Approval | P1 |
| 48 | Approbations | Absence de révocation d'approbation | Erreurs irréversibles | Révocation 24h + ADMIN override + audit trail | P2 |
| 49 | Approbations | Client sans accès portail, approbation en attente | Blocage production | Escalade automatique J+3/J+7 + approbation par substitution | P2 |
| 50 | Approbations | Commentaires de rejet visibles des freelances | Divulgation d'infos confidentielles | Champs distincts `rejectionComment` et `freelanceNote` | P2 |
| 51 | Documents | Changement accidentel niveau d'accès | Fuite d'informations confidentielles | Double confirmation + audit sur changement ADMIN_ONLY→* | P1 |
| 52 | Documents | Purge 365j des documents comptables | Violation légale (CGI art. L123-22) | Politique de rétention par catégorie (7-10 ans pour comptable) | P0 |
| 53 | Documents | Document parent supprimé, enfants orphelins | Intégrité des données compromise | Cascade soft-delete + archiveGroupId | P2 |
| 54 | Documents | Logs d'accès non conformes RGPD | Amende CNIL | Rétention 12 mois max + anonymisation IP à 3 mois | P1 |
| 55 | Documents | Deux fichiers même nom même dossier | Confusion, doublons | Versioning automatique à la détection de doublon de nom | P3 |
| 56 | Support | Absence d'escalade SLA | Violation d'engagements contractuels | SlaConfig par company + job d'escalade horaire | P2 |
| 57 | Support | Ticket fermé sans réponse | Mauvaise expérience client | Statut ANSWERED requis + closureType obligatoire si ADMIN | P2 |
| 58 | Support | Réouverture d'un ticket CLOSED | Abus possible vs frustration client | Fenêtre de réouverture 14 jours | P3 |
| 59 | Support | URLs S3 permanentes sur pièces jointes tickets | Accès non authentifié permanent | Presigned URLs S3 avec expiration 1h | P1 |
| 60 | Freelances | Freelance qui abandonne sans notification | Production bloquée silencieusement | Détection inactivité J+3 → AT_RISK, J+7 → INACTIVE_REVIEW | P1 |
| 61 | Freelances | Conflit d'intérêts freelance / client direct | Contournement commission agence | Détection cross-module + confirmation obligatoire | P2 |
| 62 | Freelances | Note freelance non modifiable après erreur | Injustice irréversible | Modification par auteur 14 jours + suppression admin sur fraude | P2 |
| 63 | Freelances | Compte freelance jamais activé | Ressources consommées pour rien | Délai d'activation 7j + désactivation auto à 30j | P2 |
| 64 | Freelances | CV rejetés conservés sur S3 | Non-conformité RGPD | Suppression automatique J+60 après rejet | P1 |
| 65 | Marketplace | Suppression profil freelance avec mission active | Mission orpheline | Blocage suppression + clôture mission obligatoire | P1 |
| 66 | Marketplace | Double assignation d'une mission | Double paiement freelance | Transaction atomique + contrainte UNIQUE partielle | P1 |
| 67 | Marketplace | TJM freelance visible par le client | Divulgation de marge | DTO public sans `dailyRate`, endpoint ADMIN uniquement | P1 |
| 68 | Marketplace | Note freelance < seuil sans alerte | Freelance mal noté proposé aux clients | Hook post-calcul + désactivation auto si < 2.5/5 | P3 |
| 69 | Auth | Multi-appareils et rotation par famille trop agressive | Déconnexion utilisateur légitime | Reuse interval 30s + famille par appareil | P1 |
| 70 | Auth | Suppression dernier ADMIN de la company | Company ingérable | Blocage suppression si adminCount === 1 | P0 |
| 71 | Auth | Lien reset password à usage multiple | Prise de contrôle de compte | Token invalidé au premier clic, pas à la soumission | P0 |
| 72 | Auth | Contournement mustChangePassword via API | Compte avec credentials temporaires utilisables | Claim `mcp` dans le JWT lui-même | P1 |
| 73 | Auth | Révocation tokens non immédiate après désactivation | Accès persistant post-désactivation | Blacklist Redis + vérification à chaque requête | P1 |
| 74 | Auth | Logs connexions échouées non conformes RGPD | Amende CNIL | Email hashé SHA-256 + rétention 90j + base légale documentée | P3 |
| 75 | Multi-tenant | Absence de Row-Level Security PostgreSQL | Fuite catastrophique inter-tenant | RLS PostgreSQL sur toutes les tables tenant-scoped | P0 |
| 76 | Multi-tenant | Transfert de propriété company non géré | Ambiguïté juridique | Workflow multi-étapes + validation plateforme | P2 |
| 77 | Multi-tenant | Même email dans deux companies | Cross-tenant access accidentel | Clé unique `(email, companyId)` + sélecteur tenant | P1 |
| 78 | Multi-tenant | Injection companyId dans les exports | Espionnage inter-tenant | companyId toujours du JWT, paramètres ignorés | P1 |
| 79 | Multi-tenant | Noisy neighbor | Dégradation de service globale | Rate limiting par companyId + quotas par plan | P3 |
| 80 | Notifications | Perte emails critiques sur chute BullMQ | Emails irrecupérables | removeOnFail 30j + Bull Board + alertes Prometheus | P1 |
| 81 | Notifications | Client avec anti-spam, notifications non reçues | Devis/factures non vus | Fallback in-app automatique si email non ouvert 48h | P2 |
| 82 | Notifications | Notifications archivées inaccessibles | Litiges sans preuves | Archives consultables en admin + cold storage S3 | P3 |
| 83 | Notifications | Absence de préférences utilisateur | Spam perçu, désengagement | Table NotificationPreference + événements non-désactivables | P3 |
| 84 | IA | Données PII envoyées au modèle tiers | Violation RGPD + NDA clients | Anonymisation NER avant envoi API + DPA signé | P1 |
| 85 | IA | Accès admin aux conversations IA | Surveillance illégale employés | Conversations privées par défaut + middleware légal | P2 |
| 86 | IA | Indisponibilité service IA bloque l'app | Disruption des opérations critiques | Circuit breaker + fallback gracieux | P2 |
| 87 | IA | Conversations supprimées en soft-delete | Droit à l'effacement RGPD non respecté | Hard delete + GdprErasureLog | P2 |
| 88 | Dashboard | Cache 60s sur données de paiement | Admin relance un client déjà payé | Invalidation event-driven sur paiements critiques | P2 |
| 89 | Dashboard | Données manager non scopées par assignation | Fuite d'infos commerciales interne | Filtre `assignedManagerId` conditionnel par rôle | P2 |
| 90 | Dashboard | TTC vs HT non configurable | Litige sur montant dû | Champ `displayTaxInclusive` par company | P2 |
| 91 | Reporting | Rapports non signés numériquement | Preuves falsifiables | Hash SHA-256 + ReportExportLog | P1 |
| 92 | Reporting | Rapports générés pendant archivage | Données partielles / incohérentes | Mutex Redis entre archivage et génération de rapports | P2 |
| 93 | Reporting | Rapports antérieurs à l'activation | Trous de données non signalés | Borne minimale `company.activatedAt` avec avertissement | P3 |
| 94 | Reporting | Clients accédant aux rapports agence | Divulgation de données commerciales | Routes séparées `/reports/` vs `/client/reports/` | P1 |
| 95 | Archivage | Leads RGPD archivés sans base légale | Amende CNIL | Politique de rétention différenciée + suppression EXPIRED | P1 |
| 96 | Archivage | DELETE + INSERT non atomique | Perte de données irréversible | CTE `WITH archived AS (DELETE RETURNING *)` | P0 |
| 97 | Archivage | Backups excluant tables partitionnées | Données perdues en disaster recovery | Vérification nombre tables post-dump + test restauration | P1 |
| 98 | Archivage | Archivage partiel en cas d'échec | Données en double état | Traitement par batch de 500 + ArchiveBatch log | P2 |
| 99 | Archivage | Aucune interface accès aux archives | Données récupérables uniquement par SQL | Endpoint admin + vue read-only | P2 |
| 100 | Archivage | Chiffrement insuffisant des archives | Fuite de 7+ ans de données sensibles | SSE-KMS S3 + bucket séparé + IAM dédié | P2 |
| 101 | Auth | Invitation première connexion expirée trop vite | Client bloqué avant son onboarding | Token 72h + relance auto J+7 + statut PENDING visible | P1 |
| 102 | Projets | Dépassement budgétaire silencieux | Pertes financières non détectées | Champ `budget` + alertes 75%/100% + blocage ADMIN | P2 |
| 103 | Multi-tenant | Company désactivée sans période de grâce | Violation droit d'accès RGPD | Statuts progressifs GRACE → READ_ONLY → SUSPENDED | P1 |
| 104 | Onboarding | JSON questionnaire malformé bloque onboarding | Blocage sur erreur technique | Schéma Zod partagé + erreurs par champ | P2 |
| 105 | Freelances | CV candidats rejetés conservés | Non-conformité RGPD | Job BullMQ différé 60j pour suppression S3 | P1 |
| 106 | Devis | Onboarding non créé après acceptation devis | Projet démarré sans parcours guidé | Création automatique onboarding dans `acceptProposal` | P1 |
| 107 | Reporting | Absence de métriques de conversion | Pilotage commercial impossible | Vue matérialisée PostgreSQL + endpoint filtrable | P2 |
| 108 | Paiements | Paiements manuels sans validation | Risque de fraude interne | Workflow 2 niveaux : saisie MANAGER + validation ADMIN | P2 |
| 109 | Documents | Édition simultanée non gérée | Corruption de contrat ou cahier des charges | Verrouillage pessimiste avec `editingBy` + TTL 30min | P2 |
| 110 | Auth | Rate limiting insuffisant vs credential stuffing | Compromission de compte admin | Multi-couches : IP + compte + CAPTCHA + notification | P1 |
| 111 | Factures | Génération PDF synchrone | Erreur 404 sur téléchargement | Génération asynchrone + statut `pdfStatus` | P2 |
| 112 | Multi-tenant | Scope des profils freelance multi-tenant | Évaluations cross-tenant visibles | Profile global, missions/ratings scoped par companyId | P2 |
| 113 | Clients | Email existant via formulaire public | Énumération d'emails clients | Réponse identique + email de récupération + log interne | P1 |
| 114 | Onboarding | Livrables inaccessibles après expiration abonnement | Obligation légale de restitution | Email récapitulatif + presigned URLs 90j à l'expiration | P1 |
| 115 | Support | Tickets support non scopés par manager | Fuite d'infos client entre managers | Filtre `assignedManagerId` conditionnel dans le repository | P3 |
| 116 | Archivage | Chiffrement archives insuffisant | Fuite de données historiques sensibles | SSE-KMS + bucket séparé (voir Q100) | P2 |
| 117 | Notifications | Montants en clair dans emails de relance | Interception d'informations financières | Lien sécurisé uniquement, aucune donnée financière en clair | P2 |
| 118 | IA | Absence de quotas tokens par company | Coûts IA incontrôlables | Table AiUsage + middleware quota + résumé automatique | P2 |
| 119 | Projets | Dépassement budgétaire interne (freelances) | Pertes financières non détectées | `internalCost` en temps réel vs `clientRevenue` | P1 |
| 120 | Factures | Erreur de TVA en masse non corrigeable | Impact fiscal majeur + remboursements massifs | Outil de correction TVA en masse + workflow double validation | P1 |

---

# SCORE GLOBAL D'ARCHITECTURE MÉTIER — SECRITOU

## Méthodologie de notation

Chaque dimension est notée sur 10 points (→ score sur 100 total). L'évaluation est celle d'un comité d'architecture SaaS Enterprise avant commercialisation. Les notes sont délibérément sévères — le référentiel est Stripe, Salesforce, Odoo, et Quickbooks en production.

---

## CRM — 5.5/10

**Points forts :** Pipeline de leads structuré, pipeline CRM cohérent, conversion lead→client documentée.

**Points faibles :** Aucun mécanisme de dédoublonnage à la conversion (P1). Pas de réassignation automatique sur suppression manager (P1). Pas de détection de collision cross-module (Lead vs FreelancerApplication). L'isolation tenant sur les réassignations n'est pas garantie en base. Un CRM B2B professionnel doit gérer l'identité des personnes de manière robuste — Secritou traite les emails comme des chaînes de caractères, pas comme des entités d'identité.

---

## Facturation — 3.5/10

**Note critique.** C'est le module le plus dangereux de toute l'architecture.

**Points forts :** La mécanique de calcul des totaux (source de vérité : lignes) est solide. L'interdiction de modifier le montant directement est bonne.

**Points faibles critiques :** Absence totale d'avoir (credit note) — P0 bloquant. Absence de gestion des chargebacks. Risque de collision de numéros de facture. Suppression de factures émises possible. TVA non sécurisée. Dates comptables non différenciées. Ce module ne peut PAS aller en production commerciale dans l'état documenté. La conformité légale française (CGI) n'est pas assurée sur au moins 5 points.

---

## Workflow — 6/10

**Points forts :** La machine à états des devis est bien définie. L'onboarding guidé est un atout différenciant réel. Le cycle de vie des factures (DRAFT → SENT → PAID → CANCELLED) est cohérent dans ses grandes lignes.

**Points faibles :** Les race conditions ne sont pas gérées sur les transitions d'état les plus critiques (devis accepté/modifié simultanément — P0). L'onboarding manque de verrous durs sur les étapes financières (Payment non validé par webhook). La cascade de notifications et de statuts sur la suspension de projet n'est pas documentée. L'automatisation post-acceptation de devis (création onboarding) n'est pas implémentée.

---

## Sécurité — 6.5/10

**Points forts :** Architecture JWT avec rotation par famille excellente. Double protection middleware + filtre Prisma. Helmet, CORS, rate limiting, bcrypt 12 rounds. La réflexion sécurité est présente et sérieuse.

**Points faibles :** Lien de reset password à usage multiple (P0). Rate limiting insuffisant face aux botnets distribués (P1). mustChangePassword contournable via API directe (P1). Révocation de tokens non immédiate (P1). L'absence de RLS PostgreSQL laisse un seul bug de code suffire à une fuite catastrophique (P0). La sécurité est bonne au niveau applicatif mais manque de défense en profondeur au niveau base de données.

---

## Multi-tenant — 5/10

**Points forts :** Le companyId est présent sur toutes les tables. Les middlewares `requireCompanyTenant` et `requireClientTenant` existent. Le test E2E d'isolation tenant est mentionné.

**Points faibles critiques :** Absence de RLS PostgreSQL (P0 — un bug applicatif suffit à tout exposer). Pas de gestion du transfert de propriété de company. Pas de gestion des emails identiques dans deux tenants. Pas de rate limiting par tenant. La protection multi-tenant repose sur une seule couche applicatif — dans un SaaS B2B mature, c'est insuffisant. Les données de plusieurs entreprises concurrentes cohabitent sur la même instance sans filet de sécurité DB.

---

## Audit — 5.5/10

**Points forts :** Le historique des devis est mentionné. L'audit log sur certaines opérations est présent. Les logs d'accès aux documents sont implementés.

**Points faibles :** Pas d'audit log systématique sur toutes les entités financières. Pas de versionnage des factures et devis. Les logs d'accès documents ne sont pas conformes RGPD. Pas de hash d'intégrité sur les exports de rapports. L'audit est fragmentaire plutôt que systématique. Un vrai système d'audit SaaS Enterprise a un audit log immuable sur chaque entité critique, consultable par l'admin.

---

## Scalabilité — 7/10

**Points forts :** L'architecture BullMQ + Redis pour les jobs asynchrones est solide. La stratégie d'archivage partitionné est pensée pour le scale. Les index composites sont mentionnés. Le code-splitting frontend. Le pré-calcul des dashboards. Le cache Redis avec invalidation par tags.

**Points faibles :** L'atomicité du DELETE+INSERT d'archivage n'est pas garantie (P0). Pas de rate limiting par tenant (noisy neighbor). Pas de quotas par plan d'abonnement. Les séquences de numérotation de factures ne sont pas atomiques. La gestion du contexte IA long n'est pas prévue. C'est la dimension la mieux adressée, mais avec des lacunes sur les points critiques.

---

## Expérience utilisateur — 6/10

**Points forts :** L'onboarding guidé est un différenciant UX réel. Le portail client séparé est bien pensé. Le i18n FR/EN est complet. Les composants CRUD génériques accélèrent la cohérence de l'interface. Le lazy-loading est présent.

**Points faibles :** Plusieurs situations d'erreur génèrent une UX catastrophique (devis qui expire pendant la signature, PDF non disponible au téléchargement, client bloqué par mustChangePassword sans invitation claire). Les race conditions se traduisent par des erreurs non explicites. L'absence de préférences de notifications crée du spam perçu. La détection de surpaiement est dans les logs, invisible à l'admin.

---

## Robustesse métier — 4/10

**Note critique.** C'est la dimension la plus préoccupante.

**Points forts :** Les transitions d'état protégées sur les devis et factures (machine à états explicite). La recomputeInvoiceAmount sur chaque modification de ligne.

**Points faibles :** L'absence d'avoir/credit note est une lacune métier fondamentale. Les chargebacks ne sont pas gérés. Les mauvais payeurs n'ont pas de workflow dédié. La suppression du dernier admin est possible. La gestion multi-devises est absente. La conformité légale française sur la facturation n'est pas assurée. Les cas réels d'entreprise (freelance qui abandonne, projet suspendu, manager licencié) n'ont pas de workflow documenté. Un SaaS B2B qui traite de l'argent DOIT avoir ces cas couverts avant le premier client.

---

## SCORE GLOBAL

| Dimension | Note /10 |
|-----------|----------|
| CRM | 5.5 |
| Facturation | 3.5 |
| Workflow | 6.0 |
| Sécurité | 6.5 |
| Multi-tenant | 5.0 |
| Audit | 5.5 |
| Scalabilité | 7.0 |
| Expérience utilisateur | 6.0 |
| Robustesse métier | 4.0 |
| **TOTAL** | **49/100** |

---

## VERDICT DU COMITÉ D'ARCHITECTURE

**Secritou obtient 49/100.**

Ce score place l'architecture dans la catégorie **"Prototype avancé — non certifié pour production commerciale"**.

L'architecture révèle un travail de développement sérieux et réfléchi sur plusieurs aspects (BullMQ, JWT rotation, code-splitting, archivage partitionné). La vision produit est cohérente et le périmètre fonctionnel est ambitieux.

**Cependant, 12 bloquants absolus (P0) ont été identifiés.** Aucun produit SaaS traitant de la facturation et de données personnelles ne peut être commercialisé avec ces lacunes :

1. Suppression client avec impayés (P0)
2. Double confirmation email (P0)
3. Acompte d'onboarding sans webhook de confirmation (P0)
4. Race condition acceptation devis (P0)
5. Modification silencieuse devis SENT (P0)
6. Annulation facture PAID sans avoir (P0)
7. Collision numéros de factures (P0)
8. Suppression factures émises (P0)
9. Double facture sur même devis (P0)
10. Double paiement sans idempotency (P0)
11. Absence d'avoir et remboursement (P0)
12. Suppression dernier admin company (P0)
13. Lien reset à usage multiple (P0)
14. Absence de Row-Level Security PostgreSQL (P0)
15. DELETE+INSERT archivage non atomique (P0)
16. Purge 365j des documents comptables (P0)

**Recommandation : 3 sprints de consolidation avant toute ouverture commerciale, avec revue juridique (fiscaliste + DPO) obligatoire sur les modules Facturation et Archivage.**

---

*Rapport généré par le Comité d'Architecture SaaS Enterprise*  
*Classification : CONFIDENTIEL — Ne pas diffuser à l'extérieur de l'équipe produit*
