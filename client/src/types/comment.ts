import { User } from "./auth";

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  author: User;
  createdAt: string;
}

export interface CreateCommentInput {
  content: string;
}
