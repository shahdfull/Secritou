import { User, Client, Lead, Project, Task } from "@/types/database";

export const mockUsers: User[] = [
  { id: "1", fullName: "John Doe", email: "john@secritou.com", role: "Owner", createdAt: new Date("2024-01-01") },
  { id: "2", fullName: "Jane Smith", email: "jane@secritou.com", role: "Admin", createdAt: new Date("2024-02-15") },
  { id: "3", fullName: "Mike Johnson", email: "mike@secritou.com", role: "Member", createdAt: new Date("2024-03-20") },
];

export const mockLeads: Lead[] = [
  { id: "1", name: "Sarah Wilson", email: "sarah@techcorp.com", phone: "+1 555 123 4567", company: "TechCorp", serviceInterested: "Strategy", status: "New", createdAt: new Date("2024-06-01") },
  { id: "2", name: "David Brown", email: "david@innovate.io", phone: "+1 555 234 5678", company: "Innovate.io", serviceInterested: "Marketing", status: "Contacted", createdAt: new Date("2024-05-28") },
  { id: "3", name: "Emily Davis", email: "emily@growthhub.com", phone: "+1 555 345 6789", company: "Growth Hub", serviceInterested: "Technology", status: "Qualified", createdAt: new Date("2024-05-25") },
  { id: "4", name: "Chris Miller", email: "chris@startup.com", phone: "+1 555 456 7890", company: "StartupXYZ", serviceInterested: "AI", status: "Converted", createdAt: new Date("2024-05-20") },
  { id: "5", name: "Lisa Anderson", email: "lisa@smallbiz.com", phone: "+1 555 567 8901", company: "SmallBiz Co", serviceInterested: "Strategy", status: "Lost", createdAt: new Date("2024-05-15") },
];

export const mockClients: Client[] = [
  { id: "1", companyName: "TechCorp", contactName: "Sarah Wilson", email: "sarah@techcorp.com", phone: "+1 555 123 4567", industry: "Technology", createdAt: new Date("2024-05-22") },
  { id: "2", companyName: "Innovate.io", contactName: "David Brown", email: "david@innovate.io", phone: "+1 555 234 5678", industry: "Software", createdAt: new Date("2024-04-15") },
  { id: "3", companyName: "Growth Hub", contactName: "Emily Davis", email: "emily@growthhub.com", phone: "+1 555 345 6789", industry: "Marketing", createdAt: new Date("2024-03-10") },
];

export const mockProjects: Project[] = [
  { id: "1", clientId: "1", title: "Digital Transformation", description: "Full digital transformation for TechCorp", status: "In Progress", startDate: new Date("2024-06-01"), endDate: new Date("2024-08-15"), createdAt: new Date("2024-06-01") },
  { id: "2", clientId: "2", title: "Website Redesign", description: "Complete website redesign and optimization", status: "Review", startDate: new Date("2024-05-15"), endDate: new Date("2024-07-10"), createdAt: new Date("2024-05-15") },
  { id: "3", clientId: "3", title: "Marketing Strategy", description: "Comprehensive marketing strategy", status: "Completed", startDate: new Date("2024-04-01"), endDate: new Date("2024-06-10"), createdAt: new Date("2024-04-01") },
  { id: "4", clientId: "1", title: "AI Integration", description: "AI automation for internal processes", status: "Planning", startDate: new Date("2024-07-01"), endDate: new Date("2024-09-30"), createdAt: new Date("2024-06-10") },
];

export const mockTasks: Task[] = [
  { id: "1", projectId: "1", assignedTo: "1", title: "Initial Strategy Meeting", status: "Done", dueDate: new Date("2024-06-05") },
  { id: "2", projectId: "1", assignedTo: "2", title: "System Audit", status: "In Progress", dueDate: new Date("2024-06-20") },
  { id: "3", projectId: "2", assignedTo: "1", title: "Design Wireframes", status: "Review", dueDate: new Date("2024-06-12") },
  { id: "4", projectId: "3", assignedTo: "3", title: "Market Research", status: "Todo", dueDate: new Date("2024-07-01") },
  { id: "5", projectId: "1", assignedTo: "2", title: "Tech Stack Selection", status: "Todo", dueDate: new Date("2024-06-25") },
];

export const getClientById = (id: string): Client | undefined => mockClients.find(client => client.id === id);
export const getUserById = (id: string): User | undefined => mockUsers.find(user => user.id === id);
export const getProjectById = (id: string): Project | undefined => mockProjects.find(project => project.id === id);
