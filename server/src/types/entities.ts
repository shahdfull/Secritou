import { Role, ProjectStatus, TaskStatus, LeadStatus, Priority } from "@prisma/client";

// Base interface for all entities
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// User entity
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: Role;
}

// Company entity
export interface Company extends BaseEntity {
  name: string;
  website?: string;
}

// Lead entity
export interface Lead extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status: LeadStatus;
  notes?: string;
}

// Client entity
export interface Client extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
}

// Project entity
export interface Project extends BaseEntity {
  name: string;
  description?: string;
  status: ProjectStatus;
  clientId?: string;
}

// Task entity
export interface Task extends BaseEntity {
  title: string;
  description?: string;
  status: TaskStatus;
  startDate?: Date;
  dueDate?: Date;
  projectId: string;
  assigneeId?: string;
}

// DTOs for API requests
export interface CreateUserDTO {
  email: string;
  name: string;
  password: string;
  companyName?: string;
}

export interface CreateLeadDTO {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  notes?: string;
  lostReason?: string;
}

export interface CreateClientDTO {
  name: string;
  email?: string;
  phone?: string;
}

export interface CreateProjectDTO {
  name: string;
  description?: string;
  status?: ProjectStatus;
  clientId?: string;
  serviceId?: string;
  proposalId: string;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  startDate?: Date;
  dueDate?: Date;
  projectId: string;
  assigneeId?: string;
}

export interface UpdateLeadStatusDTO {
  status: LeadStatus;
}

export interface CreateFreelancerDTO {
  name: string;
  email?: string;
  phone?: string;
  skills: string[];
  rate?: number;
}

export interface CreateServiceDTO {
  name: string;
  description?: string;
  price?: number;
  duration?: string;
}

// Skill entity
export interface Skill extends BaseEntity {
  name: string;
}

// FreelancerProfile entity
export interface FreelancerProfile extends BaseEntity {
  userId: string;
  bio?: string;
  hourlyRate?: number;
  availability: boolean;
  skills: Skill[];
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// DTOs for freelancer profile requests
export interface CreateFreelancerProfileDTO {
  bio?: string;
  hourlyRate?: number;
  skillNames?: string[];
}

export interface UpdateFreelancerProfileDTO {
  bio?: string;
  hourlyRate?: number;
  availability?: boolean;
  skillNames?: string[];
}
