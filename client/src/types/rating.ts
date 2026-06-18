export interface FreelancerRating {
  id: string;
  score: number;
  comment?: string;
  freelancerId: string;
  missionId: string;
  applicationId: string;
  reviewerId: string;
  reviewer: { id: string; name: string };
  mission: { id: string; title: string };
  createdAt: string;
  updatedAt: string;
}

export interface RatingStats {
  averageScore: number;
  reviewCount: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface FreelancerRatingsResult {
  data: FreelancerRating[];
  total: number;
  page: number;
  pageSize: number;
  stats: RatingStats;
}

export interface CreateRatingInput {
  freelancerId: string;
  missionId: string;
  score: number;
  comment?: string;
}

export interface UpdateRatingInput {
  score?: number;
  comment?: string;
}
