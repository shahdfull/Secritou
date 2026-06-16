export interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: Date;
}

export interface Client {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  createdAt: Date;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  serviceInterested: string;
  status: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  assignedTo: string;
  title: string;
  status: string;
  dueDate: Date;
}
