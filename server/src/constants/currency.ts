// Dashboards/KPIs aggregate revenue by summing raw amounts without converting between
// currencies. Until FX-aware aggregation exists, every revenue query is scoped to this
// single currency so a stray non-TND invoice/proposal can't silently corrupt totals.
export const DEFAULT_CURRENCY = "TND";
