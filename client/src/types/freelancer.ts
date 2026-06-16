export interface Skill {
  id: string;
  name: string;
}

export interface FreelancerProfile {
  id: string;
  userId: string;
  bio?: string;
  hourlyRate?: number;
  availability: boolean;
  skills: Skill[];
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface FreelancerMission {
  id: string;
  title: string;
  description?: string;
  budget?: number;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  companyId: string;
  freelancerId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFreelancerProfileInput {
  bio?: string;
  hourlyRate?: number;
  skillIds?: string[];
}

export interface UpdateFreelancerProfileInput {
  bio?: string;
  hourlyRate?: number;
  availability?: boolean;
  skillIds?: string[];
}

export interface CreateMissionInput {
  title: string;
  description?: string;
  budget?: number;
  projectId?: string;
}

export interface UpdateMissionInput {
  title?: string;
  description?: string;
  budget?: number;
  status?: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  freelancerId?: string;
}
