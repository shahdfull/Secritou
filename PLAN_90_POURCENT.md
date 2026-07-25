# Feuille de route — 72/100 → 90/100 (en dev, sans déploiement)

Base : audit v2 (72/100). Toutes les tâches ci-dessous sont réalisables en local/dev
(Docker Compose dev, CI GitHub Actions en tant que pipeline de vérification) — **aucune
ne nécessite de déployer sur un environnement de production**. La CI elle-même ne
déploie rien : elle lint/typecheck/teste sur un runner GitHub, c'est un outil de
vérification, pas un déploiement.

Simulation du gain : si chaque catégorie atteint sa cible ci-dessous, le score passe de
72 à ~93/100 — marge de sécurité au-dessus de 90 pour absorber les tâches qui échouent
ou prennent du retard.

| Catégorie | Poids | Note actuelle | Cible | Gain visé |
|---|---|---|---|---|
| A. Sécurité applicative | 18% | 8/10 | 10/10 | +3.6 |
| B. Intégrité des données | 15% | 8/10 | 10/10 | +3.0 |
| G. Exactitude financière | 15% | 8/10 | 10/10 | +3.0 |
| E. Couverture de tests | 10% | 6/10 | 9/10 | +3.0 |
| C. Performance | 10% | 7/10 | 9/10 | +2.0 |
| H. UX/Accessibilité | 8% | 6/10 | 9/10 | +2.4 |
| D. DevOps/Fiabilité | 10% | 7/10 | 8/10 | +1.0 |
| F. Conception API | 6% | 7/10 | 9/10 | +1.2 |
| J. CI/CD | 5% | 5/10 | 8/10 | +1.5 |
| I. Documentation | 3% | 7/10 | 10/10 | +0.9 |

---

## Phase 0 — Hygiène de base (préalable, débloque tout)

Rien de ce qui suit ne compte comme « acquis » selon les propres règles du dépôt
(`CLAUDE.md`) tant que ce n'est pas commité et vert en CI. C'est la phase la plus
rentable : elle ne change aucune ligne de logique métier, mais sans elle, aucun gain
des phases suivantes n'est vérifiable ni durable.

- [ ] **Ajouter un `.gitattributes`** à la racine (`* text=auto eol=lf`) pour arrêter la
      dérive de fin de ligne LF→CRLF constatée sur ~674 fichiers.
- [ ] **Renormaliser l'historique** : `git add --renormalize .` puis vérifier par
      `git diff --stat` que le nombre de fichiers listés comme modifiés chute
      drastiquement (isole enfin les vrais changements de contenu du bruit CRLF).
- [ ] **Committer par lots atomiques**, chacun citant les SEC-ID concernés dans le
      message de commit (convention déjà utilisée dans l'historique du dépôt) :
  - [ ] lot 1 : `client/src/i18n/locales/fr/translation.json` (fix mojibake, SEC-190)
  - [ ] lot 2 : `server/src/repositories/lead.repository.ts` (select explicite, SEC-171)
  - [ ] lot 3 : `README.md` (retrait de la promesse Playwright, SEC-192)
  - [ ] lot 4 : `server/src/cache/authDenylist.ts` + call sites + test associé (SEC-174)
  - [ ] lot 5 : `server/test/permissionProfileDelete.test.ts` + fix service (SEC-114)
  - [ ] lot 6 : tout le reste, trié par périmètre plutôt qu'en un seul commit fourre-tout
- [ ] **Décommenter les déclencheurs `push`/`pull_request`** dans
      `.github/workflows/ci.yml` (lignes actuellement commentées, marquées
      « Disabled while in dev »). C'est un changement de config CI, pas un déploiement.
- [ ] **Pousser et obtenir un premier run CI vert** sur les jobs `client`, `server`,
      `restore-smoke-test`, `i18n-check`.
- [ ] **Mettre à jour `ANOMALIES.yaml`** : repasser SEC-010, SEC-171, SEC-174, SEC-192
      (et tout autre `en_cours` concerné) à `resolu` **seulement** une fois le commit
      correspondant vert en CI — pas avant, selon la propre règle du dépôt.
- [ ] Vérifier qu'aucun ID cité dans `REFERENTIEL.md` ne pointe vers un statut désormais
      incohérent après cette mise à jour groupée.

---

## A. Sécurité applicative (18% — 8 → 10)

- [ ] **SEC-174 (révocation JWT)** : écrire `server/test/authDenylist.test.ts` s'il
      n'existe pas — doit importer réellement `authDenylist` depuis `../src/cache/
      authDenylist.ts` (pas une réimplémentation) et vérifier concrètement qu'un token
      revoqué est refusé par `authenticate`.
- [ ] Vérifier/ajouter l'appel à `revokeAccessToken` dans `user.service.ts#deleteUser`
      et dans le chemin de rétrogradation de rôle (changement de `Role`) — le fix n'a
      de valeur que s'il est déclenché aux bons endroits.
- [ ] **7 fichiers de routes sans rate limiter** (`analytics`, `clientPortal`,
      `dashboard`, `search`, `service`, `summary.routes.ts`) : pour chacun, décider
      explicitement — ajouter `sensitiveWriteRateLimit` sur les routes d'écriture
      authentifiées, OU consigner dans `REFERENTIEL.md §7` une dérogation motivée
      (le critère de résolution de SEC-176 autorise les deux options, mais exige une
      décision écrite, pas un silence).
- [ ] **SEC-171** : ajouter un test qui appelle réellement `leadRepository.findAll` et
      vérifie l'absence de `notes` dans la réponse (le fix code existe, le test manque).
- [ ] Repasser la **checklist SEC-048** (scoping CLIENT/MANAGER/FREELANCER) sur toute
      route `Project`/`Task` touchée par les commits de la Phase 0.
- [ ] Revue rapide de `permissionProfileDelete.test.ts` en entier (pas seulement
      l'import) pour confirmer que l'assertion couvre bien le critère exact de SEC-114
      (blocage ou confirmation explicite listant les managers impactés).

## B. Intégrité des données et concurrence (15% — 8 → 10)

- [ ] Lire en entier `server/src/services/managerPermission.service.ts` (version
      actuelle) et confirmer que le comportement décrit par SEC-114 comme « résolu »
      correspond réellement au critère écrit — pas seulement à l'existence d'un test.
- [ ] Grep différentiel : lister toute mutation multi-étapes ajoutée depuis le dernier
      audit (`git log` sur `services/*.ts` depuis SEC-114) et vérifier qu'elle est bien
      dans un `$transaction` si elle touche plus d'une table à enjeu.
- [ ] Ajouter un test de concurrence pour tout nouveau point de contention introduit par
      les correctifs de Phase 0 (ex. si `authDenylist` introduit un chemin
      lecture-puis-écriture Redis, vérifier qu'il n'y a pas de fenêtre de course).
- [ ] Revérifier `SEC-134`/`SEC-136` (cascade proposition→projet, contrainte unique +
      retry) après les commits de Phase 0 pour confirmer qu'aucune régression n'a été
      introduite par la renormalisation de fin de ligne.

## G. Exactitude métier et financière (15% — 8 → 10)

- [ ] Revue exhaustive (pas un sondage) de tous les chemins de calcul financier :
      acompte/solde (`vat.ts`, `invoice.service.ts`), avoirs cumulés
      (`creditNote.service.ts`), commissions (`commission.service.ts`) — pour chacun,
      confirmer qu'un test appelle le code réel (pas une réimplémentation miroir).
- [ ] Vérifier la cohérence **affiché vs stocké** sur un cas réel en dev : générer une
      facture PDF (`documentGenerator.service.ts`) et comparer chaque montant affiché
      au `Invoice` correspondant en base.
- [ ] Documenter formellement dans `REFERENTIEL.md §5` toutes les règles financières
      avec leur `verifie: test`, pour qu'aucune ne reste dans la catégorie
      « affirmation non sourcée » interdite par `CLAUDE.md`.
- [ ] Vérifier la traçabilité `AuditLog` sur au moins un scénario complet
      (création facture → paiement → avoir) en relisant les entrées `before`/`after`
      générées en dev.

## E. Couverture et qualité des tests (10% — 6 → 9)

- [ ] **Relever les seuils de `client/vitest.config.js`** de 1% à une valeur réaliste
      pour l'état actuel (mesurer d'abord la couverture réelle avec
      `vitest run --coverage`, fixer le seuil légèrement en dessous pour ne pas casser
      la CI, puis remonter par paliers).
- [ ] Ajouter des tests client sur les parcours les plus critiques non couverts
      (cascade proposition → projet côté UI, portail client, brief).
- [ ] **Décision explicite Playwright/e2e** : soit l'installer et écrire 3-5 scénarios
      critiques (login, cascade proposition, approbation client), soit consigner
      formellement dans `REFERENTIEL.md` que l'e2e est hors périmètre pour l'instant —
      ne pas laisser la situation ambiguë comme avant la correction de SEC-192.
- [ ] Ajouter `--coverage` réel au job `client` de `ci.yml` (actuellement
      `npm run test --workspace=client` sans mesure de couverture).
- [ ] Vérifier l'équilibre de couverture entre modules serveur (le rapport `c8` donne
      le détail par fichier) — combler les modules les plus nus plutôt que d'empiler
      des tests sur les modules déjà bien couverts.

## C. Performance et scalabilité (10% — 7 → 9)

- [ ] **SEC-161** : borner `executiveMetricsRepository.getAll` — remplacer le fan-out
      non borné (`activeProjects`, `clientsWithProjects`) par une requête agrégée SQL
      ou une pagination, plutôt que de compter uniquement sur le cache 3 min.
- [ ] **SEC-162** : brancher `EntityTable`/`useVirtualTable` sur au moins les 3-4 pages
      de liste les plus lourdes (`DocumentsPage`, `InvoicesPage`, `LeadsPage`), ou
      supprimer le composant s'il est définitivement abandonné — trancher, ne pas
      laisser du code mort à côté de 14 réimplémentations.
- [ ] **SEC-091** : fusionner les 2 requêtes par carte projet du portail client
      (timeline + tâches terminées) en un seul appel, ou espacer le polling.
- [ ] Vérifier qu'aucune nouvelle requête de liste ajoutée depuis le dernier audit n'a
      de `select` manquant (même motif que SEC-171, à généraliser).

## H. UX/UI et accessibilité (8% — 6 → 9)

- [ ] Ajouter `aria-label` sur les composants transverses à fort réemploi (boutons
      d'action icône-seul, modals, table générique) plutôt que fichier par fichier —
      le gain se propage à toutes les pages qui les consomment.
- [ ] Étendre les motifs de navigation clavier (`role="button"`/`onKeyDown`/`tabIndex`)
      aux mêmes composants transverses.
- [ ] Généraliser `EmptyState`/`skeleton` aux fichiers `features/*.tsx` qui n'ont encore
      ni état de chargement ni état vide géré.
- [ ] Passer les couleurs du design system (tokens Tailwind/shadcn) dans un vérificateur
      de contraste WCOG AA — faisable en dev, aucune donnée de production requise.
- [ ] Revue manuelle rapide au clavier seul (Tab/Entrée/Échap) des 2-3 vues les plus
      denses (Kanban tâches, table factures) pour confirmer qu'aucun piège de focus
      n'existe.

## D. Fiabilité opérationnelle / DevOps (10% — 7 → 8)

- [ ] Exécuter `scripts/backup-db.sh` puis `scripts/restore-db.sh` **en local** contre
      le PostgreSQL/MinIO du `docker-compose.yml` de dev, pour valider concrètement
      `RUNBOOK.md §1.1` au-delà du job `restore-smoke-test` déjà en CI.
- [ ] Vérifier que chaque alerte de `monitoring/alerts.yml` référence une métrique
      réellement exposée par `server/src/observability/metrics.ts` (pas de nom orphelin).
- [ ] Ajouter au `RUNBOOK.md` une procédure de rollback applicatif (pas de déploiement
      réel nécessaire pour la documenter et la scripter).

## F. Conception API et cohérence des contrats (6% — 7 → 9)

- [ ] Diff exhaustif Swagger vs comportement réel sur les modules les plus sensibles
      (`Invoice`, `Proposal`, `Project`) — comparer chaque annotation JSDoc à la
      signature réelle du handler.
- [ ] Vérifier qu'aucun endpoint ajouté récemment n'a de schéma Zod dupliqué au lieu de
      réutiliser `@secritou/shared` (même motif que les 7/8 fichiers déjà propres).

## J. Maturité du processus de release / CI-CD (5% — 5 → 8)

- [ ] Dépend entièrement de la Phase 0 (CI réactivée + verte) — pas de tâche
      supplémentaire tant que celle-ci n'est pas faite.
- [ ] Une fois vert : ajouter un job de vérification qui échoue si un ID cité dans
      `REFERENTIEL.md` est absent de `ANOMALIES.yaml` (cohérence déjà exigée par
      `CLAUDE.md`, actuellement vérifiée à la main).

## I. Qualité et fiabilité de la documentation (3% — 7 → 10)

- [ ] Relire `README.md` section par section contre le code réel (même méthode que pour
      la promesse Playwright) pour détecter d'autres dérives documentaires.
- [ ] Vérifier que `AUDIT_GRID.md` et `WORKFLOW_AUDIT_REPORT.md` ne citent pas d'états
      désormais obsolètes après les correctifs de Phase 0.

---

## Vérification finale (avant de se déclarer à 90%)

- [ ] Relancer un troisième passage du même audit de maturité (10 catégories, même
      grille) une fois les cases ci-dessus cochées — ne pas s'auto-attribuer le score
      cible sans re-mesure, exactement l'erreur qu'on a corrigée sur SEC-010.
- [ ] Confirmer que chaque note `resolu` ajoutée à `ANOMALIES.yaml` pendant ce chantier
      cite un commit réel et un run CI vert sur ce commit précis.
- [ ] Vérifier qu'aucune tâche cochée n'a introduit de nouveau `any` TypeScript, de
      nouvel `eslint-disable`, ou de champ hors périmètre (`companyId`/`tenantId`,
      toujours interdit) — `npm run lint` doit rester à 0 warning sur les deux
      workspaces.
