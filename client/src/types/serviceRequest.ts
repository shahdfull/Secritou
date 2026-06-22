export type ServiceRequestStatus =
  | "NEW"
  | "IN_REVIEW"
  | "IN_PROGRESS"
  | "WAITING_CLIENT"
  | "COMPLETED"
  | "CANCELLED";

export type ServiceRequestPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface ServiceRequest {
  id: string;
  title: string;
  description?: string;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  clientId: string;
  companyId: string;
  assignedToId?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string };
  assignedTo?: { id: string; name: string; email: string } | null;
  proposal?: { id: string; title: string } | null;
}

export interface ServiceRequestComment {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; role: string };
}

export interface ServiceRequestHistory {
  id: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

export interface ServiceRequestDetail extends ServiceRequest {
  comments: ServiceRequestComment[];
  history: ServiceRequestHistory[];
}

export interface CreateServiceRequestInput {
  title: string;
  description?: string;
  type?: "SUPPORT" | "NEW_PROJECT";
}

export interface AdminUpdateServiceRequestInput {
  title?: string;
  description?: string | null;
  status?: ServiceRequestStatus;
  priority?: ServiceRequestPriority;
  assignedToId?: string | null;
}

export interface AddCommentInput {
  body: string;
  isInternal?: boolean;
}

export interface AdminListServiceRequestsParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  search?: string;
  status?: ServiceRequestStatus;
  clientId?: string;
  assignedToId?: string;
  priority?: ServiceRequestPriority;
}
