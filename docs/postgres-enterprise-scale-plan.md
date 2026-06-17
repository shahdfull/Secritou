# PostgreSQL scale plan

Objectif: supporter environ 100 000 utilisateurs, 10 millions de lignes, et 500 connexions simultanées avec un modèle Prisma multi-tenant.

## Lecture rapide

- Le point critique n'est pas le volume brut des tables, mais la combinaison de requêtes multi-tenant, de tris récents, de recherches texte `ILIKE`, et de 500 connexions applicatives.
- La base doit être optimisée pour:
  - les filtres `companyId`
  - les tris `createdAt DESC`
  - les statuts fréquents
  - les recherches texte sur `name`, `email`, `title`, `description`
  - les compteurs dashboard
- Je recommande de séparer:
  - base chaude: données actives des 12 à 18 derniers mois
  - archive froide: données clôturées/anciennes
  - lecture publique: réplicas en lecture
  - pool de connexions: PgBouncer obligatoire

## Hypothèses de charge

- 100 000 utilisateurs
- 10 millions de lignes cumulées sur les entités métier
- 500 connexions simultanées côté application
- forte proportion de `findMany` paginés, `count`, `groupBy`, et `ILIKE`

## Analyse par table

### Company

- Requêtes observées:
  - lookup par `id`
  - recherche par `name`
- Index recommandés:
  - `company_name_trgm_idx` sur `name` en GIN trigram
- Justification:
  - la recherche textuelle sur l’administration et l’onboarding sera plus rapide
- Gain estimé:
  - recherche partielle: 5x à 20x sur lots moyens

### User

- Requêtes observées:
  - `findUnique(email)`
  - `findUnique(id)`
  - `findMany(companyId)`
  - `findMany(companyId, role IN ADMIN/MANAGER)`
  - `findMany(clientId)`
  - reset password via `resetToken`
- Index recommandés:
  - `user_company_created_idx` sur `(companyId, createdAt DESC)`
  - `user_company_role_idx` sur `(companyId, role)`
  - `user_client_idx` sur `(clientId)`
  - `user_reset_token_idx` sur `(resetToken)` partiel `WHERE resetToken IS NOT NULL`
- Justification:
  - les pages admin et les contrôles d’accès tenant sont dominés par ces filtres
- Gain estimé:
  - listes paginées: 3x à 10x
  - contrôles de rôle: 2x à 5x
  - reset token lookup: suppression quasi totale du scan

### Lead

- Requêtes observées:
  - liste tenant `companyId + archivedAt IS NULL`
  - tri `createdAt DESC`
  - filtres `status`
  - recherche texte `name/email/source/notes`
  - analytics par `createdAt`
- Index recommandés:
  - `lead_company_created_idx` sur `(companyId, createdAt DESC)`
  - `lead_company_status_created_idx` sur `(companyId, status, createdAt DESC)`
  - `lead_company_active_idx` partiel sur `(companyId, createdAt DESC)` où `archivedAt IS NULL`
  - `lead_name_trgm_idx`, `lead_email_trgm_idx`, `lead_source_trgm_idx`, `lead_notes_trgm_idx`
  - `lead_archived_at_idx` si l’archivage reste en table chaude
- Justification:
  - c’est la table la plus exposée au dashboard et au CRM
  - `archivedAt IS NULL` devient un filtre très sélectif si l’archive froide est bien gérée
- Gain estimé:
  - listes tenant: 4x à 12x
  - recherche texte: 10x à 30x
  - dashboards: 2x à 6x

### Client

- Requêtes observées:
  - `companyId`
  - `companyId + createdAt`
  - recherche `name/email`
- Index recommandés:
  - `client_company_created_idx` sur `(companyId, createdAt DESC)`
  - `client_name_trgm_idx`, `client_email_trgm_idx`
- Justification:
  - navigation client et recherche globale
- Gain estimé:
  - pagination et recherche: 3x à 15x

### Project

- Requêtes observées:
  - `companyId`
  - `companyId + status`
  - `companyId + createdAt`
  - `clientId`
  - recherche `name/description`
  - filtre freelancer via `tasks.some(assigneeId)`
- Index recommandés:
  - `project_company_created_idx` sur `(companyId, createdAt DESC)`
  - `project_company_status_idx` sur `(companyId, status)`
  - `project_client_idx` sur `(clientId)`
  - `project_name_trgm_idx`, `project_description_trgm_idx`
  - `project_company_status_created_idx` sur `(companyId, status, createdAt DESC)` si le tri par date reste dominant
- Justification:
  - projet est un pivot de la plupart des écrans
- Gain estimé:
  - liste et filtres: 3x à 10x
  - recherche: 8x à 20x

### Task

- Requêtes observées:
  - `projectId + status`
  - `assigneeId`
  - `dueDate + status`
  - recherche `title/description`
  - jointure via `project.companyId`
  - filtres freelancer `assigneeId = userId`
- Index recommandés:
  - `task_project_status_idx` sur `(projectId, status)`
  - `task_assignee_idx` sur `(assigneeId)`
  - `task_due_status_partial_idx` sur `(dueDate)` avec condition `status <> 'DONE' AND dueDate IS NOT NULL`
  - `task_project_created_idx` sur `(projectId, createdAt DESC)`
  - `task_title_trgm_idx`, `task_description_trgm_idx`
  - `task_project_assignee_idx` sur `(projectId, assigneeId)` si les vues par projet et par assignation restent fréquentes
- Justification:
  - les tâches vont rapidement devenir la table la plus consultée après les leads
  - les requêtes par projet et les échéances doivent rester index-only autant que possible
- Gain estimé:
  - listes projet: 3x à 8x
  - overdue scan: 5x à 20x
  - recherche texte: 10x à 25x

### Comment

- Requêtes observées:
  - `taskId`
  - `authorId`
  - tri par `createdAt ASC` sur les commentaires d’un ticket
- Index recommandés:
  - `comment_task_created_idx` sur `(taskId, createdAt ASC)`
  - `comment_author_idx` sur `(authorId)`
- Justification:
  - lecture du fil de discussion et audit utilisateur
- Gain estimé:
  - chargement des threads: 5x à 15x

### ContactRequest

- Requêtes observées:
  - `status`
  - `createdAt`
  - `status + createdAt`
- Index recommandés:
  - `contact_status_created_idx` sur `(status, createdAt DESC)`
  - `contact_created_idx` sur `(createdAt DESC)` si les exports par date sont fréquents
- Justification:
  - table append-only avec forte pression sur tri/pagination
- Gain estimé:
  - 3x à 15x

### Skill

- Requêtes observées:
  - lookup par `name`
- Index recommandés:
  - aucun supplémentaire si `name` reste unique
- Justification:
  - la clé unique suffit
- Gain estimé:
  - négligeable

### FreelancerProfile

- Requêtes observées:
  - `findUnique(userId)`
  - listing public trié par `createdAt`
  - tri sur `hourlyRate`, `name`, `email`
- Index recommandés:
  - conserver l’unique sur `userId`
  - `freelancer_created_idx` sur `(createdAt DESC)`
  - `freelancer_hourlyrate_idx` sur `(hourlyRate)`
  - éventuellement `freelancer_availability_created_idx` sur `(availability, createdAt DESC)`
- Justification:
  - listing marketplace et profil utilisateur
- Gain estimé:
  - 2x à 8x

### FreelancerMission

- Requêtes observées:
  - `companyId + status`
  - `companyId + status + updatedAt`
  - `freelancerId`
  - `status = OPEN`
  - analytics sur `COMPLETED`
- Index recommandés:
  - `mission_company_status_updated_idx` sur `(companyId, status, updatedAt DESC)`
  - `mission_company_created_idx` sur `(companyId, createdAt DESC)`
  - `mission_freelancer_idx` sur `(freelancerId)`
  - `mission_open_idx` partiel sur `(createdAt DESC)` où `status = 'OPEN'`
- Justification:
  - le listing marketplace et les tableaux de bord dépendent de cette table
- Gain estimé:
  - 3x à 10x

### MissionApplication

- Requêtes observées:
  - `missionId`
  - `missionId + status`
  - `freelancerId`
  - unique `(missionId, freelancerId)`
- Index recommandés:
  - `mission_app_mission_created_idx` sur `(missionId, createdAt DESC)`
  - `mission_app_mission_status_idx` sur `(missionId, status)`
  - `mission_app_freelancer_idx` sur `(freelancerId)`
- Justification:
  - chargement des candidatures par mission
- Gain estimé:
  - 3x à 12x

### PortfolioItem

- Requêtes observées:
  - `freelancerId`
- Index recommandés:
  - `portfolio_freelancer_created_idx` sur `(freelancerId, createdAt DESC)`
- Gain estimé:
  - 2x à 5x

### Notification

- Requêtes observées:
  - `userId`
  - `userId + read`
  - `userId + createdAt DESC`
  - `updateMany(userId, read = false)`
- Index recommandés:
  - `notification_user_created_idx` sur `(userId, createdAt DESC)`
  - `notification_unread_idx` partiel sur `(userId)` où `read = false`
- Justification:
  - flux de notifications et badge unread
- Gain estimé:
  - 5x à 20x

### Document

- Requêtes observées:
  - `companyId`
  - `companyId + createdAt`
  - `clientId`
  - `projectId`
- Index recommandés:
  - `document_company_created_idx` sur `(companyId, createdAt DESC)`
  - `document_client_idx` sur `(clientId)`
  - `document_project_idx` sur `(projectId)`
  - si volume élevé: `document_company_type_created_idx` sur `(companyId, type, createdAt DESC)`
- Justification:
  - navigation documentaire et conservation
- Gain estimé:
  - 3x à 10x

### RefreshToken

- Requêtes observées:
  - `tokenHash`
  - `userId`
  - `expiresAt`
- Index recommandés:
  - garder l’unique sur `tokenHash`
  - `refresh_user_idx` sur `(userId)`
  - `refresh_expires_idx` sur `(expiresAt)`
  - optionnel: `refresh_revoked_expires_idx` sur `(revokedAt, expiresAt)`
- Gain estimé:
  - faible à moyen, mais utile pour purge et revocation

## Partitionnement

### Ce que je recommande

- Ne pas partitionner immédiatement les tables Prisma transactionnelles actuelles.
- À la place, partitionner les tables d’archive et les tables append-only de rétention.
- Pourquoi:
  - Prisma gère mal les mutations structurelles lourdes sur partitions existantes
  - plusieurs modèles ont une PK UUID seule, ce qui complique les partitions natives avec contraintes uniques globales

### Tables candidates

- `LeadArchive`
- `ContactRequestArchive`
- `NotificationArchive`
- éventuellement `DocumentArchive`

### Découpage recommandé

- partitionnement mensuel par `createdAt`
- rétention:
  - `ContactRequestArchive`: 12 à 24 mois
  - `NotificationArchive`: 90 à 180 jours
  - `LeadArchive`: selon cycle commercial

### Bénéfice

- suppression des vieux segments de table chaude
- vacuum plus léger
- index plus petits
- scans analytiques plus rapides

## PgBouncer

### Configuration cible

- mode:
  - `transaction` pour l’application web
- pool:
  - `default_pool_size = 20` à `40` par instance applicative
  - `max_client_conn` dimensionné selon le front door
- connexions Postgres:
  - objectif réel de connexions serveur: faible dizaines, pas 500

### Recommandations

- utiliser PgBouncer devant toutes les connexions Prisma
- éviter les transactions longues
- éviter les `prepared statements` si le mode et la version du driver créent des effets secondaires; valider avec Prisma

## Read replica strategy

### Répartition

- primaire:
  - écritures, authentification, mutations métier
- réplicas lecture:
  - dashboards
  - recherche
  - listes paginées
  - reporting

### Règle pratique

- toutes les requêtes `count`, `groupBy`, recherche globale et écrans de consultation doivent aller sur lecture si la cohérence immédiate n’est pas critique
- les actions post-écriture sensibles restent sur primaire

### Nombre de réplicas

- départ:
  - 1 réplica lecture
- cible:
  - 2 à 3 réplicas selon la part de lecture

## Archiving strategy

### Flux

- job quotidien ou horaire
- déplacer:
  - leads `archivedAt IS NOT NULL` et plus anciens qu’un seuil
  - notifications lues et anciennes
  - contact requests closes anciennes
- stocker dans des tables d’archive partitionnées

### Règles

- archive immuable
- pas de jointure lourde au runtime applicatif
- purge après SLA de rétention

## Backup strategy

### Minimum

- sauvegarde physique quotidienne
- WAL archiving continu
- point-in-time recovery activé

### RPO / RTO suggérés

- RPO:
  - 5 à 15 minutes
- RTO:
  - 1 à 4 heures selon taille

### Contrôles obligatoires

- test de restauration hebdomadaire
- test de restauration point-in-time mensuel
- vérification des backups chiffrés hors site

## Plan d’exécution recommandé

1. Déployer PgBouncer.
2. Déployer les index supplémentaires.
3. Ajouter les index partiels et trigram.
4. Mettre en place le job d’archivage.
5. Distinguer les requêtes lecture/écriture.
6. Ajouter un réplica lecture.
7. Mesurer avec `EXPLAIN ANALYZE` et `pg_stat_statements`.

