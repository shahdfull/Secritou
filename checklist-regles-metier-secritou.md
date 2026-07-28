# Checklist des règles métier — Secritou

Extrait de `REFERENTIEL.md` §5 (v associée). Pour chaque règle : l'énoncé,
le module concerné, le statut déclaré dans le référentiel, et une case à
cocher pour votre propre vérification (code, comportement réel, ou décision
produit à trancher).

Légende des statuts déclarés :
- **IMPLÉMENTÉ** : en place et prouvé (idéalement par un test qui appelle le vrai code)
- **PARTIEL** : en cours de construction
- **PRÉVU** : pas encore commencé
- **ÉCART** : décision claire, mais le code observé la contredit → signal d'anomalie
- **[À CONFIRMER]** : statut incertain, à trancher avec vous

---

## A. Argent, mission, engagement client (section prioritaire)

- [ ] **RG-001 — Devise unique.** Toute proposition/facture est en TND uniquement, aucune autre devise à 3 lettres acceptée.
  Modules 4.1, 4.4 · Statut déclaré : **IMPLÉMENTÉ** (test dédié `currencyRejectsNonTnd.test.ts`)

- [ ] **RG-002 — Rattachement mission → pôle → associé.** Un Manager ne peut créer/modifier un projet, ni une proposition, que dans son propre pôle (`serviceId`) — y compris via le Lead/Client d'origine.
  Modules 4.1, 4.2 · Statut déclaré : **IMPLÉMENTÉ** (test `proposalCreationScope.test.ts`, + 4 failles IDOR annexes corrigées : réunions projet, templates, `getBrief`/`getTimelineStatus`)

- [ ] **RG-003 — TVA fixe à 19%.** Appliquée aux factures d'acompte et de solde.
  Module 4.4 · Statut déclaré : **IMPLÉMENTÉ** (test `vat.test.ts` : taux, arrondi aux millimes, cohérence HT/TVA/TTC)

- [ ] **RG-004a — Facture d'acompte à l'acceptation.** 30% du montant de la proposition, générée à l'acceptation.
  Modules 4.4, 4.1 · Statut déclaré : **IMPLÉMENTÉ** (`code_direct` uniquement, pas de test dédié cité)

- [ ] **RG-004b — Facture de solde à la validation client.** Le solde est un **complément à 100%** (montant proposition − acompte réellement facturé), pas un recalcul fixe à 70%.
  Modules 4.4, 4.2, 4.6 · Statut déclaré : **IMPLÉMENTÉ** (test `projectClientApproveBalanceInvoice.test.ts`, couvre le cas où l'acompte dévie du taux attendu)

- [ ] **RG-005 — REMPLACÉE le 2026-07-28 par RG-005-bis.** L'ancien partage cible statique (60/40 → 50/50, jamais implémenté) n'est plus la cible produit.
  Module 4.5 · Statut déclaré : **REMPLACÉE** — voir RG-005-bis ci-dessous. Ne plus citer RG-005 comme règle active ; conservée dans REFERENTIEL.md pour l'historique uniquement.

- [ ] **RG-005-bis — Split de commission automatique par pôle/mission (mode `AUTO`/`MANUAL`).** Sans Freelancer assigné : ADMIN 80% / Managers du pôle 20% (répartis également, remontent à l'ADMIN si 0 Manager). Avec ≥1 Freelancer assigné : ADMIN 40% / Managers 20% / Freelancers 40%. `AUTO` recalcule automatiquement à chaque franchissement de seuil 0↔≥1 Freelancer ; `MANUAL` (édition manuelle par le CEO via `setSplits`) gèle ce recalcul (un franchissement pose alors un flag de désynchronisation). Chaque recalcul/bascule tracé dans `CommissionSplitHistory`.
  Module 4.5 · Statut déclaré : **IMPLÉMENTÉ**, `verifie: test` (`commissionService.test.ts`, `commissionAutoSplitTaskTrigger.test.ts`)

- [ ] **RG-006 — Rémunération à la mission (saisie manuelle, mode `MANUAL`).** Chaque projet porte des `ProjectCommissionSplit` : taux > 0 chacun, somme ≤ 100%, un seul enregistrement par couple projet/associé.
  Module 4.5 · Statut déclaré : **IMPLÉMENTÉ** (test `commissionService.test.ts` : somme 100%, somme partielle, rejets divers)
  ⚠️ **Renumérotation à noter :** un second usage de « RG-006 » existe désormais dans REFERENTIEL.md pour la refonte « paiement à la tâche » (enveloppe de rémunération plafonnant `SUM(payoutAmount)×1.20 + SUM(ProjectManagerFee.amount)`) — deux règles distinctes partagent le même identifiant à ce jour ; à clarifier/renuméroter avec vous plutôt que deviné ici.

- [ ] **RG-028 — Exclusivité PER_TASK.** Un projet en mode `PER_TASK` est rémunéré à la tâche, jamais en pourcentage du paiement encaissé (`computeForPaymentTx` retourne `[]` pour ce mode, même avec des `ProjectCommissionSplit` résiduels).
  Module 4.5 · Statut déclaré : **IMPLÉMENTÉ**, `verifie: test` (`commissionPerTaskExclusivity.test.ts`)

- [ ] **RG-029 — Bascule vers `PER_TASK`.** Purge des `ProjectCommissionSplit` + entrée `CommissionSplitHistory` (`MODE_SET_PER_TASK`) dans la même transaction, via `POST /commissions/projects/:projectId/commission-mode/per-task` (ADMIN uniquement), refusé en 409 si le projet a déjà une `Commission`.
  Module 4.5 · Statut déclaré : **IMPLÉMENTÉ**, `verifie: test`

- [ ] **RG-007 — Base de calcul de la commission.** Calculée sur le montant brut réellement encaissé par paiement, sans déduction de coûts.
  Module 4.5 · Statut déclaré : **IMPLÉMENTÉ** (`code_direct`). *Évolution envisagée non implémentée : calcul sur marge nette.*

- [ ] **RG-008 — Déclenchement de la commission.** Créée uniquement quand un paiement est réellement enregistré ET appliqué (montant > 0 après trop-perçu).
  Modules 4.5, 4.4 · Statut déclaré : **IMPLÉMENTÉ** (test `commissionCreationExclusivity.test.ts` + contrainte DB `Commission.paymentId @unique`)

- [ ] **RG-009 — Cycle de vie du paiement de commission.** `PENDING` → `PAID` par action manuelle Admin uniquement, non rejouable.
  Module 4.5 · Statut déclaré : **IMPLÉMENTÉ** (`code_direct`)

- [ ] **RG-010 — Cascade d'acceptation de proposition.** En une seule transaction : Lead → WON, liaison client, création projet (idempotente), facture d'acompte 30%.
  Modules 4.1, 4.2, 4.4 · Statut déclaré : **IMPLÉMENTÉ** (`code_direct`)

- [ ] **RG-011 — Visibilité des commissions par associé.** Un Manager ne voit que ses propres répartitions/commissions.
  Modules 4.5, 4.10 · Statut déclaré : **IMPLÉMENTÉ** (test qui assère explicitement le refus, pas seulement le chemin nominal)

- [ ] **RG-012 — Numérotation des factures sans trou.** Format `INV-YYYYMM-NNNN`, compteur incrémenté dans la même transaction que la création.
  Module 4.4 · Statut déclaré : **IMPLÉMENTÉ** (test `invoiceNumberingGapless.test.ts` ; correction : le `number` fourni manuellement par l'appelant a été retiré du validateur)

- [ ] **RG-013 — Clôture de mission par le client uniquement.** `COMPLETED` seulement via `clientApprove`, jamais via une mise à jour directe.
  Modules 4.2, 4.6 · Statut déclaré : **IMPLÉMENTÉ** pour le garde-fou de rejet (test `projectUpdateBlocksCompletion.test.ts`) **et pour le succès de bout en bout** (test `projectClientApproveBalanceInvoice.test.ts`, 2/2 verts, appelle réellement `clientApprove` avec une vraie facture d'acompte).
  ✅ **SEC-202 résolu, plus une anomalie ouverte** (absent de `anomalies/_index.yaml`, qui ne contient que SEC-001 à SEC-007 à date) — le blocage `DUPLICATE_ENTRY` signalé par une session antérieure (P2002 sur `Invoice.proposalId`, unique globalement) a été corrigé : `createBalanceInvoiceTx` ne réutilise plus le même `proposalId` que la facture d'acompte. Revérifié directement dans cette session (`grep` du commentaire SEC-202 dans `project.service.ts`, relance du test cité : `tests 2 / pass 2 / fail 0`).

---

## B. Autres règles

- [ ] **RG-014 — Vérification de rôle avant action IA.** Seuls Admin et Manager peuvent déclencher un persona IA.
  Module 4.11 (GELÉ) · Statut déclaré : **IMPLÉMENTÉ** (`code_direct`)

- [ ] **RG-015 — Fournisseur du module IA.** Appelle Ollama (Mistral) auto-hébergé — pas Anthropic, pas OpenRouter.
  Module 4.11 (GELÉ) · Statut déclaré : **IMPLÉMENTÉ** (`code_direct`)

- [ ] **RG-016 — Exécution de code toujours sandboxée (Docker).** Pour l'agent IA de génération de prototype.
  Module 4.11 (GELÉ) · Statut déclaré : **PRÉVU** — fonctionnalité non commencée, aucune trace de sandboxing.

- [ ] **RG-017 — Aucun accès Client aux outils d'exécution**, y compris via le module IA.
  Modules 4.11 (GELÉ), 4.10 · Statut déclaré : **IMPLÉMENTÉ** (test `aiExecutionAccessClient.test.ts` : rejet 403 pour CLIENT/FREELANCER + scan des primitives d'exécution)

- [ ] **RG-018 — Activation du portail client au paiement de l'acompte**, jamais à la simple acceptation de la proposition.
  Modules 4.6, 4.4 · Statut déclaré : **IMPLÉMENTÉ** (`code_direct` uniquement — pas encore de test dédié qui asserte l'absence d'invitation à l'acceptation ET sa présence au paiement dans le même scénario)

- [ ] **RG-019 — Révocation de session sur changement de rôle uniquement.** Un changement de nom seul ne révoque rien.
  Module 4.14 · Statut déclaré : **IMPLÉMENTÉ** (test réécrit, appelle réellement `updateUser`)
  ⚠️ Historique : la révocation a été inopérante entre son introduction (commit `eb93f08`) et sa correction — vérifiez que le correctif est bien celui déployé.

- [ ] **RG-020 — Timeout d'inactivité de session (heartbeat, 3 min).** Passé ce délai, un nouveau heartbeat ouvre une nouvelle session plutôt que d'étendre l'ancienne.
  Module 4.14 · Statut déclaré : **[À CONFIRMER]** — le seuil de 3 minutes n'a **aucune source produit** (ni référentiel, ni cadrage), il vit uniquement dans le code. **À valider explicitement avec vous.**

- [ ] **RG-021 — Protection du dernier Admin.** Ni retrait de rôle, ni suppression du dernier compte ADMIN.
  Module 4.14 · Statut déclaré : **IMPLÉMENTÉ** (5 tests dédiés)

- [ ] **RG-022 — Trop-perçu → avoir automatique, plafonné cumulativement.** Un avoir manuel ne peut jamais dépasser (encaissé − avoirs déjà émis) sur la même facture.
  Module 4.4 · Statut déclaré : **IMPLÉMENTÉ** (test dédié au plafond cumulatif + rejet montant ≤ 0)

- [ ] **RG-023 — Numérotation des avoirs jamais collisionnable**, même sous création concurrente stricte.
  Module 4.4 · Statut déclaré : **IMPLÉMENTÉ** (test de concurrence réelle via `Promise.allSettled`)

- [ ] **RG-024 — Timbre fiscal (0.6 TND) inclus dans le montant réellement dû.** Le PDF affiche un "Net à payer" cohérent avec ce que le système compare au paiement.
  Module 4.4 · Statut déclaré : **IMPLÉMENTÉ** (test 2 cas). Note : les factures DEPOSIT/BALANCE émises *avant* le correctif gardent `timbreFiscal = NULL`, pas de retraitement rétroactif — à vérifier si acceptable pour vous.

- [ ] **RG-025 — Export et effacement RGPD.** Chaîne d'identité unique `ContactRequest → Lead → Client`, + `User` séparément ; suppression réelle si aucun historique financier, sinon anonymisation ; self-service (`/gdpr/me/export`, `/gdpr/me/erase`) ouvert à tout rôle.
  Transverse (4.1, 4.14) · Statut déclaré : **IMPLÉMENTÉ**, test dédié.
  ⚠️ **Point d'attention explicite du référentiel : `typecheck`/`lint`/`test:coverage` n'ont jamais été exécutés avec succès sur ce lot** (blocage d'environnement signalé, pas une erreur cachée) — 6 sous-écarts encore `en_cours` (SEC-220 à SEC-225) au moment de la rédaction. **À faire tourner vous-même avant de considérer ce point acquis.**

- [ ] **RG-026 — 3 niveaux de confirmation UX** (aucune / simple / renforcée) selon réversibilité et enjeu, avec une liste fermée d'actions Niveau 2 (facture, commission payée, annulation réservation, etc.).
  Transverse (UI/UX) · Statut déclaré : **PRÉVU** — règle définie mais les 7 actions listées **ne sont pas encore protégées au niveau 2 dans le code** au moment de la rédaction.

- [ ] **RG-027 — Un compte = un rôle, jamais un cumul.** Un même email ne peut correspondre qu'à un seul compte/rôle actif.
  Modules 4.14, transverse RBAC · Statut déclaré : **IMPLÉMENTÉ** (`code_direct` : `User.role` scalaire + `@@unique([email])`, changement de rôle = remplacement, jamais ajout)
  ⚠️ Deux points ouverts liés, pas des violations de la règle elle-même :
  - Message d'erreur générique (pas métier) en cas de collision d'email via `acceptApplication` — confort, pas une brèche.
  - **`[À CONFIRMER]` — Client et Freelancer mutuellement exclusifs par effet de bord de la contrainte email, jamais tranché comme un vrai choix produit.** Si vous voulez un jour autoriser une même personne à être Client ET Freelancer, ça demande un mécanisme dédié (ex. `personId` commun) — à décider explicitement.
  - **SEC-006 (gravité majeure, ouvert)** : aucun écran ni endpoint ne permet d'assigner le `serviceId` (pôle) d'un Manager à l'invitation ou à la modification — un Manager nouvellement créé a `serviceId: null`, donc scopé "à rien" par RG-002, sauf accès direct à la base.

---

## Anomalies ouvertes à date (registre `anomalies/_index.yaml`, relu intégralement dans cette session)

Le registre a été remis à zéro le 2026-07-27 (historique réel archivé sur la
branche locale `archive/anomalies-avant-reset`) — les 7 anomalies listées
ci-dessous sont les seules réellement ouvertes à date, toutes numérotées
SEC-001 à SEC-007. **SEC-202** cité plus haut (RG-013) n'en fait plus partie
puisqu'il est résolu ; ne pas le confondre avec ce registre.

- **SEC-001** (moyenne, en_cours) — `GET /invoices/:id/credit-notes` sans scope de pôle pour MANAGER (4.4)
- **SEC-002** (moyenne, en_cours) — PDF de facture BALANCE généré avec le gabarit "Acompte 30%" (4.4, lié à RG-004b)
- **SEC-003** (moyenne, en_cours) — `invoiceService.update` sur facture DRAFT sans entrée AuditLog (4.4)
- **SEC-004** (moyenne, ouvert) — scope MANAGER de `ServiceRequest` trop large, expose les demandes multi-pôle (4.6)
- **SEC-005** (mineure, ouvert) — 4 services du portail client sans AuditLog (4.6)
- **SEC-006** (**majeure**, ouvert) — aucun endpoint ne permet d'assigner le `serviceId` d'un Manager (4.14, lié à RG-027 ci-dessus — le point le plus structurant du registre actuel)
- **SEC-007** (mineure, ouvert) — aucun chemin API ne permet de retirer l'assigneeId d'une Task, ce qui laisse le sens "retrait" de RG-005-bis non testable (4.5)

## Comment vérifier

1. Pour chaque case ⚠️ ou `[À CONFIRMER]` : c'est le référentiel lui-même qui signale un doute — priorité de vérification la plus haute.
2. Pour les règles **IMPLÉMENTÉ + `verifie: test`** : vous pouvez lancer le test cité (`npm run test:unit --workspace server` puis filtrer sur le nom de fichier) pour confirmer qu'il passe réellement chez vous.
3. Pour les règles **IMPLÉMENTÉ + `verifie: code_direct`** seulement (RG-004a, RG-007, RG-009, RG-010, RG-014, RG-015, RG-018, RG-027) : aucun test ne les protège contre une régression future — à surveiller si vous touchez ce code.
4. Pour **PRÉVU** (RG-016, RG-026) : confirmez que c'est bien votre intention actuelle de ne pas les avoir encore développées, pas un oubli. RG-005 n'est plus dans cette catégorie : elle est **REMPLACÉE**, pas en attente (voir RG-005-bis).
