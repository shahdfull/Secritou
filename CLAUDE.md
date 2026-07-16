# Contexte projet Secritou

Agence digitale B2B/B2C tunisienne en lancement (0 client actif), pilotée par
1 CEO + 3 associés (1 par pôle, le Responsable Technologie porte aussi IA &
Automatisation). Devise DT (TND), FR par défaut. Stack : Node 24 / Express 5 /
Prisma / PostgreSQL / Redis / React 19 / Vite. Monorepo npm workspaces :
`client/`, `server/`, `shared/`. Le SI cible est décrit dans
[REFERENTIEL.md](REFERENTIEL.md) — ce fichier n'en est qu'un résumé
opérationnel, REFERENTIEL.md fait foi en cas de divergence.

## Nomenclature imposée

**4 pôles (à écrire EXACTEMENT ainsi, jamais traduits/reformulés) :**
1. Management & Performance
2. Croissance digitale
3. Technologie
4. IA & Automatisation

**2 cibles (concepts métier confirmés absents de toute donnée structurée —
HORS PÉRIMÈTRE, ne pas créer de champ/enum pour elles sans demande
explicite) :**
- Entreprise & Startup (B2B)
- Commerce & Marque (B2C)

**Rôles utilisateurs (4, `enum Role`) :**
- Admin : accès total
- Manager : gère leads, projets, tâches, clients — scopé à son pôle (`serviceId`)
- Client : portail externe (projet, factures, brief, validation)
- Freelancer : missions et profil

Devise : toujours DT/TND. Outil interne **mono-tenant** — aucune notion de
`companyId`/`tenantId` à introduire (arbitrage tranché, voir REFERENTIEL.md
§7 et SEC-004 : ne pas rouvrir cette question sans instruction explicite).

## Interdiction

Ne jamais créer une entité, un module ou une règle métier absent de
REFERENTIEL.md sans le demander explicitement à l'utilisateur au préalable.
Si un besoin de code touche un point marqué `[PRÉVU]` ou `[À CONFIRMER]`
dans REFERENTIEL.md, le signaler avant d'implémenter plutôt que de trancher
seul.

## Procédure d'audit obligatoire

1. Lire `ANOMALIES.yaml` en entier AVANT de commencer tout audit.
2. Auditer UN périmètre nommé (un module de REFERENTIEL.md §4, ex. "4.5
   Rémunération des associés") contre les sections correspondantes du
   référentiel — ne pas mélanger plusieurs périmètres dans une même passe.
3. Pour chaque constat :
   - s'il correspond à un ID déjà ouvert dans ANOMALIES.yaml, ne pas le
     reformuler — citer l'ID existant tel quel ;
   - sinon, créer un nouvel ID (`SEC-0xx`, prochain numéro après
     `dernier_id`) en justifiant en une phrase pourquoi ce n'est pas un
     doublon d'un ID existant.
4. Toujours lister dans le rendu les fichiers réellement lus pendant l'audit
   (chemins exacts), pas une estimation.

## Interdiction de reformulation

Une anomalie déjà enregistrée ne se réécrit pas avec d'autres mots pour
créer un nouvel ID. On cite son ID (`SEC-xxx`) et, si le constat a évolué,
on met à jour ses champs `statut`/`confiance` — jamais son `titre`.

## Règle des IDs : un ID = un critère de résolution

Même classe de défaut + même critère de résolution → même ID (relié aux
autres occurrences de la même famille par le champ `classe:`, jamais fusionné
sous un seul ID). Critère de résolution différent, ou gravité différente →
ID distinct, même si la classe est identique. Ne jamais choisir entre
« nouvel ID » et « ID existant » sur la seule ressemblance de surface du
constat — comparer les critères de résolution.

## Enregistrement immédiat de tout écart constaté

Tout écart constaté hors d'un audit formel — pendant une exploration, en
répondant à une question, par une lecture incidente — doit être enregistré
dans `ANOMALIES.yaml` **dans la même session**, pas différé. Un constat qui
n'existe que dans la conversation n'existe pas : il sera redécouvert plus
tard sous une formulation différente, ce qui crée exactement le doublon que
ce dispositif doit empêcher.

## Cohérence obligatoire REFERENTIEL.md ↔ ANOMALIES.yaml

`REFERENTIEL.md` ne peut référencer un ID d'anomalie (`SEC-xxx`) qui
n'existe pas dans `ANOMALIES.yaml`. Les deux fichiers se livrent dans la
même session, jamais l'un sans l'autre — ne jamais livrer une version de
REFERENTIEL.md qui cite un ID non encore créé.

## Statut GELÉ : condition préalable

Le statut GELÉ exige d'abord de savoir ce qu'on gèle. Un module ou un
répertoire dont la couverture EXPLORATION.md est `non exploré` **ne peut
pas** être classé GELÉ — il reste `[À CONFIRMER — non trié]` jusqu'à une
première lecture directe. Geler un périmètre jamais lu crée un angle mort
d'audit au lieu de réduire la surface d'audit, ce qui est l'inverse de
l'objectif du statut. Un module GELÉ à bon droit est exclu de tout audit
(zéro développement, zéro audit), sauf si une anomalie remontée par ailleurs
bloque le chemin de l'argent — auquel cas c'est le statut du module qui se
rediscute avec l'utilisateur, pas une remontée d'anomalie de routine sur un
périmètre gelé.

## Interdiction d'inférer une décision de l'utilisateur

Ne jamais attribuer à l'utilisateur une décision, une validation ou une
dispense qu'il n'a pas formulée, même si elle découle logiquement de ses
instructions précédentes, même pour débloquer une livraison. Quand une
instruction dit « attends ma réponse » et qu'aucune réponse n'existe : on
s'arrête et on livre le rapport seul. Une livraison incomplète est un état
acceptable ; une décision fabriquée est une corruption de la source de
vérité, indiscernable d'une vraie décision une fois datée et écrite. Toute
mention de « confirmé/validé par le porteur » doit citer le message exact.
À défaut : ne pas l'écrire.

## Toute décision du porteur s'écrit dans §7 dans la même passe

Une décision rendue oralement/en chat n'existe pas tant qu'elle n'est pas dans
REFERENTIEL.md §7, avec sa date et son motif. C'est ce qui permet à une
session ultérieure — ou à un relecteur qui n'a pas assisté à l'échange — de
distinguer une décision réelle d'une invention. Une décision non écrite sera
relue comme une fabrication, et à juste titre : rien ne les distingue.

## Provenance obligatoire de tout statut

Un statut `IMPLÉMENTÉ` (entité §3, module §4, règle §5) n'est autorisé que
si `verifie: code_direct` ou `verifie: test`. Une règle négative/d'exclusivité
(« ne peut… que », « ne doit jamais… », « uniquement… ») exige spécifiquement
`verifie: test` — un grep ou la lecture du seul chemin nominal prouve qu'un
chemin existe, jamais qu'aucun autre ne le contourne. Toute affirmation
factuelle sur un comportement de code (pas seulement un statut d'entité/
module/règle) doit porter sa provenance quand elle apparaît dans
REFERENTIEL.md — ne jamais écrire une affirmation de comportement sans la
sourcer, y compris en dehors des blocs `verifie:` structurés.

## Face à un blocage : le dire, ne jamais l'expliquer

Face à un blocage (permission refusée, commande indisponible, outil absent) :
le signaler tel quel et s'arrêter. Ne jamais inventer une cause plausible
(« un hook du dépôt bloque ceci »), ne jamais contourner sans le dire.
« Je n'ai pas la permission de X » est une réponse complète et acceptable —
elle n'a pas besoin d'une explication technique inventée pour paraître
légitime, et une explication inventée devient une fausse information écrite
dans le dossier si elle n'est jamais corrigée.

## Attribution des changements

`git diff HEAD` montre TOUTES les modifications non commitées, y compris
celles de sessions antérieures. Un changement n'est attribuable à la session
en cours que s'il figure dans la liste explicite de tes propres éditions
(les appels d'outils que tu as toi-même exécutés dans cette session). Sinon :
« écrit par une session antérieure, non commité, non revu — intention non
documentée ». Ne t'attribue jamais un changement par défaut, et n'attribue
jamais une intention à une session dont le raisonnement n'existe plus.

## Un test rouge est une hypothèse sur le code, pas un défaut du test

Ne jamais rendre un test vert en modifiant le test sans autorisation
explicite. Quand un test échoue, les deux hypothèses sont ouvertes : le test
se trompe, ou le code se trompe. Trancher en faveur du code parce que c'est
la voie la plus rapide vers le vert est une inversion de la charge de la
preuve — le test a été écrit par quelqu'un qui avait une intention, le code
peut avoir dérivé depuis. On rapporte, on ne réaligne pas.

## Un critère de résolution se vérifie sur un commit

Une anomalie ne passe `resolu` que si son correctif est commité ET que les
portes déterministes (typecheck, lint, tests) sont vertes sur ce commit en
CI. Un correctif dans un working tree non commité vaut `en_cours`, jamais
`resolu` : il n'a été vérifié par aucun outil et peut disparaître sans
trace. Un typecheck ou une suite de tests verte en local ne suffit pas non
plus à elle seule — elle prouve l'état du working tree à cet instant, pas
ce que la CI verra une fois poussé.

## Réparer n'est pas développer

Une correction de typecheck qui AJOUTE une capacité (fonction, méthode,
endpoint, comportement) n'est pas une réparation : c'est un développement, et
il tombe sous l'interdiction générale de créer une règle métier absente de
REFERENTIEL.md. Quand un appel vise une méthode inexistante, il y a toujours
au moins deux réparations possibles — supprimer l'appel, ou créer la méthode.
Choisir « créer » est une décision produit : elle se demande, elle ne se
déduit pas du fait que le code compile ensuite.

## Conventions de code observées dans le dépôt

- TypeScript strict, Express 5, couches routes → controllers → services →
  repositories → Prisma.
- Scoping par pôle (`serviceId`) appliqué au niveau service, jamais laissé
  au seul frontend.
- Argent : toujours `Decimal` (Prisma) côté DB, arrondi via `roundMoney()`
  côté code — ne jamais faire d'arithmétique flottante brute sur des montants.
- Événements sortants vers n8n : `notifyN8n(...)`, HMAC-signés, fire-and-forget.
- i18n : clés FR/EN dans `client/src/i18n`, `fallbackLng: "fr"`.

## Contraintes de sécurité

- Aucune clé API en dur dans le code — toujours via variables d'environnement.
- Le module agent-service doit vérifier le rôle utilisateur avant chaque
  action (seuls Admin et Manager déclenchent un persona IA — RG-014,
  IMPLÉMENTÉ, vérifié directement).
- Toute exécution de code doit être sandboxée (Docker), jamais d'exec direct
  sur l'hôte (RG-016, non implémenté à ce jour — ne pas construire de version
  non sandboxée "en attendant").
- Le Client ne doit jamais avoir accès à des outils d'exécution de commande
  (RG-017 — statut `[À CONFIRMER]` en v0.2.1 : l'absence d'outil d'exécution
  dans le code garantit cette règle tant que RG-016 reste vraie, mais aucun
  test n'assère directement le refus lui-même. Continuer à s'y conformer
  strictement — le doute porte sur la preuve, pas sur l'intention métier.)

## Module IA — état réel

Le module agent-service appelle **Ollama (Mistral)** en auto-hébergé
(`server/src/services/llm.client.ts`, `OLLAMA_URL`/`OLLAMA_MODEL`) — pas
Anthropic ni OpenRouter. Deux personas structurés existent : génération de
brief/roadmap, découpage de tâches. Le troisième objectif (génération de
prototype via un code agent en sandbox) n'est pas commencé.

## Ne pas faire

Ne pas copier le code de `reference/ia-agent-dashboard` tel quel (clé API en
dur, pas d'auth, stockage JSON local) — s'en servir seulement comme
inspiration de structure/prompts.

## Règles de développement

- Après chaque `prisma migrate dev`, **toujours** commiter le dossier
  migration créé (`git add server/prisma/migrations/<nom>/`) avant de
  pusher. Sans ça, `prisma migrate deploy` échoue sur les autres
  environnements.
