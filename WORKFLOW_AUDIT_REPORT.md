# Audit Workflows Business Logic — Secritou

Date: 2026-07-08

---

## Executive Summary

Les workflows métiers clés de Secritou sont bien implémentés avec des transitions de statut contrôlées, mais les principales lacunes identifiées sont :
1. **Conversion Lead → Client**: Nécessite une action manuelle après acceptation de proposition.
2. **Commission Payout**: Aucune étape de paiement (uniquement calculée/marquée comme payée).
3. **Client Success**: Entièrement manuel (aucune intégration avec projets/factures pour mise à jour automatique des métriques).
4. **Rating**: Implémenté backend mais absent du frontend.
5. **Capacity Check**: Aucune vérification de disponibilité des freelancers avant affectation.

---

## 1. Tables de Transition d'États par Entité

### 1.1 Lead
| Statut Initial → | Statut Suivant | Déclencheur | Qui ? | Type | Écran |
|-------------------|----------------|-------------|-------|------|-------|
| NEW →             | CONTACTED      | Mise à jour manuelle | ADMIN/MANAGER | Manuel | [LeadsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/LeadsPage.tsx), [LeadsKanban.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/LeadsKanban.tsx) |
| NEW/CONTACTED →   | QUALIFIED      | Mise à jour manuelle | ADMIN/MANAGER | Manuel | [LeadsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/LeadsPage.tsx), [LeadsKanban.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/LeadsKanban.tsx) |
| QUALIFIED →       | PROPOSAL       | Création d'une proposition liée au lead | ADMIN/MANAGER | Manuel | [CreateProposalFromLeadDialog.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/CreateProposalFromLeadDialog.tsx) |
| PROPOSAL →        | WON            | Acceptation de la proposition (via `acceptWithCascade`) | Système | Auto | — |
| NEW/CONTACTED/QUALIFIED/PROPOSAL → | LOST | Mise à jour manuelle | ADMIN/MANAGER | Manuel | [LeadsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/LeadsPage.tsx), [LeadsKanban.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/LeadsKanban.tsx) |
| WON →             | (Converti en Client) | Clic sur "Convert to Client" | ADMIN/MANAGER | Manuel | [LeadDetailDialog.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/leads/LeadDetailDialog.tsx) |

**Code**: [lead.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/lead.service.ts#L84-L146)

---

### 1.2 Proposal
| Statut Initial → | Statut Suivant | Déclencheur | Qui ? | Type | Écran |
|-------------------|----------------|-------------|-------|------|-------|
| DRAFT →           | SENT           | Clic sur "Send" | ADMIN/MANAGER | Manuel | [ProposalsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/proposals/ProposalsPage.tsx), [CommercialPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/commercial/CommercialPage.tsx) |
| SENT →            | VIEWED         | Client consulte la proposition | Client | Manuel | [ProposalsClientPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/client-portal/ProposalsClientPage.tsx) |
| SENT/VIEWED →     | ACCEPTED       | Clic sur "Accept" (avec cascade) | Client | Manuel | [ProposalsClientPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/client-portal/ProposalsClientPage.tsx) |
| SENT/VIEWED →     | REJECTED       | Clic sur "Reject" | Client | Manuel | [ProposalsClientPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/client-portal/ProposalsClientPage.tsx) |
| SENT/VIEWED →     | EXPIRED        | Date d'expiration dépassée (tâche planifiée) | Système | Auto | — |
| SENT/VIEWED →     | DRAFT          | Modification du contenu/section | ADMIN/MANAGER | Manuel | [ProposalsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/proposals/ProposalsPage.tsx) |

**Code**: [proposal.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/proposal.service.ts)
**Job Auto**: [maintenance.processor.ts:expireProposals](file:///c:/Users/shahd/Documents/SaaS/server/src/jobs/processors/maintenance.processor.ts#L133-L178)

---

### 1.3 Project
| Statut Initial → | Statut Suivant | Déclencheur | Qui ? | Type | Écran |
|-------------------|----------------|-------------|-------|------|-------|
| PLANNING →        | IN_PROGRESS    | Mise à jour manuelle | ADMIN/MANAGER | Manuel | [ProjectsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectsPage.tsx), [ProjectDetailPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectDetailPage.tsx) |
| IN_PROGRESS →     | PLANNING       | Mise à jour manuelle | ADMIN/MANAGER | Manuel | [ProjectsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectsPage.tsx), [ProjectDetailPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectDetailPage.tsx) |
| IN_PROGRESS →     | REVIEW         | Mise à jour manuelle | ADMIN/MANAGER | Manuel | [ProjectsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectsPage.tsx), [ProjectDetailPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectDetailPage.tsx) |
| REVIEW →          | IN_PROGRESS    | Mise à jour manuelle | ADMIN/MANAGER | Manuel | [ProjectsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectsPage.tsx), [ProjectDetailPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectDetailPage.tsx) |
| REVIEW →          | COMPLETED      | Clic sur "Approve" (vérifie tâches terminées + acompte payé) | Client | Manuel | [ProjectsClientPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/client-portal/ProjectsClientPage.tsx), [ProjectDetailPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/projects/ProjectDetailPage.tsx) |

**Code**: [project.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/project.service.ts#L66-L106), [project.service.ts:clientApprove](file:///c:/Users/shahd/Documents/SaaS/server/src/services/project.service.ts#L194-L302)

---

### 1.4 Task
| Statut Initial → | Statut Suivant | Déclencheur | Qui ? | Type | Écran |
|-------------------|----------------|-------------|-------|------|-------|
| TODO →            | IN_PROGRESS    | Mise à jour manuelle (Kanban ou liste) | ADMIN/MANAGER/FREELANCER | Manuel | [TasksPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/TasksPage.tsx), [TasksKanban.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/TasksKanban.tsx), [TasksListView.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/components/TasksListView.tsx) |
| TODO/IN_PROGRESS →| REVIEW         | Mise à jour manuelle | ADMIN/MANAGER/FREELANCER | Manuel | [TasksPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/TasksPage.tsx), [TasksKanban.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/TasksKanban.tsx), [TasksListView.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/components/TasksListView.tsx) |
| TODO/IN_PROGRESS/REVIEW → | DONE | Mise à jour manuelle | ADMIN/MANAGER/FREELANCER | Manuel | [TasksPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/TasksPage.tsx), [TasksKanban.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/TasksKanban.tsx), [TasksListView.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/tasks/components/TasksListView.tsx) |

**Code**: Recherche dans le repo (Pas de service dédié, mise à jour directe via Prisma dans le contrôleur)

---

### 1.5 Invoice
| Statut Initial → | Statut Suivant | Déclencheur | Qui ? | Type | Écran |
|-------------------|----------------|-------------|-------|------|-------|
| DRAFT →           | SENT           | Clic sur "Send" | ADMIN/MANAGER | Manuel | [InvoicesPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/invoices/InvoicesPage.tsx) |
| SENT →            | PARTIAL        | Ajout d'un paiement partiel | ADMIN/MANAGER | Manuel | [AddPaymentDialog.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/invoices/components/AddPaymentDialog.tsx) |
| SENT/PARTIAL →    | PAID           | Ajout d'un paiement totalisant le montant | ADMIN/MANAGER | Manuel | [AddPaymentDialog.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/invoices/components/AddPaymentDialog.tsx) |
| SENT/PARTIAL →    | OVERDUE        | Date d'échéance dépassée (tâche planifiée) | Système | Auto | — |
| DRAFT/SENT/PARTIAL/OVERDUE → | CANCELLED | Clic sur "Cancel" | ADMIN/MANAGER | Manuel | [InvoicesPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/invoices/InvoicesPage.tsx) |

**Code**: [invoice.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/invoice.service.ts)
**Job Auto**: [maintenance.processor.ts:markOverdueInvoices](file:///c:/Users/shahd/Documents/SaaS/server/src/jobs/processors/maintenance.processor.ts#L185-L242)

---

### 1.6 Commission
| Statut Initial → | Statut Suivant | Déclencheur | Qui ? | Type | Écran |
|-------------------|----------------|-------------|-------|------|-------|
| (Créé) →          | PENDING        | Création automatique lors d'un paiement reçu | Système | Auto | — |
| PENDING →         | PAID           | Clic sur "Mark as Paid" | ADMIN/MANAGER | Manuel | [CommissionsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/commissions/CommissionsPage.tsx) |

**Code**: [commission.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/commission.service.ts)

---

### 1.7 FreelancerApplication
| Statut Initial → | Statut Suivant | Déclencheur | Qui ? | Type | Écran |
|-------------------|----------------|-------------|-------|------|-------|
| PENDING →         | ACCEPTED       | Clic sur "Accept" (crée User + FreelancerProfile) | ADMIN/MANAGER | Manuel | [ApplicationsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/applications/ApplicationsPage.tsx), [SettingsJoinRequestsTab.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/settings/tabs/SettingsJoinRequestsTab.tsx) |
| PENDING →         | REJECTED       | Clic sur "Reject" (besoin d'un motif ≥10 caractères) | ADMIN/MANAGER | Manuel | [ApplicationsPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/applications/ApplicationsPage.tsx), [SettingsJoinRequestsTab.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/settings/tabs/SettingsJoinRequestsTab.tsx) |

**Code**: [freelancerApplication.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/freelancerApplication.service.ts)

---

## 2. Gaps Identifiés

| Gap | Evidence | Business Impact | Effort Estimé |
|-----|----------|-----------------|---------------|
| Conversion Lead → Client non automatique | [lead.service.ts#L84-L146](file:///c:/Users/shahd/Documents/SaaS/server/src/services/lead.service.ts#L84-L146) (besoin de clic manuel après acceptation de proposition) | Risque d'oubli, ralentit le flux | Low (ajouter dans `acceptWithCascade` la conversion auto) |
| Rating frontend manquant | [FreelancerDetailPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/freelancers/FreelancerDetailPage.tsx) (pas de UI pour ajouter/voir des notes) | Données non utilisées, pas de feedback | Medium |
| Vérification capacité freelancer absente | Recherche dans le repo (aucun code vérifiant les affectations superposées) | Risque de surréservation | Medium |
| Projet ne peut pas être complété si approbation ouverte | [project.service.ts:clientApprove](file:///c:/Users/shahd/Documents/SaaS/server/src/services/project.service.ts#L194-L302) (ne vérifie pas les approbations) | Risque de payer avant validation | Low |
| Paiement commission (pas d'intégration bancaire) | [commission.service.ts:markPaid](file:///c:/Users/shahd/Documents/SaaS/server/src/services/commission.service.ts#L86-L91) (juste un flag) | Processus manuel, erreur possible | High (dépend de l'intégration bancaire) |
| Client Success metrics 100% manuelles | [clientSuccess.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/clientSuccess.service.ts) (aucun calcul auto depuis projets/factures) | Données obsolètes, pas de valeur ajoutée | Medium |
| Aucun workflow Contract → Project | [schema.prisma](file:///c:/Users/shahd/Documents/SaaS/server/prisma/schema.prisma#L73-L78) (Contract existe mais pas utilisé) | Modèle inutilisé | Low (supprimer ou intégrer) |
| Rating pas lié à Project/Task completion | [rating.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/rating.service.ts) (aucun trigger automatique) | Pas de contexte pour les notes | Medium |

---

## 3. Données Mortes/Non Utilisées

| Modèle/Champ | Evidence | Statut |
|--------------|----------|--------|
| Contract | [schema.prisma#L73-L78](file:///c:/Users/shahd/Documents/SaaS/server/prisma/schema.prisma#L73-L78), recherche dans le repo (aucun service/utilisation) | Jamais utilisé |
| Rating (frontend) | [FreelancerDetailPage.tsx](file:///c:/Users/shahd/Documents/SaaS/client/src/features/freelancers/FreelancerDetailPage.tsx) (pas de UI) | Backend OK, frontend manquant |
| Approval (besoin de confirmer le workflow) | Recherche dans le repo ([approval.service.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/services/approval.service.ts) existe mais vérifier ce qu'il valide) | Besoin de vérification |
| InvoiceReminder (créé manuellement, pas de workflow planifié) | [invoice.service.ts:addReminder](file:///c:/Users/shahd/Documents/SaaS/server/src/services/invoice.service.ts#L246-L263) | Utilisé mais pas automatisé |

---

## 4. Fonctionnalités Business Logic à Ajouter

| Fonctionnalité | Pourquoi Important | Effort |
|----------------|--------------------|--------|
| Auto-conversion Lead → Client lors de l'acceptation de proposition | Évite les oublis, accélère le flux | Low |
| Vérification de disponibilité avant affectation de freelancer | Évite les conflits | Medium |
| Intégration bancaire pour paiement des commissions | Automatise le processus, réduit les erreurs | High |
| Calcul automatique des Client Success metrics | Données toujours à jour, valeur ajoutée | Medium |
| UI pour Rating | Utiliser les données existantes | Medium |
| Workflow Contract → Project | Utiliser le modèle Contract | Low/Medium |
| Trigger Rating lors de la complétion de projet | Contexte pour les notes | Low |
| Vérification des approbations ouvertes avant complétion de projet | Garantit la validation | Low |
| Auto-rappels de facture (selon règles) | Réduit les retards de paiement | Medium |

---

## 5. Vérifications de Règles Métier

| Règle | Présente ? | Evidence |
|-------|------------|----------|
| Proposition modifiable après consultation ? | ✅ Oui (redevient DRAFT) | [proposal.service.ts#L202-L210](file:///c:/Users/shahd/Documents/SaaS/server/src/services/proposal.service.ts#L202-L210) |
| Facture modifiable/supprimable après envoi ? | ❌ Non (seulement cancel, pas de suppression) | [invoice.service.ts#L132-L139](file:///c:/Users/shahd/Documents/SaaS/server/src/services/invoice.service.ts#L132-L139) |
| Double réservation freelancer bloquée ? | ❌ Non | Aucun code trouvé |
| Projet complété avec tâches ouvertes ? | ❌ Non (bloqué) | [project.service.ts#L204-L207](file:///c:/Users/shahd/Documents/SaaS/server/src/services/project.service.ts#L204-L207) |
| Facturation récurrente ? | ❌ Non | Aucun code trouvé |
| Multi-devises avec conversion ? | ❌ Non (seulement stockage de devise) | Aucun code trouvé |

---

## 6. Jobs Planifiés (Transitions Automatiques)

| Job | Fréquence | Action |
|-----|-----------|--------|
| `expireProposals` | Toutes les heures | Passe les propositions SENT/VIEWED expirées à EXPIRED |
| `markOverdueInvoices` | Quotidien (4h15) | Passe les factures SENT/PARTIAL échuës à OVERDUE |
| `recalculateClientScores` | Quotidien (2h) | Recalcule les scores Client Success (mais manuels) |

**Code**: [jobs/index.ts](file:///c:/Users/shahd/Documents/SaaS/server/src/jobs/index.ts)
