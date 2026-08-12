import {
  ModuleRegistry,
  enableDevValidations,
  ClientSideRowModelModule,
  RowSelectionModule,
  TooltipModule,
  CellStyleModule,
  RowAutoHeightModule,
  RowStyleModule,
} from "ag-grid-community";

// SEC-108: single registration point for every AG Grid table in the app (replaces 19 independent
// ModuleRegistry.registerModules([AllCommunityModule]) calls). AllCommunityModule pulled in ~40
// modules never used (editors, filters, CSV export, etc.) for a client that only renders,
// selects, and styles rows — this module set was confirmed exhaustive by loading every real
// route/tab that renders an AG Grid table with enableDevValidations() active (14 routes, 0
// missing-module errors on the second pass). The first pass, with only ClientSideRowModelModule +
// RowSelectionModule + TooltipModule + CellStyleModule, missed RowAutoHeightModule (ProposalsPage
// autoHeight) and RowStyleModule (AdminQuestionsPage rowStyle) — undetectable by reading the code,
// only enableDevValidations() surfaced them (console error #200, actionable, at runtime).
//
// ModuleRegistry is a process-global registry (not per-grid) — importing this file once, before
// any <AgGridReact> mounts, makes every module available to every grid in the app.
if (import.meta.env.DEV) {
  enableDevValidations();
}

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowSelectionModule,
  TooltipModule,
  CellStyleModule,
  RowAutoHeightModule,
  RowStyleModule,
]);
