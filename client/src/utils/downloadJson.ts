// Same client-side download pattern as features/reports/exportExcel.ts, for JSON payloads
// (currently used by the GDPR export actions — see api/gdpr.api.ts).
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
