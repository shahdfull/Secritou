#!/usr/bin/env node
// Calcule un score de maturité par catégorie A-J (AUDIT_MATURITE_SECRITOU.md §2)
// à partir des anomalies ouvertes dans anomalies/_index.yaml, et un score
// global pondéré. Génère AUDIT_MATURITE_SECRITOU.generated.md (comparaison
// avec le score déclaré, pas remplacement automatique).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IDX_PATH = path.join(ROOT, "anomalies", "_index.yaml");
const OUT_PATH = path.join(ROOT, "AUDIT_MATURITE_SECRITOU.generated.md");

const CATEGORIES = [
  { code: "A", label: "Sécurité applicative", poids: 0.18 },
  { code: "B", label: "Intégrité des données", poids: 0.15 },
  { code: "C", label: "Performance et scalabilité", poids: 0.10 },
  { code: "D", label: "Fiabilité opérationnelle / DevOps", poids: 0.10 },
  { code: "E", label: "Couverture et qualité des tests", poids: 0.10 },
  { code: "F", label: "Conception API et cohérence des contrats", poids: 0.06 },
  { code: "G", label: "Exactitude métier et financière", poids: 0.15 },
  { code: "H", label: "UX/UI et accessibilité", poids: 0.08 },
  { code: "I", label: "Qualité et fiabilité de la documentation", poids: 0.03 },
  { code: "J", label: "Maturité du processus de release / CI-CD", poids: 0.05 },
];

const poidsTotal = CATEGORIES.reduce((s, c) => s + c.poids, 0);
if (Math.abs(poidsTotal - 1) > 1e-9) {
  throw new Error(`Les poids de catégorie ne totalisent pas 100% (${poidsTotal * 100}%)`);
}

// Barème de pénalité par gravité. Le champ gravite du registre utilise en
// réalité 7 valeurs (majeur, mineur, bloquant, eleve, moyen, faible, info),
// pas seulement les 3 documentées dans le schéma d'en-tête — voir SEC-234
// (anomalies/transverse.yaml). Mapping vers l'échelle à 3 niveaux, décidé
// avec le porteur du projet (session du 2026-07-27) :
const GRAVITE_A_POIDS = {
  bloquant: 6,
  eleve: 6,
  majeur: 3,
  moyen: 3,
  mineur: 1,
  faible: 1,
  info: 1,
};

// Statuts comptant comme "ouvert" pour la pénalité — resolu/rejete n'en
// portent aucune (l'écart est clos ou jugé non pertinent).
const STATUTS_OUVERTS = new Set(["ouvert", "confirme", "en_cours"]);

const idx = yaml.load(fs.readFileSync(IDX_PATH, "utf8"));
const anomalies = idx.anomalies;

const parPertinentesParCategorie = new Map(CATEGORIES.map((c) => [c.code, []]));
for (const a of anomalies) {
  if (!STATUTS_OUVERTS.has(a.statut)) continue;
  if (!a.categorie || !parPertinentesParCategorie.has(a.categorie)) continue;
  parPertinentesParCategorie.get(a.categorie).push(a);
}

const rows = CATEGORIES.map((c) => {
  const ouvertes = parPertinentesParCategorie.get(c.code);
  const penalite = ouvertes.reduce((s, a) => s + (GRAVITE_A_POIDS[a.gravite] ?? 1), 0);
  const scoreSur10 = Math.max(0, 10 - penalite);
  return {
    ...c,
    nbOuvertes: ouvertes.length,
    penalite,
    scoreSur10,
    contribution: scoreSur10 * c.poids,
  };
});

const scoreGlobalSur10 = rows.reduce((s, r) => s + r.contribution, 0);
const scoreGlobalSur100 = Math.round(scoreGlobalSur10 * 10);

const dateISO = new Date().toISOString().slice(0, 10);

const lines = [];
lines.push("# AUDIT_MATURITE_SECRITOU.generated.md — score calculé automatiquement");
lines.push("");
lines.push(
  `Généré le ${dateISO} par \`npm run audit:score\` (scripts/audit-score.mjs), à partir des ` +
    "anomalies ouvertes (`ouvert`/`confirme`/`en_cours`) de `anomalies/_index.yaml`. " +
    "Document de comparaison, ne remplace pas AUDIT_MATURITE_SECRITOU.md tant que l'écart " +
    "n'a pas été discuté avec le porteur du projet.",
);
lines.push("");
lines.push(
  "**Barème de pénalité** : par anomalie ouverte, poids de gravité `bloquant`/`eleve` = 6, " +
    "`majeur`/`moyen` = 3, `mineur`/`faible`/`info` = 1 (mapping des 4 valeurs hors schéma " +
    "documenté, voir SEC-234). Score de catégorie = `max(0, 10 - Σ pénalités)`. Score global " +
    "= `Σ (score_catégorie × poids_catégorie%)`.",
);
lines.push("");
lines.push("## Tableau de score calculé");
lines.push("");
lines.push("| Catégorie | Poids | Anomalies ouvertes | Pénalité | Score /10 | Contribution |");
lines.push("|---|---|---|---|---|---|");
for (const r of rows) {
  lines.push(
    `| ${r.code}. ${r.label} | ${Math.round(r.poids * 100)}% | ${r.nbOuvertes} | ${r.penalite} | ${r.scoreSur10.toFixed(1)} | ${(r.contribution).toFixed(2)} |`,
  );
}
lines.push("");
lines.push(`## Score global calculé : **${scoreGlobalSur100}/100**`);
lines.push("");
lines.push(
  "Comparaison avec le score déclaré dans AUDIT_MATURITE_SECRITOU.md v5 : **86/100**. " +
    `Écart : ${scoreGlobalSur100 - 86 >= 0 ? "+" : ""}${scoreGlobalSur100 - 86} point(s). ` +
    "Ne pas trancher automatiquement lequel fait foi — discuter avec le porteur du projet " +
    "avant de remplacer le score déclaré (voir la consigne du Chantier 3).",
);
lines.push("");

fs.writeFileSync(OUT_PATH, lines.join("\n") + "\n", "utf8");

console.log(`Score global calculé : ${scoreGlobalSur100}/100 (déclaré v5 : 86/100)`);
console.log(`Écrit dans ${path.relative(ROOT, OUT_PATH)}`);
for (const r of rows) {
  console.log(
    `  ${r.code} ${r.label.padEnd(45)} ouvertes=${String(r.nbOuvertes).padStart(3)} pénalité=${String(r.penalite).padStart(3)} score=${r.scoreSur10.toFixed(1)}/10`,
  );
}
