import { type Task } from "@/types/task";
import { type Lead } from "@/types/lead";
import { type FreelancerMission } from "@/types/freelancer";
import { type Project } from "@/types/project";
import { type Client } from "@/types/client";
import { type FreelancerProfile } from "@/types/freelancer";
import { type User } from "@/types/auth";
import { type Comment } from "@/types/comment";

export const queryKeys = {
  // Tasks
  tasks: (params?: Record<string, unknown>) => ["tasks", params] as const,
  task: (id: string) => ["task", id] as const,
  taskComments: (taskId: string) => ["taskComments", taskId] as const,
  
  // Leads
  leads: (params?: Record<string, unknown>) => ["leads", params] as const,
  lead: (id: string) => ["lead", id] as const,
  
  // Missions
  missions: (params?: Record<string, unknown>) => ["missions", params] as const,
  mission: (id: string) => ["mission", id] as const,
  missionApplications: (missionId: string) => ["missionApplications", missionId] as const,
  
  // Projects
  projects: (params?: Record<string, unknown>) => ["projects", params] as const,
  project: (id: string) => ["project", id] as const,
  
  // Clients
  clients: (params?: Record<string, unknown>) => ["clients", params] as const,
  client: (id: string) => ["client", id] as const,
  clientDocuments: (clientId: string) => ["clientDocuments", clientId] as const,
  
  // Freelancers
  freelancers: (params?: Record<string, unknown>) => ["freelancers", params] as const,
  freelancer: (id: string) => ["freelancer", id] as const,
  
  // Users
  users: (params?: Record<string, unknown>) => ["users", params] as const,
  user: (id: string) => ["user", id] as const,
  companyUsers: () => ["companyUsers"] as const,
  
  // Applications
  freelancerApplications: (params?: Record<string, unknown>) => ["freelancerApplications", params] as const,
  
  // Reports
  reports: () => ["reports"] as const,
  
  // Settings
  company: () => ["company"] as const,
  permissions: () => ["permissions"] as const,
  joinRequests: () => ["joinRequests"] as const,
  
  // Onboarding
  clientOnboarding: (projectId: string) => ["clientOnboarding", projectId] as const,
} as const;
