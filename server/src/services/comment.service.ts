// Service for Comments - SaaS business logic
import { commentRepository } from "../repositories/comment.repository.js";
import { COMPANY_ID } from "../config/constants.js";

export const commentService = {
  async createComment(data: {
    content: string;
    taskId: string;
    authorId: string;
  }) {
    return commentRepository.create(data);
  },

  async getCommentsByTaskId(taskId: string) {
    return commentRepository.findByTaskId(taskId, COMPANY_ID);
  },
};
