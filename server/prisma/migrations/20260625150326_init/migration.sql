-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'CLIENT', 'FREELANCER');

-- CreateEnum
CREATE TYPE "CustomQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OnboardingStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'SIGNED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "SpecApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('NEW', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_CLIENT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('SUPPORT', 'NEW_PROJECT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROPOSAL_SENT', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'PROPOSAL_EXPIRED', 'PROPOSAL_UPDATED', 'APPROVAL_REQUESTED', 'APPROVAL_ACCEPTED', 'APPROVAL_REJECTED', 'INVOICE_SENT', 'INVOICE_OVERDUE', 'PAYMENT_RECEIVED', 'PROJECT_STATUS_CHANGED', 'TASK_ASSIGNED', 'SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_STATUS_CHANGED', 'SERVICE_REQUEST_COMMENT', 'BRIEF_COMPLETED', 'DOCUMENT_SIGNED', 'LEAD_CONVERTED', 'FREELANCER_APPLICATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMMENTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('WELCOME_LETTER', 'CONTRACT', 'SPECS', 'CLIENT_BRIEF', 'QUOTE', 'INVOICE_DEPOSIT', 'INVOICE_BALANCE', 'ROADMAP', 'DELIVERABLE', 'GUIDE', 'REPORT', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('ADMIN_ONLY', 'ADMIN_FREELANCER', 'CLIENT_ADMIN', 'ALL');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'DEPOSIT', 'BALANCE');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "name" VARCHAR(255) NOT NULL,
    "website" VARCHAR(255),
    "logoUrl" VARCHAR(255),
    "primaryColor" VARCHAR(20),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "serviceId" TEXT,
    "resetToken" VARCHAR(255),
    "resetTokenExpiry" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "source" VARCHAR(100),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "serviceId" TEXT,
    "convertedClientId" TEXT,
    "archivedAt" TIMESTAMPTZ(6),
    "sourceContactId" TEXT,
    "assignedManagerId" TEXT,
    "department" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "creditBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "serviceId" TEXT,
    "archivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "ServiceRequestType" NOT NULL DEFAULT 'NEW_PROJECT',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'NEW',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequestComment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "serviceRequestId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ServiceRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequestHistory" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "userId" TEXT,
    "field" VARCHAR(100) NOT NULL,
    "oldValue" VARCHAR(500),
    "newValue" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "clientId" TEXT,
    "serviceId" TEXT,
    "proposalId" TEXT,
    "budget" VARCHAR(255),
    "deadline" TIMESTAMPTZ(6),
    "serviceType" VARCHAR(50),
    "briefData" JSONB,
    "briefCompleted" BOOLEAN NOT NULL DEFAULT false,
    "briefCompletedAt" TIMESTAMPTZ(6),
    "clientApprovedAt" TIMESTAMPTZ(6),
    "clientApprovedById" TEXT,
    "archivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMPTZ(6),
    "projectId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "serviceType" VARCHAR(255) NOT NULL,
    "budget" VARCHAR(255),
    "company" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "convertedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "hourlyRate" DECIMAL(10,2),
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "rating" DECIMAL(2,1),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FreelancerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "url" VARCHAR(255),
    "imageUrl" VARCHAR(255),
    "freelancerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "freelancerId" TEXT NOT NULL,
    "ratedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
    "entityId" VARCHAR(255),
    "link" VARCHAR(500),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "url" VARCHAR(500) NOT NULL,
    "fileUrl" VARCHAR(500),
    "fileKey" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "tags" TEXT[],
    "accessLevel" "DocumentAccessLevel" NOT NULL DEFAULT 'CLIENT_ADMIN',
    "clientId" TEXT,
    "projectId" TEXT,
    "uploadedById" TEXT,
    "signedAt" TIMESTAMPTZ(6),
    "signedByClientId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "familyId" VARCHAR(36) NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerApplication" (
    "id" TEXT NOT NULL,
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "position" VARCHAR(255) NOT NULL,
    "cvUrl" VARCHAR(500) NOT NULL,
    "cvKey" VARCHAR(500),
    "portfolioUrl" VARCHAR(500) NOT NULL,
    "portfolioKey" VARCHAR(500),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "userId" TEXT,
    "accountCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FreelancerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOnboarding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClientOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "stepType" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "OnboardingStepStatus" NOT NULL DEFAULT 'PENDING',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "contractUrl" VARCHAR(500),
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "onboardingStepId" TEXT,
    "invoiceId" TEXT,
    "amount" DECIMAL(10,2),
    "amountPaid" DECIMAL(10,2),
    "method" VARCHAR(100),
    "reference" VARCHAR(255),
    "recordedById" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "deadline" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "serviceType" VARCHAR(100) NOT NULL,
    "data" JSONB,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specifications" (
    "id" TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "requirements" TEXT,
    "objectives" TEXT,
    "features" TEXT,
    "deliverables" TEXT,
    "timeline" TEXT,
    "approvalStatus" "SpecApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffMeeting" (
    "id" TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "meetingDate" TIMESTAMPTZ(6),
    "participants" TEXT,
    "meetingLink" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "KickoffMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionProgress" (
    "id" TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "analysis" INTEGER NOT NULL DEFAULT 0,
    "design" INTEGER NOT NULL DEFAULT 0,
    "development" INTEGER NOT NULL DEFAULT 0,
    "testing" INTEGER NOT NULL DEFAULT 0,
    "deployment" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "onboardingStepId" TEXT NOT NULL,
    "deliverables" TEXT,
    "documentation" VARCHAR(500),
    "accessDetails" TEXT,
    "userGuides" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(12,2),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'TND',
    "expiresAt" TIMESTAMPTZ(6),
    "viewedAt" TIMESTAMPTZ(6),
    "acceptedAt" TIMESTAMPTZ(6),
    "rejectedAt" TIMESTAMPTZ(6),
    "pdfUrl" VARCHAR(500),
    "clientName" VARCHAR(255),
    "email" VARCHAR(255),
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "serviceRequestId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSection" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "proposalId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalHistory" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "comment" TEXT,
    "userId" TEXT,
    "proposalId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMPTZ(6),
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAttachment" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "approvalId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalTimeline" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "comment" TEXT,
    "status" "ApprovalStatus" NOT NULL,
    "userId" TEXT,
    "approvalId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "userId" TEXT,
    "documentId" TEXT NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'TND',
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'STANDARD',
    "dueDate" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "pdfUrl" VARCHAR(500),
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "proposalId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "number" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appliedAt" TIMESTAMPTZ(6),
    "appliedToInvoiceId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReminder" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "sentAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSuccess" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClientSuccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessObjective" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "targetValue" DECIMAL(12,2),
    "currentValue" DECIMAL(12,2),
    "unit" VARCHAR(50),
    "targetDate" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "successId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SuccessObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessMetric" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "initialValue" DECIMAL(12,2) NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(50),
    "successId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SuccessMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricHistory" (
    "id" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessRecommendation" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "priority" "RecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "successId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SuccessRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessTimeline" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "eventType" VARCHAR(100) NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "successId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuccessTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomQuestion" (
    "id" TEXT NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "status" "CustomQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CustomQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomQuestionMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "authorId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomQuestionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FreelancerProfileToSkill" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FreelancerProfileToSkill_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_singleton_key" ON "Company"("singleton");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_resetToken_idx" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_serviceId_idx" ON "User"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sourceContactId_key" ON "Lead"("sourceContactId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_archivedAt_idx" ON "Lead"("archivedAt");

-- CreateIndex
CREATE INDEX "Client_archivedAt_idx" ON "Client"("archivedAt");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE INDEX "ServiceRequest_clientId_idx" ON "ServiceRequest"("clientId");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_createdAt_idx" ON "ServiceRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_createdAt_idx" ON "ServiceRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_assignedToId_idx" ON "ServiceRequest"("assignedToId");

-- CreateIndex
CREATE INDEX "ServiceRequestComment_serviceRequestId_idx" ON "ServiceRequestComment"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceRequestComment_serviceRequestId_isInternal_idx" ON "ServiceRequestComment"("serviceRequestId", "isInternal");

-- CreateIndex
CREATE INDEX "ServiceRequestHistory_serviceRequestId_idx" ON "ServiceRequestHistory"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceRequestHistory_serviceRequestId_createdAt_idx" ON "ServiceRequestHistory"("serviceRequestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_proposalId_key" ON "Project"("proposalId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");

-- CreateIndex
CREATE INDEX "Project_serviceId_idx" ON "Project"("serviceId");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_projectId_assigneeId_idx" ON "Task"("projectId", "assigneeId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_dueDate_status_idx" ON "Task"("dueDate", "status");

-- CreateIndex
CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE INDEX "ContactRequest_createdAt_idx" ON "ContactRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerProfile_userId_key" ON "FreelancerProfile"("userId");

-- CreateIndex
CREATE INDEX "FreelancerProfile_userId_idx" ON "FreelancerProfile"("userId");

-- CreateIndex
CREATE INDEX "FreelancerProfile_userId_createdAt_idx" ON "FreelancerProfile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PortfolioItem_freelancerId_idx" ON "PortfolioItem"("freelancerId");

-- CreateIndex
CREATE INDEX "Rating_freelancerId_idx" ON "Rating"("freelancerId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_tags_idx" ON "Document"("tags");

-- CreateIndex
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "FreelancerApplication_email_idx" ON "FreelancerApplication"("email");

-- CreateIndex
CREATE INDEX "FreelancerApplication_status_idx" ON "FreelancerApplication"("status");

-- CreateIndex
CREATE INDEX "FreelancerApplication_createdAt_idx" ON "FreelancerApplication"("createdAt");

-- CreateIndex
CREATE INDEX "FreelancerApplication_status_createdAt_idx" ON "FreelancerApplication"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerApplication_email_key" ON "FreelancerApplication"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientOnboarding_projectId_key" ON "ClientOnboarding"("projectId");

-- CreateIndex
CREATE INDEX "ClientOnboarding_projectId_idx" ON "ClientOnboarding"("projectId");

-- CreateIndex
CREATE INDEX "ClientOnboarding_clientId_idx" ON "ClientOnboarding"("clientId");

-- CreateIndex
CREATE INDEX "OnboardingStep_onboardingId_idx" ON "OnboardingStep"("onboardingId");

-- CreateIndex
CREATE INDEX "OnboardingStep_onboardingId_orderIndex_idx" ON "OnboardingStep"("onboardingId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_onboardingStepId_key" ON "Contract"("onboardingStepId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_onboardingStepId_key" ON "Payment"("onboardingStepId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "Questionnaire_onboardingStepId_key" ON "Questionnaire"("onboardingStepId");

-- CreateIndex
CREATE UNIQUE INDEX "Specifications_onboardingStepId_key" ON "Specifications"("onboardingStepId");

-- CreateIndex
CREATE UNIQUE INDEX "KickoffMeeting_onboardingStepId_key" ON "KickoffMeeting"("onboardingStepId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionProgress_onboardingStepId_key" ON "ProductionProgress"("onboardingStepId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_onboardingStepId_key" ON "Delivery"("onboardingStepId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_serviceRequestId_key" ON "Proposal"("serviceRequestId");

-- CreateIndex
CREATE INDEX "Proposal_clientId_idx" ON "Proposal"("clientId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_expiresAt_idx" ON "Proposal"("expiresAt");

-- CreateIndex
CREATE INDEX "Proposal_createdAt_idx" ON "Proposal"("createdAt");

-- CreateIndex
CREATE INDEX "Proposal_serviceRequestId_idx" ON "Proposal"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ProposalSection_proposalId_idx" ON "ProposalSection"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalSection_proposalId_orderIndex_idx" ON "ProposalSection"("proposalId", "orderIndex");

-- CreateIndex
CREATE INDEX "ProposalHistory_proposalId_idx" ON "ProposalHistory"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalHistory_proposalId_createdAt_idx" ON "ProposalHistory"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_clientId_idx" ON "Approval"("clientId");

-- CreateIndex
CREATE INDEX "Approval_status_idx" ON "Approval"("status");

-- CreateIndex
CREATE INDEX "Approval_dueDate_idx" ON "Approval"("dueDate");

-- CreateIndex
CREATE INDEX "Approval_createdAt_idx" ON "Approval"("createdAt");

-- CreateIndex
CREATE INDEX "ApprovalAttachment_approvalId_idx" ON "ApprovalAttachment"("approvalId");

-- CreateIndex
CREATE INDEX "ApprovalTimeline_approvalId_idx" ON "ApprovalTimeline"("approvalId");

-- CreateIndex
CREATE INDEX "ApprovalTimeline_approvalId_createdAt_idx" ON "ApprovalTimeline"("approvalId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_documentId_idx" ON "DocumentAccessLog"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_userId_idx" ON "DocumentAccessLog"("userId");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_documentId_createdAt_idx" ON "DocumentAccessLog"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_proposalId_key" ON "Invoice"("proposalId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_invoiceType_idx" ON "Invoice"("invoiceType");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "Invoice_status_createdAt_idx" ON "Invoice"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_number_idx" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_number_key" ON "CreditNote"("number");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_clientId_idx" ON "CreditNote"("clientId");

-- CreateIndex
CREATE INDEX "CreditNote_appliedToInvoiceId_idx" ON "CreditNote"("appliedToInvoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceReminder_invoiceId_idx" ON "InvoiceReminder"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSuccess_clientId_key" ON "ClientSuccess"("clientId");

-- CreateIndex
CREATE INDEX "ClientSuccess_clientId_idx" ON "ClientSuccess"("clientId");

-- CreateIndex
CREATE INDEX "SuccessObjective_successId_idx" ON "SuccessObjective"("successId");

-- CreateIndex
CREATE INDEX "SuccessMetric_successId_idx" ON "SuccessMetric"("successId");

-- CreateIndex
CREATE INDEX "MetricHistory_metricId_idx" ON "MetricHistory"("metricId");

-- CreateIndex
CREATE INDEX "MetricHistory_metricId_date_idx" ON "MetricHistory"("metricId", "date");

-- CreateIndex
CREATE INDEX "SuccessRecommendation_successId_idx" ON "SuccessRecommendation"("successId");

-- CreateIndex
CREATE INDEX "SuccessRecommendation_successId_priority_idx" ON "SuccessRecommendation"("successId", "priority");

-- CreateIndex
CREATE INDEX "SuccessTimeline_successId_idx" ON "SuccessTimeline"("successId");

-- CreateIndex
CREATE INDEX "SuccessTimeline_successId_date_idx" ON "SuccessTimeline"("successId", "date");

-- CreateIndex
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");

-- CreateIndex
CREATE INDEX "AiConversation_userId_createdAt_idx" ON "AiConversation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_idx" ON "AiMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomQuestion_userId_idx" ON "CustomQuestion"("userId");

-- CreateIndex
CREATE INDEX "CustomQuestion_status_idx" ON "CustomQuestion"("status");

-- CreateIndex
CREATE INDEX "CustomQuestion_createdAt_idx" ON "CustomQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "CustomQuestionMessage_questionId_idx" ON "CustomQuestionMessage"("questionId");

-- CreateIndex
CREATE INDEX "CustomQuestionMessage_questionId_createdAt_idx" ON "CustomQuestionMessage"("questionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionProfile_name_key" ON "PermissionProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerPermission_userId_key" ON "ManagerPermission"("userId");

-- CreateIndex
CREATE INDEX "_FreelancerProfileToSkill_B_index" ON "_FreelancerProfileToSkill"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceContactId_fkey" FOREIGN KEY ("sourceContactId") REFERENCES "ContactRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestHistory" ADD CONSTRAINT "ServiceRequestHistory_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestHistory" ADD CONSTRAINT "ServiceRequestHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientApprovedById_fkey" FOREIGN KEY ("clientApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerProfile" ADD CONSTRAINT "FreelancerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_signedByClientId_fkey" FOREIGN KEY ("signedByClientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerApplication" ADD CONSTRAINT "FreelancerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_onboardingStepId_fkey" FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_onboardingStepId_fkey" FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_onboardingStepId_fkey" FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specifications" ADD CONSTRAINT "Specifications_onboardingStepId_fkey" FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffMeeting" ADD CONSTRAINT "KickoffMeeting_onboardingStepId_fkey" FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionProgress" ADD CONSTRAINT "ProductionProgress_onboardingStepId_fkey" FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_onboardingStepId_fkey" FOREIGN KEY ("onboardingStepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalHistory" ADD CONSTRAINT "ProposalHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalHistory" ADD CONSTRAINT "ProposalHistory_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTimeline" ADD CONSTRAINT "ApprovalTimeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTimeline" ADD CONSTRAINT "ApprovalTimeline_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_appliedToInvoiceId_fkey" FOREIGN KEY ("appliedToInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSuccess" ADD CONSTRAINT "ClientSuccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessObjective" ADD CONSTRAINT "SuccessObjective_successId_fkey" FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessMetric" ADD CONSTRAINT "SuccessMetric_successId_fkey" FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricHistory" ADD CONSTRAINT "MetricHistory_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "SuccessMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessRecommendation" ADD CONSTRAINT "SuccessRecommendation_successId_fkey" FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessTimeline" ADD CONSTRAINT "SuccessTimeline_successId_fkey" FOREIGN KEY ("successId") REFERENCES "ClientSuccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomQuestion" ADD CONSTRAINT "CustomQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomQuestionMessage" ADD CONSTRAINT "CustomQuestionMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomQuestionMessage" ADD CONSTRAINT "CustomQuestionMessage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CustomQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerPermission" ADD CONSTRAINT "ManagerPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerPermission" ADD CONSTRAINT "ManagerPermission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FreelancerProfileToSkill" ADD CONSTRAINT "_FreelancerProfileToSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FreelancerProfileToSkill" ADD CONSTRAINT "_FreelancerProfileToSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
