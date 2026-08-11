import type { Lead } from "@/types/lead";
import type { Project } from "@/types/project";

const HEADER_STYLE = { fontWeight: "bold" as const };

export async function exportReportsExcel(input: {
  leads: Lead[];
  projects: Project[];
}) {
  const writeXlsxFile = (await import("write-excel-file/browser")).default;

  const leadsSheet = {
    sheet: "Leads",
    columns: [{ width: 30 }, { width: 30 }, { width: 15 }, { width: 20 }],
    data: [
      [
        { value: "Nom", ...HEADER_STYLE },
        { value: "Email", ...HEADER_STYLE },
        { value: "Statut", ...HEADER_STYLE },
        { value: "Date de création", ...HEADER_STYLE },
      ],
      ...input.leads.map((lead) => [
        { value: lead.name },
        { value: lead.email ?? "" },
        { value: lead.status },
        { value: new Date(lead.createdAt).toLocaleDateString("fr-FR") },
      ]),
    ],
  };

  const projectsSheet = {
    sheet: "Projets",
    columns: [{ width: 30 }, { width: 50 }, { width: 15 }],
    data: [
      [
        { value: "Nom", ...HEADER_STYLE },
        { value: "Description", ...HEADER_STYLE },
        { value: "Statut", ...HEADER_STYLE },
      ],
      ...input.projects.map((project) => [
        { value: project.name },
        { value: project.description ?? "" },
        { value: project.status },
      ]),
    ],
  };

  const result = await writeXlsxFile([leadsSheet, projectsSheet]);
  await result.toFile("rapport-secritou.xlsx");
}
