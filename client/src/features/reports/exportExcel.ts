import type { Lead } from "@/types/lead";
import type { Project } from "@/types/project";
import type { FreelancerMission } from "@/types/freelancer";

export async function exportReportsExcel(input: {
  leads: Lead[];
  projects: Project[];
  missions: FreelancerMission[];
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  const leadsSheet = workbook.addWorksheet("Leads");
  leadsSheet.columns = [
    { header: "Nom", key: "nom", width: 30 },
    { header: "Email", key: "email", width: 30 },
    { header: "Statut", key: "statut", width: 15 },
    { header: "Date de création", key: "date", width: 20 },
  ];
  leadsSheet.addRows(
    input.leads.map((lead) => ({
      nom: lead.name,
      email: lead.email ?? "",
      statut: lead.status,
      date: new Date(lead.createdAt).toLocaleDateString("fr-FR"),
    }))
  );

  const projectsSheet = workbook.addWorksheet("Projets");
  projectsSheet.columns = [
    { header: "Nom", key: "nom", width: 30 },
    { header: "Description", key: "description", width: 50 },
    { header: "Statut", key: "statut", width: 15 },
  ];
  projectsSheet.addRows(
    input.projects.map((project) => ({
      nom: project.name,
      description: project.description ?? "",
      statut: project.status,
    }))
  );

  const missionsSheet = workbook.addWorksheet("Missions");
  missionsSheet.columns = [
    { header: "Titre", key: "titre", width: 30 },
    { header: "Description", key: "description", width: 50 },
    { header: "Statut", key: "statut", width: 15 },
    { header: "Budget", key: "budget", width: 15 },
  ];
  missionsSheet.addRows(
    input.missions.map((mission) => ({
      titre: mission.title,
      description: mission.description ?? "",
      statut: mission.status,
      budget: mission.budget ?? 0,
    }))
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rapport-secritou.xlsx";
  anchor.click();
  URL.revokeObjectURL(url);
}
