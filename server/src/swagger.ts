import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Secritou Platform API",
      version: "1.0.0",
      description: "Multi-tenant freelancer marketplace and project management platform",
      contact: {
        name: "Secritou Team",
        url: "https://secritou.com",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:5000/api/v1",
        description: "Development server",
      },
      {
        url: "https://api.secritou.com/api/v1",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT access token. Format: Bearer <token>",
        },
      },
      responses: {
        BadRequest: {
          description: "Bad request - validation error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: {
                statusCode: 400,
                message: "Validation failed",
                details: { field: "email", issue: "Invalid email format" },
              },
            },
          },
        },
        Unauthorized: {
          description: "Missing or invalid authentication token",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: {
                statusCode: 401,
                message: "Unauthorized",
              },
            },
          },
        },
        Forbidden: {
          description: "Insufficient permissions for this resource",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: {
                statusCode: 403,
                message: "Forbidden",
              },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: {
                statusCode: 404,
                message: "Resource not found",
              },
            },
          },
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            statusCode: {
              type: "integer",
              example: 400,
            },
            message: {
              type: "string",
              example: "Invalid request",
            },
            details: {
              type: "object",
              example: { field: "email", issue: "Invalid email format" },
            },
          },
          required: ["statusCode", "message"],
        },
        PaginationMeta: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              example: 1,
            },
            pageSize: {
              type: "integer",
              example: 10,
            },
            total: {
              type: "integer",
              example: 100,
            },
          },
          required: ["page", "pageSize", "total"],
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            name: {
              type: "string",
              example: "John Doe",
            },
            role: {
              type: "string",
              enum: ["ADMIN", "MANAGER", "CLIENT", "FREELANCER"],
              example: "CLIENT",
            },
            companyId: {
              type: "string",
              format: "uuid",
              nullable: true,
            },
            clientId: {
              type: "string",
              format: "uuid",
              nullable: true,
            },
            mustChangePassword: {
              type: "boolean",
              example: false,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "email", "name", "role", "createdAt", "updatedAt"],
        },
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
          required: ["accessToken"],
        },
        Company: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            name: {
              type: "string",
              example: "Acme Corp",
            },
            website: {
              type: "string",
              format: "uri",
              nullable: true,
            },
            logoUrl: {
              type: "string",
              format: "uri",
              nullable: true,
            },
            primaryColor: {
              type: "string",
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "name", "createdAt", "updatedAt"],
        },
        Client: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            name: {
              type: "string",
              example: "Jane Smith",
            },
            email: {
              type: "string",
              format: "email",
            },
            companyId: {
              type: "string",
              format: "uuid",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "name", "email", "companyId", "createdAt", "updatedAt"],
        },
        Lead: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            name: {
              type: "string",
              example: "New Lead",
            },
            email: {
              type: "string",
              format: "email",
            },
            phone: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
              enum: ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"],
              example: "NEW",
            },
            companyId: {
              type: "string",
              format: "uuid",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "name", "email", "status", "companyId", "createdAt", "updatedAt"],
        },
        Project: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            name: {
              type: "string",
              example: "Website Redesign",
            },
            description: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
              enum: ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"],
              example: "IN_PROGRESS",
            },
            companyId: {
              type: "string",
              format: "uuid",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "name", "status", "companyId", "createdAt", "updatedAt"],
        },
        Task: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            title: {
              type: "string",
              example: "Implement homepage",
            },
            description: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
              enum: ["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"],
              example: "TODO",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              nullable: true,
            },
            projectId: {
              type: "string",
              format: "uuid",
            },
            assignedTo: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
              },
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "title", "status", "projectId", "createdAt", "updatedAt"],
        },
        FreelancerProfile: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            userId: {
              type: "string",
              format: "uuid",
            },
            bio: {
              type: "string",
              nullable: true,
            },
            hourlyRate: {
              type: "number",
              format: "decimal",
              nullable: true,
              example: 75.5,
            },
            availability: {
              type: "boolean",
              example: true,
            },
            rating: {
              type: "number",
              format: "decimal",
              nullable: true,
              minimum: 1,
              maximum: 5,
              example: 4.5,
            },
            reviewCount: {
              type: "integer",
              example: 12,
            },
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "userId", "availability", "reviewCount", "createdAt", "updatedAt"],
        },
        Invoice: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            number: {
              type: "string",
              example: "INV-2024-001",
            },
            status: {
              type: "string",
              enum: ["DRAFT", "SENT", "PAID", "CANCELLED", "OVERDUE"],
              example: "SENT",
            },
            amount: {
              type: "number",
              format: "decimal",
              example: 5000,
            },
            dueDate: {
              type: "string",
              format: "date",
            },
            companyId: {
              type: "string",
              format: "uuid",
            },
            clientId: {
              type: "string",
              format: "uuid",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "number", "status", "amount", "dueDate", "companyId", "clientId", "createdAt", "updatedAt"],
        },
        ServiceRequest: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            title: {
              type: "string",
              example: "Need UI design",
            },
            description: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
              enum: ["NEW", "IN_REVIEW", "IN_PROGRESS", "WAITING_CLIENT", "COMPLETED", "CANCELLED", "DONE"],
              example: "NEW",
            },
            priority: {
              type: "string",
              enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
              example: "NORMAL",
            },
            clientId: {
              type: "string",
              format: "uuid",
            },
            companyId: {
              type: "string",
              format: "uuid",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "title", "status", "priority", "clientId", "companyId", "createdAt", "updatedAt"],
        },
      },
    },
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Users", description: "User management" },
      { name: "Companies", description: "Company management" },
      { name: "Clients", description: "Client management" },
      { name: "Leads", description: "Lead management" },
      { name: "Projects", description: "Project management" },
      { name: "Tasks", description: "Task management" },
      { name: "Freelancers", description: "Freelancer profiles" },
      { name: "Ratings", description: "Freelancer ratings and reviews" },
      { name: "Invoices", description: "Invoice management" },
      { name: "Service Requests", description: "Service request management" },
      { name: "Notifications", description: "Notification management" },
      { name: "Health", description: "Health check endpoints" },
    ],
  },
  apis: [
    "src/routes/*.ts",
    "src/controllers/*.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
