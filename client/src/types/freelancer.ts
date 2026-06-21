export interface Skill {
  id: string;
  name: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerProfile {
  id: string;
  userId: string;
  bio?: string;
  hourlyRate?: number;
  availability: boolean;
  rating?: number;
  reviewCount: number;
  skills: Skill[];
  portfolio: PortfolioItem[];
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
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  paidAmount?: number;
  paidAt?: string;
  paymentNote?: string;
  companyId: string;
  freelancerId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  freelancer?: { id: string; user: { id: string; name: string; email: string } };
  _count?: { applications: number };
}

export interface MissionApplication {
  id: string;
  missionId: string;
  freelancerId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  freelancer: FreelancerProfile;
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
  status?: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  freelancerId?: string;
}
