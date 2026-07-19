// Service for Comments - SaaS business logic
import { commentRepository } from "../repositories/comment.repository.js";
import { prismaRead } from "../config/prisma.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { notifyN8n } from "../utils/webhook.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const EXCERPT_LENGTH = 150;

export const commentService = {
  async createComment(data: {
    content: string;
    taskId: string;
    authorId: string;
  }) {
    const comment = await commentRepository.create(data);

    // Resolve who's concerned by this task's comment thread — same "assignee + pole staff"
    // pattern already used for task deadline/overdue alerts (ceoAlerts.processor.ts), minus
    // the comment's own author so they don't get notified of their own message.
    const task = await prismaRead.task.findUnique({
      where: { id: data.taskId },
      select: { id: true, title: true, assigneeId: true, project: { select: { serviceId: true } } },
    });

    if (task) {
      const recipientIds = new Set<string>();
      if (task.assigneeId) recipientIds.add(task.assigneeId);
      for (const user of await userRepository.findAdminsAndPoleManagers(task.project?.serviceId ?? null)) {
        recipientIds.add(user.id);
      }
      recipientIds.delete(data.authorId);

      const taskUrl = `${env.FRONTEND_URL}/app/tasks?taskId=${task.id}`;
      if (recipientIds.size > 0) {
        void enqueueNotifications(
          Array.from(recipientIds).map((userId) => ({
            userId,
            title: "Nouveau commentaire",
            message: `Un commentaire a été ajouté sur la tâche « ${task.title} ».`,
            type: "GENERAL" as const,
            entityId: comment.id,
            link: taskUrl,
          }))
        );
      }

      void notifyN8n("comment.new", {
        commentId: comment.id,
        taskId: task.id,
        authorId: data.authorId,
        authorName: comment.author?.name,
        excerpt: data.content.length > EXCERPT_LENGTH ? `${data.content.slice(0, EXCERPT_LENGTH)}…` : data.content,
        adminUrl: taskUrl,
      });
    }

    return comment;
  },

  async getCommentsByTaskId(taskId: string) {
    return commentRepository.findByTaskId(taskId);
  },

  // SEC-059: update/delete were entirely absent — only createComment/getCommentsByTaskId existed.
  // Authorization mirrors projectMeetingService.update/.delete (SEC-055/F6): the comment's own
  // author may edit/delete it; an ADMIN may edit/delete any (a MANAGER of the same pole who
  // didn't write the comment doesn't get to alter someone else's remark just by sharing task
  // access — requirePermission alone wouldn't distinguish this).
  async updateComment(taskId: string, commentId: string, content: string, actorId: string, actorRole: string) {
    const comment = await commentRepository.findById(commentId);
    if (!comment || comment.taskId !== taskId) throw new HttpError(404, "Comment not found");
    if (actorRole !== "ADMIN" && comment.authorId !== actorId) {
      throw new HttpError(403, "You can only edit your own comments", "COMMENT_NOT_YOURS");
    }
    return commentRepository.update(commentId, content);
  },

  async deleteComment(taskId: string, commentId: string, actorId: string, actorRole: string) {
    const comment = await commentRepository.findById(commentId);
    if (!comment || comment.taskId !== taskId) throw new HttpError(404, "Comment not found");
    if (actorRole !== "ADMIN" && comment.authorId !== actorId) {
      throw new HttpError(403, "You can only delete your own comments", "COMMENT_NOT_YOURS");
    }
    return commentRepository.delete(commentId);
  },
};
