/**
 * Reusable OpenAPI Schemas and Components
 */

export const swaggerSchemas = {
  /**
   * Common response components
   */
  responses: {
    Conflict: {
      description: "Resource conflict (e.g., already exists)",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    UnprocessableEntity: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    RateLimited: {
      description: "Too many requests",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    InternalServerError: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    NoContent: {
      description: "Successfully deleted",
    },
  },

  /**
   * Common parameters
   */
  parameters: {
    id: {
      name: "id",
      in: "path" as const,
      required: true,
      schema: {
        type: "string",
        format: "uuid",
      },
    },
    page: {
      name: "page",
      in: "query" as const,
      schema: {
        type: "integer",
        default: 1,
        minimum: 1,
      },
    },
    pageSize: {
      name: "pageSize",
      in: "query" as const,
      schema: {
        type: "integer",
        default: 10,
        minimum: 1,
        maximum: 100,
      },
    },
    search: {
      name: "search",
      in: "query" as const,
      schema: {
        type: "string",
      },
      description: "Search query string",
    },
  },

  /**
   * Common request bodies
   */
  requestBodies: {
    CreateProject: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          minLength: 1,
          maxLength: 255,
        },
        description: {
          type: "string",
          maxLength: 2000,
        },
      },
    },
    CreateTask: {
      type: "object",
      required: ["title", "projectId"],
      properties: {
        title: {
          type: "string",
          minLength: 1,
          maxLength: 255,
        },
        description: {
          type: "string",
          maxLength: 2000,
        },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"],
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
        },
      },
    },
    CreateClient: {
      type: "object",
      required: ["name", "email"],
      properties: {
        name: {
          type: "string",
          minLength: 1,
          maxLength: 255,
        },
        email: {
          type: "string",
          format: "email",
        },
      },
    },
    CreateLead: {
      type: "object",
      required: ["name", "email"],
      properties: {
        name: {
          type: "string",
          minLength: 1,
          maxLength: 255,
        },
        email: {
          type: "string",
          format: "email",
        },
        phone: {
          type: "string",
        },
        status: {
          type: "string",
          enum: ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"],
          default: "NEW",
        },
      },
    },
    CreateInvoice: {
      type: "object",
      required: ["number", "amount", "dueDate", "clientId"],
      properties: {
        number: {
          type: "string",
          example: "INV-2024-001",
        },
        amount: {
          type: "number",
          format: "decimal",
          minimum: 0,
        },
        dueDate: {
          type: "string",
          format: "date",
        },
        clientId: {
          type: "string",
          format: "uuid",
        },
        description: {
          type: "string",
          maxLength: 2000,
        },
      },
    },
    CreateServiceRequest: {
      type: "object",
      required: ["title"],
      properties: {
        title: {
          type: "string",
          minLength: 1,
          maxLength: 255,
        },
        description: {
          type: "string",
          maxLength: 2000,
        },
        priority: {
          type: "string",
          enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
          default: "NORMAL",
        },
      },
    },
  },
};
