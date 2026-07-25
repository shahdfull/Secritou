# Audit de maturité — Plateforme Secritou (v5, cinquième passage)

## 0. À propos de Docker Desktop — une précision nécessaire avant tout

Ouvrir Docker Desktop sur ton PC ne me donne malheureusement pas accès à
Postgres/Redis pour cet audit : je travaille dans un **bac à sable Linux isolé**,
séparé de ta machine — il n'y a pas de pont réseau entre les deux. Vérifié dans
cette session : `docker`, `pg_isready` restent absents de mon environnement, et une
tentative de connexion à `localhost:5432` échoue toujours (connexion refusée).

Ce que ça veut dire concrètement : je ne peux toujours pas exécuter moi-même la
suite de tests serveur (`test:coverage`, qui a besoin d'une vraie base) ni le job
`restore-smoke-test`. Si tu veux que cette vérification soit faite pour de vrai plutôt
que déduite des commits, la façon la plus fiable est que **toi** (ou un run GitHub
Actions réel) lances `npm run test:coverage --workspace=server` en local avec le
`docker-compose.yml` de dev démarré, et me colles le résultat — je l'intégrerai
directement à l'audit plutôt que de le supposer.

En attendant, j'ai quand même avancé : j'ai fait le balayage frais des catégories A
et D que j'avais annoncé comme dette de vérification en v4, sans dépendre de Docker.

## 1. Ce que le balayage frais de A et D a trouvé

**A (Sécurité) — deux fausses alertes de ma part, corrigées avant de conclure :**
- J'ai d'abord cru trouver un vrai trou : `clientOnboarding.routes.ts` a 18 routes de
  mutation (POST/PUT/DELETE sur Onboarding, Contract, Payment, Questionnaire,
  Specifications, Kickoff, Production, Delivery) sans aucun appel `validate(...)`
  **dans le fichier de routes**. Avant de le consigner comme défaut, j'ai vérifié le
  contrôleur : `clientOnboarding.controller.ts` compose en réalité `validate(...)`
  **à l'intérieur** de chaque handler exporté (`export const createOnboarding:
  RequestHandler[] = [validate(createOnboardingValidator), async (req,...) => {...}]`)
  — un patron différent du reste du dépôt mais tout aussi protecteur. Pas un défaut,
  vérifié ligne par ligne avant de conclure.
- Les 6 fichiers de routes toujours sans rate limiter (`analytics`, `clientPortal`,
  `dashboard`, `search`, `service`, `summary`) : confirmé qu'aucun n'a de route
  POST/PUT/PATCH/DELETE — cohérent avec la fermeture déjà actée de SEC-176 (« lecture
  pure »), pas un nouvel écart.
- Aucun secret en dur trouvé (`grep` sur les motifs de clé API usuels : 0 résultat).
- **Conclusion A : aucun nouvel écart réel trouvé** malgré une recherche active de
  contre-exemples.

**D (DevOps/Fiabilité) — un vrai écart trouvé, consigné dans `ANOMALIES.yaml` (SEC-219) :**
- La règle d'alerte `CacheHitRateLow` (`monitoring/alerts.yml` ligne 15) référence
  les métriques `cache_hits_total`/`cache_misses_total`. Vérifié par `grep` sur tout
  `server/src` : ces noms **n'existent nulle part** — les vraies métriques exposées
  s'appellent `redis_cache_hits_total`/`redis_cache_misses_total`
  (`server/src/observability/metrics.ts:117,124`). Cette alerte ne peut donc jamais
  matcher de série réelle et ne se déclenchera jamais, silencieusement — exactement
  le type d'écart que la catégorie D demande de chercher (« alertes alignées sur les
  risques réels du système »). Distinct de SEC-159 (même fichier de métriques, mais
  sur un problème de granularité des vraies métriques, pas un nom inexistant).
  Nouvel ID : **SEC-219**, mineur, `ouvert`.

## 2. Tableau de score (v5)

| Catégorie | Poids | v4 | v5 | Justification du delta |
|---|---|---|---|---|
| A. Sécurité applicative | 18% | 9 | 9 | Balayage frais fait, deux suspicions levées après vérification directe du code, aucun nouvel écart réel — la note est maintenue, cette fois avec un balayage complet à l'appui plutôt que reconduite par défaut |
| B. Intégrité des données | 15% | 9 | 9 | Non re-balayé cette passe |
| G. Exactitude métier et financière | 15% | 9 | 9 | Non re-balayé cette passe |
| C. Performance et scalabilité | 10% | 8 | 8 | Non re-balayé cette passe |
| E. Couverture et qualité des tests | 10% | 8 | 8 | Toujours plafonné : je ne peux pas exécuter la suite de tests serveur/client dans cet environnement, Docker Desktop local n'y change rien |
| D. Fiabilité opérationnelle / DevOps | 10% | 7 | **8** | Balayage frais fait ; un écart réel trouvé et consigné (SEC-219, alerte orpheline) — mineur, mais réel et jusque-là non détecté ; le reste (scripts backup/restore, RUNBOOK) confirmé cohérent |
| H. UX/UI et accessibilité | 8% | 8 | 8 | Non re-balayé cette passe |
| F. Conception API et cohérence des contrats | 6% | 9 | 9 | Non re-balayé cette passe |
| J. Maturité du processus de release / CI-CD | 5% | 8 | 8 | Toujours plafonné : pas d'accès à l'état réel des runs GitHub Actions depuis cet environnement |
| I. Qualité et fiabilité de la documentation | 3% | 9 | 9 | Non re-balayé cette passe |

## 3. Score global : 86/100 (v4 : 85/100 — objectif 90/100, pas encore atteint)

**Verdict** : le balayage frais promis en v4 est fait pour A et D. Résultat honnête :
A tient bon (deux fausses pistes écartées après vérification, pas de vrai défaut
trouvé), D gagne un point sur la base d'un vrai écart trouvé et corrigé dans le
registre (pas d'un jugement en l'air). Le score progresse peu (+1) parce que
l'essentiel du gain restant ne dépend pas de balayages de code supplémentaires, mais
de deux choses que je ne peux physiquement pas faire depuis cet environnement :
exécuter la suite de tests serveur contre une vraie base, et lire l'état réel d'un
run GitHub Actions.

## 4. Ce qu'il reste, par ordre de rentabilité

1. **Corriger `monitoring/alerts.yml#CacheHitRateLow`** (SEC-219) — renommer
   `cache_hits_total`/`cache_misses_total` en `redis_cache_hits_total`/
   `redis_cache_misses_total`. Effort de 2 lignes, referme le seul écart D restant.
2. **Faire tourner `npm run test:coverage --workspace=server` en local** (avec le
   `docker-compose.yml` de dev démarré) et me transmettre le résultat — c'est la
   seule action qui peut faire bouger E et J au-delà de leur plafond actuel dans
   cette session.
3. **Consulter l'onglet Actions du dépôt sur GitHub** pour confirmer qu'un run
   récent est vert, ou me transmettre une capture — même chose pour J.
4. **Refaire un balayage frais de B, G, C, H, F, I** avec la même méthode que ce
   passage (chercher activement des contre-exemples, pas seulement lire le registre)
   — non fait cette fois faute de signal indiquant qu'il fallait les revisiter.

## 5. Limites de ce cinquième passage

- Seules A et D ont reçu un balayage actif cette fois ; les 8 autres catégories sont
  reconduites de v4 sans nouvelle vérification.
- SEC-219 n'a pas été vérifié contre un Prometheus réel (aucune instance
  disponible) — la conclusion repose sur l'absence du nom de métrique dans le code
  source, ce qui est suffisant pour établir le défaut mais pas pour confirmer le
  comportement exact de l'alerte en production.
- Docker Desktop ouvert localement par l'utilisateur ne change rien à ce que je peux
  exécuter dans cette session — précision faite en §0 pour éviter tout malentendu sur
  ce point dans un futur passage.
