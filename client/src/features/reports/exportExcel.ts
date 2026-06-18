import type { Lead } from "@/types/lead";
import type { Project } from "@/types/project";
import type { FreelancerMission } from "@/types/freelancer";

type XlsxModule = typeof import("xlsx");

export async function exportReportsExcel(input: {
  leads: Lead[];
  projects: Project[];
  missions: FreelancerMission[];
}) {
  const XLSX = (await import("xlsx")) as XlsxModule;
  const workbook = XLSX.utils.book_new();

  const leadsSheet = XLSX.utils.json_to_sheet(
    input.leads.map((lead) => ({
      Nom: lead.name,
      Email: lead.email,
      Statut: lead.status,
      "Date de création": new Date(lead.createdAt).toLocaleDateString(),
    }))
  );
  XLSX.utils.book_append_sheet(workbook, leadsSheet, "Leads");

  const projectsSheet = XLSX.utils.json_to_sheet(
    input.projects.map((project) => ({
      Nom: project.name,
      Description: project.description,
      Statut: project.status,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, projectsSheet, "Projets");

  const missionsSheet = XLSX.utils.json_to_sheet(
    input.missions.map((mission) => ({
      Titre: mission.title,
      Description: mission.description,
      Statut: mission.status,
      Budget: mission.budget,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, missionsSheet, "Missions");

  XLSX.writeFile(workbook, "rapport-secritou.xlsx");
}
