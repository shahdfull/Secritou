// Service for Comments - SaaS business logic
import { commentRepository } from "../repositories/comment.repository.js";
import { prismaRead } from "../config/prisma.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueNotifications } from "../jobs/queues.js";
import { notifyN8n } from "../utils/webhook.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { extractMentionedUserIds } from "../utils/mentions.js";

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
      const staff = await userRepository.findAdminsAndPoleManagers(task.project?.serviceId ?? null);
      const staffIds = new Set(staff.map((user) => user.id));
      for (const id of staffIds) recipientIds.add(id);
      recipientIds.delete(data.authorId);

      // SEC-060 (mentions @): the standard recipient set above (assignee + pole staff) already
      // covers everyone who has access to this task, so a mention can never reach someone new —
      // it only changes HOW a recipient who was already going to be notified learns about the
      // comment. A mention naming someone without task access (not the assignee, not staff for
      // this pole) is silently dropped rather than notified — this must never become a way to
      // leak a task's existence/content to an arbitrary user by mentioning their id. Decision
      // (session 2026-07-19): mentioned recipients get ONE notification with the more specific
      // "Vous avez été mentionné" wording, not a duplicate second notification alongside the
      // generic one.
      const mentionedIds = new Set(extractMentionedUserIds(data.content).filter((id) => recipientIds.has(id)));

      const taskUrl = `${env.FRONTEND_URL}/app/tasks?taskId=${task.id}`;
      if (recipientIds.size > 0) {
        void enqueueNotifications(
          Array.from(recipientIds).map((userId) => ({
            userId,
            title: mentionedIds.has(userId) ? "Vous avez été mentionné" : "Nouveau commentaire",
            message: mentionedIds.has(userId)
              ? `Vous avez été mentionné dans un commentaire sur la tâche « ${task.title} ».`
              : `Un commentaire a été ajouté sur la tâche « ${task.title} ».`,
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
