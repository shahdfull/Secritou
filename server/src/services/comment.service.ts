// Service for Comments - SaaS business logic
import { commentRepository } from "../repositories/comment.repository.js";
import { prismaRead } from "../config/prisma.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { notifyN8n } from "../utils/webhook.js";
import { env } from "../config/env.js";

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
};
