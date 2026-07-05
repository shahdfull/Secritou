import api from "./axios";

export interface ProjectHealthItem {
  id: string;
  name: string;
  clientName: string;
  status: string;
  progress: number;
  deadline: string | null;
  daysUntilDeadline: number | null;
  isOverdue: boolean;
  budget: string | null;
  openTasksCount: number;
  blockedTasksCount: number;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  isStale: boolean;
  briefCompleted: boolean;
  contractSigned: boolean;
  healthScore: "green" | "orange" | "red";
}

export const healthBoardApi = {
  getHealthBoard: async (): Promise<ProjectHealthItem[]> => {
    const res = await api.get<{ data: ProjectHealthItem[] }>("/projects/health-board");
    return res.data.data;
  },
};
