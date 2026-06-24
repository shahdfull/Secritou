import { type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

export const queryInvalidations = {
  invalidateByPrefix: (queryClient: QueryClient, key: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey: key });
  },
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
  
  // Applications
  invalidateFreelancerApplications: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.freelancerApplications() });
  },
  
  // Settings
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

  // Service Requests (admin)
  invalidateAdminServiceRequests: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ["admin-service-requests"] });
  },
  invalidateAdminServiceRequest: (queryClient: QueryClient, id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminServiceRequest(id) });
  },
  invalidateClientServiceRequests: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clientServiceRequests() });
  },
} as const;
