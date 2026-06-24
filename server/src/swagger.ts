import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Secritou Platform API",
      version: "1.0.0",
      description: "Multi-tenant project management platform",
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
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "name", "email", "createdAt", "updatedAt"],
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
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "name", "email", "status", "createdAt", "updatedAt"],
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
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "name", "status", "createdAt", "updatedAt"],
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
          required: ["id", "number", "status", "amount", "dueDate", "clientId", "createdAt", "updatedAt"],
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
              enum: ["NEW", "IN_REVIEW", "IN_PROGRESS", "WAITING_CLIENT", "COMPLETED", "CANCELLED"],
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
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: ["id", "title", "status", "priority", "clientId", "createdAt", "updatedAt"],
        },
      },
    },
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Users", description: "User management" },
      { name: "Clients", description: "Client management" },
      { name: "Leads", description: "Lead management" },
      { name: "Projects", description: "Project management" },
      { name: "Tasks", description: "Task management" },
      { name: "Freelancers", description: "Freelancer profiles" },
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
