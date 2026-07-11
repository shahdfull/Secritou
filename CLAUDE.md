# Contexte projet Secritou

Secritou est un outil de gestion opérationnelle pour une agence de services 
(pas multi-tenant, une seule agence). Stack : [ta stack réelle ici — 
ex: Node/Express + PostgreSQL + React, ou Django, etc.]

## Rôles utilisateurs
- Admin : accès total
- Manager : gère leads, projets, tâches, clients
- Client : portail externe (projet, factures, brief, validation)
- Freelancer : missions et profil

## Objectif actuel
Ajouter un module "agent-service" qui utilise des personas IA (via l'API 
Anthropic/OpenRouter) pour automatiser :
1. Génération de brief/roadmap à partir des réponses client
2. Suggestion de découpage de tâches sur un projet
3. (plus tard) génération de prototype via un code agent en sandbox

## Contraintes de sécurité
- Aucune clé API en dur dans le code — toujours via variables d'environnement
- Le module agent-service doit vérifier le rôle utilisateur avant chaque action
- Toute exécution de code doit être sandboxée (Docker), jamais d'exec direct sur l'hôte
- Le Client ne doit jamais avoir accès à des outils d'exécution de commande

## Ne pas faire
- Ne pas copier le code de reference/ia-agent-dashboard tel quel (clé API en 
dur, pas d'auth, stockage JSON local) — s'en servir seulement comme inspiration 
de structure/prompts

## Règles de développement
- Après chaque `prisma migrate dev`, **toujours** commiter le dossier migration
  créé (`git add server/prisma/migrations/<nom>/`) avant de pusher. Sans ça,
  `prisma migrate deploy` échoue sur les autres environnements.
- Stack : Node 24 / Express 5 / Prisma / PostgreSQL / Redis / React 19 / Vite
- Monorepo npm workspaces : `client/`, `server/`, `shared/`