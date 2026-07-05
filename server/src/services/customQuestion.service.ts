import { prisma } from "../config/prisma.js";
import { enqueueEmail } from "../jobs/queues.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { customQuestionReceivedTemplate, customQuestionAdminNotificationTemplate, customQuestionAnsweredTemplate } from "./emailTemplates/index.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import type { CustomQuestionStatus, Role, Prisma } from "@prisma/client";
import type { CreateCustomQuestionInput } from "../validators/customQuestion.validator.js";

const messageWithAuthor = {
  include: { author: { select: { id: true, name: true, role: true } } },
} satisfies Prisma.CustomQuestionMessageDefaultArgs;

const isStaff = (role: Role): boolean => role === "ADMIN" || role === "MANAGER";

class CustomQuestionService {
  async createQuestion(userId: string, input: CreateCustomQuestionInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
    if (!user) throw new HttpError(404, "User not found");

    const question = await prisma.customQuestion.create({
      data: {
        subject: input.subject,
        userId: user.id,
        messages: { create: { content: input.message, authorRole: user.role, authorId: user.id } },
      },
      include: { messages: messageWithAuthor },
    });

    const portalUrl = `${env.FRONTEND_URL}/client/questions/${question.id}`;
    const dashboardUrl = `${env.FRONTEND_URL}/app/questions/${question.id}`;

    const received = customQuestionReceivedTemplate({ userName: user.name ?? "Client", subject: input.subject, questionContent: input.message, portalUrl });
    void enqueueEmail({ to: user.email, subject: received.subject, html: received.html });

    const adminHtml = customQuestionAdminNotificationTemplate({ adminName: "Admin", userName: user.name ?? "Client", userEmail: user.email, subject: input.subject, questionContent: input.message, dashboardUrl });
    void enqueueEmail({ to: env.CONTACT_RECEIVER_EMAIL, subject: `Nouvelle question : ${input.subject}`, html: adminHtml, replyTo: user.email });

    try {
      const admins = await userRepository.findAdmins();
      if (admins.length > 0) {
        await notificationRepository.createMany(admins.map((admin) => ({ userId: admin.id, title: "Nouvelle question", message: `${user.name ?? "Un client"} a posé une question : "${input.subject}"`, link: `/app/questions/${question.id}` })));
      }
    } catch {
      // notifications are best-effort
    }

    return question;
  }

  async getMyQuestions(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const [questions, total] = await Promise.all([
      prisma.customQuestion.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, skip, take: safeLimit, include: { messages: { orderBy: { createdAt: "asc" }, take: 1 }, _count: { select: { messages: true } } } }),
      prisma.customQuestion.count({ where: { userId } }),
    ]);

    return { data: questions, meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) } };
  }

  async getQuestionById(questionId: string, requestingUserId: string, requestingUserRole: Role) {
    const question = await prisma.customQuestion.findUnique({
      where: { id: questionId },
      include: { user: { select: { id: true, name: true, email: true } }, messages: { ...messageWithAuthor, orderBy: { createdAt: "asc" } } },
    });
    if (!question) throw new HttpError(404, "Question not found");
    if (!isStaff(requestingUserRole) && question.userId !== requestingUserId) throw new HttpError(403, "You can only view your own questions");
    return question;
  }

  async getAllQuestions(filters: { status?: CustomQuestionStatus } = {}, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.CustomQuestionWhereInput = { ...(filters.status ? { status: filters.status } : {}) };

    const [questions, total] = await Promise.all([
      prisma.customQuestion.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take: safeLimit, include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } } }),
      prisma.customQuestion.count({ where }),
    ]);

    return { data: questions, meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) } };
  }

  async addMessage(questionId: string, authorId: string, authorRole: Role, content: string) {
    const question = await prisma.customQuestion.findUnique({ where: { id: questionId }, include: { user: { select: { id: true, name: true, email: true } } } });
    if (!question) throw new HttpError(404, "Question not found");

    const staff = isStaff(authorRole);
    if (!staff && question.userId !== authorId) throw new HttpError(403, "You can only reply to your own questions");
    if (question.status === "CLOSED") throw new HttpError(422, "This question is closed");

    const message = await prisma.customQuestionMessage.create({ data: { content, authorRole, authorId, questionId }, include: messageWithAuthor.include });

    await prisma.customQuestion.update({ where: { id: questionId }, data: staff ? { status: "ANSWERED" } : { updatedAt: new Date() } });

    if (staff) {
      const portalUrl = `${env.FRONTEND_URL}/client/questions/${questionId}`;
      const answered = customQuestionAnsweredTemplate({ userName: question.user.name ?? "Client", subject: question.subject, adminReply: content, portalUrl });
      void enqueueEmail({ to: question.user.email, subject: answered.subject, html: answered.html });
      try {
        await notificationRepository.create({ userId: question.userId, title: "Réponse à votre question", message: `Nous avons répondu à votre question : "${question.subject}"`, link: `/client/questions/${questionId}` });
      } catch {
        // best effort
      }
    }

    return message;
  }

  async updateStatus(questionId: string, status: CustomQuestionStatus) {
    const exists = await prisma.customQuestion.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!exists) throw new HttpError(404, "Question not found");
    return prisma.customQuestion.update({ where: { id: questionId }, data: { status } });
  }
}

export const customQuestionService = new CustomQuestionService();