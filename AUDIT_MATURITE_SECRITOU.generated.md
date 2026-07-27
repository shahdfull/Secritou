# AUDIT_MATURITE_SECRITOU.generated.md — score calculé automatiquement

Généré le 2026-07-27 par `npm run audit:score` (scripts/audit-score.mjs), à partir des anomalies ouvertes (`ouvert`/`confirme`/`en_cours`) de `anomalies/_index.yaml`.

**Barème de pénalité** : par anomalie ouverte, poids de gravité `bloquant`/`eleve` = 6, `majeur`/`moyen` = 3, `mineur`/`faible`/`info` = 1. Score de catégorie = `max(0, 10 - Σ pénalités)`. Score global = `Σ (score_catégorie × poids_catégorie%)`.

## Tableau de score calculé

| Catégorie | Poids | Anomalies ouvertes | Pénalité | Score /10 | Contribution |
|---|---|---|---|---|---|
| A. Sécurité applicative | 18% | 0 | 0 | 10.0 | 1.80 |
| B. Intégrité des données | 15% | 0 | 0 | 10.0 | 1.50 |
| C. Performance et scalabilité | 10% | 0 | 0 | 10.0 | 1.00 |
| D. Fiabilité opérationnelle / DevOps | 10% | 0 | 0 | 10.0 | 1.00 |
| E. Couverture et qualité des tests | 10% | 0 | 0 | 10.0 | 1.00 |
| F. Conception API et cohérence des contrats | 6% | 0 | 0 | 10.0 | 0.60 |
| G. Exactitude métier et financière | 15% | 0 | 0 | 10.0 | 1.50 |
| H. UX/UI et accessibilité | 8% | 0 | 0 | 10.0 | 0.80 |
| I. Qualité et fiabilité de la documentation | 3% | 0 | 0 | 10.0 | 0.30 |
| J. Maturité du processus de release / CI-CD | 5% | 0 | 0 | 10.0 | 0.50 |

## Score global calculé : **100/100**

