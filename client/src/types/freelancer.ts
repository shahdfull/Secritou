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

export interface CreateFreelancerProfileInput {
  bio?: string;
  hourlyRate?: number;
  skillNames?: string[];
}

export interface UpdateFreelancerProfileInput {
  bio?: string;
  hourlyRate?: number;
  availability?: boolean;
  skillNames?: string[];
}
