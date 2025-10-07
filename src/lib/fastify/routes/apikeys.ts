import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { AuthUtils } from "../utils/auth";
import { tokenBlacklist } from "../utils/token-blacklist";

// Define interfaces for request bodies
interface CreateApiKeyBody {
  email?: string;
  password?: string;
}

interface UpdateApiKeyBody {
  status: boolean;
}

// Define response interfaces
interface ApiKeyResponse {
  id: string;
  userId: string;
  token?: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
}

interface CreateApiKeyResponse extends ApiKeyResponse {
  tokenPreview?: string;
}

// API Key Authentication middleware
const apiKeyAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const apiKey = request.headers["x-api-key"] as string;

  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      message: "API key is required in x-api-key header",
    });
  }

  try {
    // Check if the plain API key exists and is active in the database
    const apiKeyRecord = await request.server.prisma.apikeys.findFirst({
      where: {
        token: apiKey, // Compare with the stored plain token
        status: true,
      },
      include: {
        users: true,
      },
    });

    if (!apiKeyRecord || !apiKeyRecord.users) {
      return reply.status(401).send({
        success: false,
        message: "Invalid or inactive API key",
      });
    }

    // Attach user info to request for use in route handlers
    (request as any).apiKeyUser = apiKeyRecord.users;
    (request as any).apiKeyRecord = apiKeyRecord;
  } catch (error) {
    request.log.error("API key authentication error:", error);
    return reply.status(500).send({
      success: false,
      message: "Internal server error during API key authentication",
    });
  }
};

export default async function apiKeyRoutes(fastify: FastifyInstance) {
  // Create New API Key
  fastify.post<{ Body: CreateApiKeyBody }>(
    "/apikeys",
    {
      schema: {
        tags: ["API Keys"],
        description:
          "Create a new API key for the user. Can authenticate with existing API key or email/password.",
        body: {
          type: "object",
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email (for email/password auth)",
            },
            password: {
              type: "string",
              description: "User password (for email/password auth)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  userId: { type: "string" },
                  status: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                  tokenPreview: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { email, password } = request.body;

        // Check if user is authenticated via an existing API key first
        let user = (request as any).apiKeyUser;

        // If not authenticated via API key, check for email/password authentication
        if (!user && email && password) {
          const foundUser = await fastify.prisma.users.findUnique({
            where: { email },
          });

          if (!foundUser || !foundUser.password) {
            return reply.status(401).send({
              success: false,
              message: "Invalid email or password",
            });
          }

          const isValidPassword = await AuthUtils.comparePassword(
            password,
            foundUser.password
          );
          if (!isValidPassword) {
            return reply.status(401).send({
              success: false,
              message: "Invalid email or password",
            });
          }

          user = foundUser;
        }

        // If no user was found through either method, return unauthorized
        if (!user) {
          return reply.status(401).send({
            success: false,
            message:
              "Authentication required. Provide either a valid API key or email/password.",
          });
        }

        // Generate a new API key token (256-bit random hexadecimal)
        const apiKeyToken = `wapi_${crypto.randomBytes(32).toString("hex")}`;
        // Store the plain token directly (for compatibility with existing database records)
        const plainApiKey = apiKeyToken;

        // Create the API key in the database
        const newApiKey = await fastify.prisma.apikeys.create({
          data: {
            userId: user.id,
            token: plainApiKey, // Store the plain token, not the hash
            status: true,
            description: "Created via API",
          },
        });

        // Return the new API key with a preview of the token
        const response: CreateApiKeyResponse = {
          id: newApiKey.id,
          userId: newApiKey.userId,
          status: newApiKey.status,
          createdAt: newApiKey.createdAt,
          updatedAt: newApiKey.updatedAt,
          tokenPreview: `${newApiKey.token?.substring(0, 8)}...`,
        };

        return reply.status(201).send({
          success: true,
          message: "API key created successfully",
          data: response,
        });
      } catch (error) {
        fastify.log.error({ error }, "Create API key error");
        return reply.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // Get User API Keys
  fastify.get(
    "/apikeys",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["API Keys"],
        summary: "Get user API keys",
        description: "Retrieve all API keys for the authenticated user.",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    token: { type: "string" }, // Will be masked
                    status: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = (request as any).apiKeyUser;

        // Get all API keys for the user (mask actual token value for security)
        const userApiKeys = await fastify.prisma.apikeys.findMany({
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            token: false, // Don't return the actual token
            status: true,
            createdAt: true,
            updatedAt: true,
            description: true,
          },
        });

        // Format response with masked token
        const response = userApiKeys.map((key) => ({
          id: key.id,
          token: "***",
          status: key.status,
          createdAt: key.createdAt,
          updatedAt: key.updatedAt,
          description: key.description,
        }));

        return reply.send({
          success: true,
          message: "API keys retrieved successfully",
          data: response,
        });
      } catch (error) {
        fastify.log.error({ error }, "Get API keys error");
        return reply.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // Update API Key Status
  fastify.put<{ Params: { keyId: string }; Body: UpdateApiKeyBody }>(
    "/apikeys/:keyId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["API Keys"],
        summary: "Update API key status",
        description: "Update the status of an API key (activate/deactivate).",
        params: {
          type: "object",
          required: ["keyId"],
          properties: {
            keyId: {
              type: "string",
              description: "ID of the API key to update",
            },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "boolean",
              description:
                "New status for the API key (true for active, false for inactive)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  userId: { type: "string" },
                  token: { type: "string" },
                  status: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { keyId } = request.params;
        const { status } = request.body;
        const currentUser = (request as any).apiKeyUser;

        // Check if the API key exists and belongs to the current user
        const apiKey = await fastify.prisma.apikeys.findFirst({
          where: {
            id: keyId,
            userId: currentUser.id,
          },
        });

        if (!apiKey) {
          return reply.status(404).send({
            success: false,
            message: "API key not found or does not belong to you",
          });
        }

        // Update the API key status
        const updatedApiKey = await fastify.prisma.apikeys.update({
          where: {
            id: keyId,
          },
          data: {
            status: status,
          },
        });

        // Format response with masked token
        const response: ApiKeyResponse = {
          id: updatedApiKey.id,
          userId: updatedApiKey.userId,
          token: "***",
          status: updatedApiKey.status,
          createdAt: updatedApiKey.createdAt,
          updatedAt: updatedApiKey.updatedAt,
        };

        return reply.send({
          success: true,
          message: "API key status updated successfully",
          data: response,
        });
      } catch (error) {
        fastify.log.error({ error }, "Update API key error");
        return reply.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // Delete API Key
  fastify.delete<{ Params: { keyId: string } }>(
    "/apikeys/:keyId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["API Keys"],
        summary: "Delete API key",
        description: "Permanently delete an API key.",
        params: {
          type: "object",
          required: ["keyId"],
          properties: {
            keyId: {
              type: "string",
              description: "ID of the API key to delete",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: { type: "object", properties: {} },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { keyId } = request.params;
        const currentUser = (request as any).apiKeyUser;

        // Check if the API key exists and belongs to the current user
        const apiKey = await fastify.prisma.apikeys.findFirst({
          where: {
            id: keyId,
            userId: currentUser.id,
          },
        });

        if (!apiKey) {
          return reply.status(404).send({
            success: false,
            message: "API key not found or does not belong to you",
          });
        }

        // Delete the API key
        await fastify.prisma.apikeys.delete({
          where: {
            id: keyId,
          },
        });

        return reply.send({
          success: true,
          message: "API key deleted successfully",
          data: {},
        });
      } catch (error) {
        fastify.log.error({ error }, "Delete API key error");
        return reply.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
}
