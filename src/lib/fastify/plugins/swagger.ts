import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export default fp(
  async (fastify) => {
    // Register Swagger plugin
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: "Authentication API",
          description:
            "Fastify Authentication System with JWT and Google OAuth",
          version: "1.0.0",
          contact: {
            name: "API Support",
            email: "support@example.com",
          },
          license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
          },
        },
        servers: [
          { url: "http://localhost:3001", description: "Development server" },
        ],
        tags: [
          { name: "Authentication", description: "Authentication endpoints" },
          { name: "Users", description: "User management endpoints" },
          { name: "Health", description: "Health check endpoints" },
        ],
        components: {
          securitySchemes: {
            Bearer: {
              type: "apiKey",
              name: "Authorization",
              in: "header",
              description: "JWT token in format: Bearer <token>",
            },
            CookieAuth: {
              type: "apiKey",
              name: "token",
              in: "cookie",
              description: "JWT token stored in HTTP-only cookie",
            },
          },
          schemas: {
            User: {
              type: "object",
              properties: {
                id: { type: "string", description: "User ID" },
                email: {
                  type: "string",
                  format: "email",
                  description: "User email",
                },
                name: { type: "string", description: "User name" },
                avatar: { type: "string", description: "Avatar URL" },
                emailVerified: {
                  type: "string",
                  format: "date-time",
                  description: "Email verification date",
                },
                isEmailVerified: {
                  type: "boolean",
                  description: "Email verification status",
                },
                createdAt: {
                  type: "string",
                  format: "date-time",
                  description: "Account creation date",
                },
                updatedAt: {
                  type: "string",
                  format: "date-time",
                  description: "Last update date",
                },
              },
            },
            AuthResponse: {
              type: "object",
              properties: {
                message: { type: "string", description: "Response message" },
                user: { $ref: "#/components/schemas/User" },
                token: {
                  type: "string",
                  description: "JWT authentication token",
                },
              },
            },
            Error: {
              type: "object",
              properties: {
                error: { type: "string", description: "Error message" },
                details: {
                  type: "array",
                  items: { type: "object" },
                  description: "Validation error details",
                },
              },
            },
            HealthResponse: {
              type: "object",
              properties: {
                status: { type: "string", description: "Server status" },
                timestamp: {
                  type: "string",
                  format: "date-time",
                  description: "Response timestamp",
                },
                uptime: {
                  type: "number",
                  description: "Server uptime in seconds",
                },
              },
            },
          },
        },
      },
    });

    // Register Swagger UI plugin
    await fastify.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: false,
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next();
        },
        preHandler: function (request, reply, next) {
          next();
        },
      },
      staticCSP: false,
      transformStaticCSP: (header) => {
        return "default-src * 'unsafe-inline' blob: data:; style-src * 'unsafe-inline'; img-src * data: blob:";
      },
      transformSpecification: (swaggerObject, request, reply) => {
        return swaggerObject;
      },
      transformSpecificationClone: true,
    });
  },
  {
    name: "swagger",
  }
);
