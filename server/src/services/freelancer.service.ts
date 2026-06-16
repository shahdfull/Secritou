// Service for Freelancers - Business logic
import type {
  CreateFreelancerProfileDTO,
  UpdateFreelancerProfileDTO,
} from "../types/entities.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";

export const freelancerService = {
  async getPublicProfiles() {
    return freelancerRepository.findAllPublic();
  },

  async getProfile(id: string) {
    const profile = await freelancerRepository.findById(id);
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
    return freelancerRepository.update(existingProfile.id, data);
  },

  async deleteMyProfile(userId: string, userRole: Role) {
    if (userRole !== "FREELANCER") {
      throw new HttpError(403, "Only freelancers can delete their profile");
    }
    const existingProfile = await freelancerRepository.findByUserId(userId);
    if (!existingProfile) {
      throw new HttpError(404, "Freelancer profile not found");
    }
    return freelancerRepository.delete(existingProfile.id);
  },
};
