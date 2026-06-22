import type { DateRange } from "@/components/DateFilter";
import type { Lead } from "@/types/lead";
import type { Project } from "@/types/project";

type JsPDFModule = typeof import("jspdf");
type AutoTableModule = typeof import("jspdf-autotable");

export async function exportReportsPdf(input: {
  dateRange: DateRange;
  leads: Lead[];
  projects: Project[];
}) {
  const [{ jsPDF }, autoTable] = await Promise.all([
    import("jspdf") as Promise<JsPDFModule>,
    import("jspdf-autotable") as Promise<AutoTableModule>,
  ]);

  const doc = new jsPDF();
  const title = `Rapport Secritou - ${input.dateRange.from?.toLocaleDateString()} à ${input.dateRange.to?.toLocaleDateString()}`;
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  doc.setFontSize(14);
  doc.text("Leads", 14, 40);
  autoTable.default(doc, {
    startY: 45,
    head: [["Nom", "Email", "Statut", "Date de création"]],
    body: input.leads.map((lead) => [
      lead.name,
      lead.email || "-",
      lead.status,
      new Date(lead.createdAt).toLocaleDateString(),
    ]),
  });

  const projectsY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 45) + 20;
  doc.text("Projets", 14, projectsY);
  autoTable.default(doc, {
    startY: projectsY + 5,
    head: [["Nom", "Description", "Statut"]],
    body: input.projects.map((project) => [project.name, project.description || "-", project.status]),
  });

  doc.save("rapport-secritou.pdf");
}
