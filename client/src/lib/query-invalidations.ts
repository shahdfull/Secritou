import { type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

export const queryInvalidations = {
  // Tasks
  invalidateTasks: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
  },
  invalidateTask: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.task(id) });
  },
  invalidateTaskComments: (queryClient: QueryClient, taskId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(taskId) });
  },
  
  // Leads
  invalidateLeads: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.leads() });
  },
  invalidateLead: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.lead(id) });
  },
  
  // Missions
  invalidateMissions: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
  },
  invalidateMission: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mission(id) });
  },
  invalidateMissionApplications: (queryClient: QueryClient, missionId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.missionApplications(missionId) });
  },
  
  // Projects
  invalidateProjects: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
  },
  invalidateProject: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.project(id) });
  },
  
  // Clients
  invalidateClients: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clients() });
  },
  invalidateClient: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.client(id) });
  },
  invalidateClientDocuments: (queryClient: QueryClient, clientId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clientDocuments(clientId) });
  },
  
  // Freelancers
  invalidateFreelancers: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.freelancers() });
  },
  invalidateFreelancer: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.freelancer(id) });
  },
  
  // Users
  invalidateUsers: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users() });
  },
  invalidateUser: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.user(id) });
  },
  invalidateCompanyUsers: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.companyUsers() });
  },
  
  // Applications
  invalidateFreelancerApplications: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.freelancerApplications() });
  },
  
  // Settings
  invalidateCompany: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.company() });
  },
  invalidatePermissions: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.permissions() });
  },
  invalidateJoinRequests: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.joinRequests() });
  },
  
  // Onboarding
  invalidateClientOnboarding: (queryClient: QueryClient, projectId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clientOnboarding(projectId) });
  },
} as const;
