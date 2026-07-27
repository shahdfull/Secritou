import { themeQuartz } from "ag-grid-community";

// Thème clair unique, cohérent avec le reste de l'application qui n'a pas de mode sombre.
// Couleurs alignées sur les tokens Tailwind déjà utilisés ailleurs (primary teal, bordures
// neutres) plutôt que le violet par défaut de Quartz. Partagé entre tous les tableaux migrés
// vers AG Grid pour éviter une redéfinition par fichier (cf. TasksListView.tsx, origine du thème).
export const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});
