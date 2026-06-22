import apiClient from "./axios";

export type CustomQuestionStatus = "OPEN" | "ANSWERED" | "CLOSED";

export type CustomQuestionMessage = {
  id: string;
  content: string;
  authorRole: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER";
  authorId: string;
  questionId: string;
  createdAt: string;
  author?: { id: string; name: string; role: string };
};

export type CustomQuestionUser = {
  id: string;
  name: string;
  email: string;
};

export type CustomQuestion = {
  id: string;
  subject: string;
  status: CustomQuestionStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: CustomQuestionUser;
  messages?: CustomQuestionMessage[];
  _count?: { messages: number };
};

export type PaginatedCustomQuestions = {
  data: CustomQuestion[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

type ListParams = { status?: string; page?: number; limit?: number };

function buildQuery(params: ListParams = {}): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const customQuestionsApi = {
  create: async (data: { subject: string; message: string }): Promise<CustomQuestion> => {
    const res = await apiClient.post<{ data: CustomQuestion }>("/custom-questions", data);
    return res.data.data;
  },

  getMy: async (params: ListParams = {}): Promise<PaginatedCustomQuestions> => {
    const res = await apiClient.get<PaginatedCustomQuestions>(`/custom-questions/my${buildQuery(params)}`);
    return res.data;
  },

  getById: async (id: string): Promise<CustomQuestion> => {
    const res = await apiClient.get<{ data: CustomQuestion }>(`/custom-questions/${id}`);
    return res.data.data;
  },

  getAll: async (params: ListParams = {}): Promise<PaginatedCustomQuestions> => {
    const res = await apiClient.get<PaginatedCustomQuestions>(`/custom-questions${buildQuery(params)}`);
    return res.data;
  },

  addMessage: async (id: string, data: { content: string }): Promise<CustomQuestionMessage> => {
    const res = await apiClient.post<{ data: CustomQuestionMessage }>(
      `/custom-questions/${id}/messages`,
      data
    );
    return res.data.data;
  },

  updateStatus: async (id: string, status: CustomQuestionStatus): Promise<CustomQuestion> => {
    const res = await apiClient.patch<{ data: CustomQuestion }>(`/custom-questions/${id}/status`, {
      status,
    });
    return res.data.data;
  },
};
