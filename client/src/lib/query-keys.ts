export const queryKeys = {
  // Tasks
  tasks: <T extends object = object>(params?: T) => ["tasks", params] as const,
  task: (id: string) => ["task", id] as const,
  taskComments: (taskId: string) => ["taskComments", taskId] as const,
  
  // Leads
  leads: <T extends object = object>(params?: T) => ["leads", params] as const,
  lead: (id: string) => ["lead", id] as const,
  
  // Missions
  missions: <T extends object = object>(params?: T) => ["missions", params] as const,
  mission: (id: string) => ["mission", id] as const,
  missionApplications: (missionId: string) => ["missionApplications", missionId] as const,
  
  // Projects
  projects: <T extends object = object>(params?: T) => ["projects", params] as const,
  project: (id: string) => ["project", id] as const,
  
  // Clients
  clients: <T extends object = object>(params?: T) => ["clients", params] as const,
  client: (id: string) => ["client", id] as const,
  clientDocuments: (clientId: string) => ["clientDocuments", clientId] as const,
  
  // Freelancers
  freelancers: <T extends object = object>(params?: T) => ["freelancers", params] as const,
  freelancer: (id: string) => ["freelancer", id] as const,
  
  // Users
  users: <T extends object = object>(params?: T) => ["users", params] as const,
  user: (id: string) => ["user", id] as const,
  
  // Applications
  freelancerApplications: <T extends object = object>(params?: T) => ["freelancerApplications", params] as const,
  
  // Reports
  reports: () => ["reports"] as const,
  
  // Settings
  permissions: () => ["permissions"] as const,
  joinRequests: () => ["joinRequests"] as const,
  
  // Onboarding
  clientOnboarding: (projectId: string) => ["clientOnboarding", projectId] as const,

  // Service Requests (client-facing)
  clientServiceRequests: () => ["client-service-requests"] as const,

  // Service Requests (admin)
  adminServiceRequests: <T extends object = object>(params?: T) =>
    ["admin-service-requests", params] as const,
  adminServiceRequest: (id: string) => ["admin-service-request", id] as const,

  // Ratings
  freelancerRatings: (freelancerId: string, params?: object) =>
    ["freelancerRatings", freelancerId, params] as const,
  freelancerRatingStats: (freelancerId: string) =>
    ["freelancerRatingStats", freelancerId] as const,
} as const;
