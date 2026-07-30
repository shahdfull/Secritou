import type {
  CreateFreelancerProfileDTO,
  UpdateFreelancerProfileDTO,
} from "../types/entities.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const freelancerService = {
  async getAll(options: ListQueryOptions & { serviceId?: string | null }) {
    return freelancerRepository.findAll(options);
  },

  // SEC-026: unlike getAll, which already scopes MANAGER by pole (user.tasks.some.project.
  // serviceId), a direct-id lookup had no scope check at all — a MANAGER could read any
  // freelancer's full profile (hourlyRate included) via GET /freelancers/:id regardless of pole.
  async getById(id: string, serviceId?: string | null) {
    const profile = await freelancerRepository.findById(id, serviceId);
    if (!profile) throw new HttpError(404, "Freelancer not found");
    return profile;
  },

  async getByUserId(userId: string) {
    const profile = await freelancerRepository.findByUserId(userId);
    if (!profile) throw new HttpError(404, "Freelancer profile not found");
    return profile;
  },


  async createMyProfile(
    userId: string,
    userRole: Role,
    data: CreateFreelancerProfileDTO
  ) {
    if (userRole !== "FREELANCER") {
      throw new HttpError(403, "Only freelancers can create a profile");
    }
    const existingProfile = await freelancerRepository.findByUserId(userId);
    if (existingProfile) {
      throw new HttpError(409, "Freelancer profile already exists");
    }
    return freelancerRepository.create({ ...data, userId });
  },

  async updateMyProfile(
    userId: string,
    userRole: Role,
    data: UpdateFreelancerProfileDTO
  ) {
    if (userRole !== "FREELANCER") {
      throw new HttpError(403, "Only freelancers can update their profile");
    }
    const existingProfile = await freelancerRepository.findByUserId(userId);
    if (!existingProfile) {
      throw new HttpError(404, "Freelancer profile not found");
    }
    return freelancerRepository.update(existingProfile.id, userId, data);
  },

  async deleteMyProfile(userId: string, userRole: Role) {
    if (userRole !== "FREELANCER") {
      throw new HttpError(403, "Only freelancers can delete their profile");
    }
    const existingProfile = await freelancerRepository.findByUserId(userId);
    if (!existingProfile) {
      throw new HttpError(404, "Freelancer profile not found");
    }
    return freelancerRepository.delete(existingProfile.id, userId);
  },
};
