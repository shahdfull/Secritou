# AUDIT_MATURITE_SECRITOU.generated.md — score calculé automatiquement

Généré le 2026-07-27 par `npm run audit:score` (scripts/audit-score.mjs), à partir des anomalies ouvertes (`ouvert`/`confirme`/`en_cours`) de `anomalies/_index.yaml`. Document de comparaison, ne remplace pas AUDIT_MATURITE_SECRITOU.md tant que l'écart n'a pas été discuté avec le porteur du projet.

**Barème de pénalité** : par anomalie ouverte, poids de gravité `bloquant`/`eleve` = 6, `majeur`/`moyen` = 3, `mineur`/`faible`/`info` = 1 (mapping des 4 valeurs hors schéma documenté, voir SEC-234). Score de catégorie = `max(0, 10 - Σ pénalités)`. Score global = `Σ (score_catégorie × poids_catégorie%)`.

## Tableau de score calculé

| Catégorie | Poids | Anomalies ouvertes | Pénalité | Score /10 | Contribution |
|---|---|---|---|---|---|
| A. Sécurité applicative | 18% | 6 | 6 | 4.0 | 0.72 |
| B. Intégrité des données | 15% | 3 | 7 | 3.0 | 0.45 |
| C. Performance et scalabilité | 10% | 1 | 3 | 7.0 | 0.70 |
| D. Fiabilité opérationnelle / DevOps | 10% | 1 | 1 | 9.0 | 0.90 |
| E. Couverture et qualité des tests | 10% | 1 | 1 | 9.0 | 0.90 |
| F. Conception API et cohérence des contrats | 6% | 1 | 1 | 9.0 | 0.54 |
| G. Exactitude métier et financière | 15% | 0 | 0 | 10.0 | 1.50 |
| H. UX/UI et accessibilité | 8% | 2 | 2 | 8.0 | 0.64 |
| I. Qualité et fiabilité de la documentation | 3% | 1 | 1 | 9.0 | 0.27 |
| J. Maturité du processus de release / CI-CD | 5% | 0 | 0 | 10.0 | 0.50 |

## Score global calculé : **71/100**

Comparaison avec le score déclaré dans AUDIT_MATURITE_SECRITOU.md v5 : **86/100**. Écart : -15 point(s). Ne pas trancher automatiquement lequel fait foi — discuter avec le porteur du projet avant de remplacer le score déclaré (voir la consigne du Chantier 3).

