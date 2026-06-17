import { freelancerApplicationRepository } from "../repositories/freelancerApplication.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { freelancerRepository } from "../repositories/freelancer.repository.js";
import bcrypt from "bcryptjs";
import type { ApplicationStatus } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const freelancerApplicationService = {
  async getAllApplications(
    options: ListQueryOptions & { search?: string; status?: ApplicationStatus }
  ) {
    return freelancerApplicationRepository.findAll(options);
  },

  async getApplicationById(id: string) {
    return freelancerApplicationRepository.findById(id);
  },

  async createApplication(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    position: string;
    cvUrl: string;
    portfolioUrl: string;
  }) {
    return freelancerApplicationRepository.create(data);
  },

  async rejectApplication(id: string, rejectionReason?: string) {
    return freelancerApplicationRepository.update(id, {
      status: "REJECTED",
      rejectionReason,
    });
  },

  async acceptApplication(
    id: string,
    data: {
      username: string;
      password: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      role: "FREELANCER" | "MANAGER";
    }
  ) {
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await userRepository.create({
      email: data.email,
      name: `${data.firstName} ${data.lastName}`,
      passwordHash,
      role: data.role,
      mustChangePassword: true,
    });

    // If freelancer, create profile
    if (data.role === "FREELANCER") {
      await freelancerRepository.create({
        userId: user.id,
      });
    }

    // Update application
    const application = await freelancerApplicationRepository.update(id, {
      status: "ACCEPTED",
      userId: user.id,
    });

    return { user, application };
  },
};
