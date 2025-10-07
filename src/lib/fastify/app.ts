import fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import cors from "@fastify/cors";
import { updateDeviceStatus, saveMessage, getDeviceBySessionId } from "../devicesService";

// Import plugins
import prismaPlugin from "./plugins/prisma";
import jwtPlugin from "./plugins/jwt";
import oauth2Plugin from "./plugins/oauth2";
import cookiePlugin from "./plugins/cookie";
import swaggerPlugin from "./plugins/swagger";

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import apiKeyRoutes from "./routes/apikeys";
import sessionRoutes from "./routes/sessions";
import { AuthUtils } from "./utils/auth";
import { tokenBlacklist } from "./utils/token-blacklist";

export async function createFastifyApp() {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
    trustProxy: true,
  });

  // Register plugins
  await app.register(prismaPlugin);
  await app.register(cookiePlugin);
  await app.register(jwtPlugin);
  await app.register(oauth2Plugin);
  await app.register(swaggerPlugin);

  // Enable CORS
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Add custom middleware to check token blacklist
  app.addHook("preHandler", async (request, reply) => {
    // Skip for auth routes and public routes
    if (
      request.url?.startsWith("/auth/") ||
      request.url?.startsWith("/health")
    ) {
      return;
    }

    const token = AuthUtils.extractTokenFromRequest(request);
    if (token && tokenBlacklist.isBlacklisted(token)) {
      return reply.status(401).send({
        error: "Token has been invalidated",
      });
    }
  });

  // Register routes
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(apiKeyRoutes);
  await app.register(sessionRoutes);
  let lastWebhook = null;
  // WhatsApp webhook endpoint
  app.post("/whatsapp/webhook", {
    schema: {
      description: "Webhook endpoint for receiving WhatsApp events",
      body: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          dataType: { type: "string" },
          data: { type: "object", additionalProperties: true },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            receivedType: { type: "string" },
            sessionId: { type: ["string", "null"] },
          },
        },
        401: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
      },
    },

    handler: async (request, reply) => {
      // Check authorization header and x-api-key
      const apiKey = request.headers["x-api-key"];

      if (apiKey !== process.env.WHATSAPP_WEBHOOK_AUTH) {
        app.log.warn(
          { url: request.url, headers: request.headers },
          "Unauthorized access to webhook endpoint"
        );

        return reply.code(401).send({
          success: false,
          message: "Unauthorized: Invalid authorization or API key",
        });
      }

      const webhookBody = request.body as {
        dataType?: string;
        data?: any;
        sessionId?: string;
      };
      const { dataType, data, sessionId } = webhookBody;
      lastWebhook = { dataType, data, sessionId, receivedAt: new Date() };

      app.log.info(
        { sessionId, dataType, data },
        "📩 Webhook received from WhatsApp Server"
      );

      try {
        // Update device status based on dataType
        if (sessionId && dataType && ['qr', 'authenticated', 'ready', 'connecting', 'connected', 'disconnected'].includes(dataType)) {
          // Map dataType to device status
          let deviceStatus = "unknown"; // default status

          switch (dataType) {
            case "ready":
              deviceStatus = "ready";
              break;
            case "authenticated":
              deviceStatus = "authenticated";
              break;
            case "qr":
              deviceStatus = "qr";
              break;
            case "connecting":
              deviceStatus = "connecting";
              break;
            case "connected":
              deviceStatus = "connected";
              break;
            case "disconnected":
              deviceStatus = "disconnected";
              break;
            default:
              deviceStatus = dataType; // Use dataType as status if not specifically mapped
          }

          // Update the device status in the database
          await updateDeviceStatus(sessionId, deviceStatus);

          app.log.info(
            {
              sessionId: sessionId,
              dataType: dataType,
              newStatus: deviceStatus,
            },
            "Device status updated successfully"
          );
        } else if (sessionId && dataType) {
          // Log when dataType is not in the allowed list
          app.log.info(
            {
              sessionId: sessionId,
              dataType: dataType
            },
            "Data type not in allowed list, skipping device status update"
          );
        } else {
          app.log.warn(
            {
              body: request.body,
            },
            "sessionId or dataType not found in webhook payload"
          );
        }
      } catch (error) {
        app.log.error(
          {
            error: error,
            url: request.url,
            body: request.body,
          },
          "Error processing webhook data for device status update"
        );
      }

      // Additional logic based on dataType
      switch (dataType) {
        case "device_linked":
          console.log(
            `✅ Device ${data.device} connected (session ${sessionId})`
          );
          break;
        case "device_unlinked":
          console.log(
            `⚠️ Device ${data.device} disconnected (session ${sessionId})`
          );
          break;
        case "message":
          console.log(`💬 Message received:`, data);
          break;
        default:
          console.log(`ℹ️ Unknown dataType: ${dataType}`);
      }

      // Check if message data exists in the webhook payload and save it
      // This handles cases where messages are sent in outgoingData or elsewhere in the payload
      // Based on your example: the message data could be in outgoingData.message
      let messageData = null;

      // Type assert request.body to any for flexible property access
      const requestBody: any = request.body;

      // Check multiple possible locations for message data
      if (requestBody?.outgoingData?.message) {
        messageData = requestBody.outgoingData.message;
      } else if (requestBody?.message) {
        messageData = requestBody.message;
      } else if (requestBody?.data?.message) {
        messageData = requestBody.data.message;
      } else if (requestBody?.data && !requestBody?.outgoingData) {
        // If there's data but not in nested form, it might be the message itself
        messageData = requestBody.data;
      }

      // Also check the main body for message data
      if (!messageData && requestBody && Object.keys(requestBody).length > 0) {
        // Check if the body itself looks like a message object
        if (requestBody._data || requestBody.body || (requestBody.id && requestBody.from && requestBody.to)) {
          messageData = requestBody;
        }
      }

      if (messageData && sessionId) {
        try {
          // Get device by sessionId to get the device key
          const device = await getDeviceBySessionId(sessionId);
          if (device) {
            // Save the message to the database
            await saveMessage(device.key, messageData);
            app.log.info(
              `Message saved to database for device ${device.key} (session ${sessionId})`
            );
          } else {
            app.log.warn(
              `Device not found for sessionId ${sessionId}, cannot save message`
            );
          }
        } catch (error) {
          app.log.error(
            { error: error, sessionId: sessionId, messageData: messageData },
            "Error saving message to database"
          );
        }
      }

      return reply.status(200).send({
        success: true,
        message: "Webhook received successfully",
        receivedType: dataType,
        sessionId: sessionId || null,
      });
    },
  });
  app.get("/webhook/last", async (request, reply) => {
    if (!lastWebhook) return reply.send({ message: "No webhook received yet" });
    return reply.send(lastWebhook);
  });

  app.post("/webhook", async (request, reply) => {
    try {
      console.log("📩 Received Webhook:", request.body);
      reply.send({ success: true, received: request.body });
    } catch (err) {
      console.error("❌ Webhook handler error:", err);
      reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  // Health check endpoint
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        description:
          "Check if the API server is running and database is connected",
        response: {
          200: {
            description: "Server is healthy",
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
          503: {
            description: "Database connection failed",
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        return reply.send({
          status: "ok",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        });
      } catch (error) {
        return reply.status(503).send({
          status: "error",
          message: "Database connection failed",
        });
      }
    }
  );

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: "Validation Error",
        details: error.validation,
      });
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.message,
      });
    }

    return reply.status(500).send({
      error: "Internal Server Error",
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: "Route not found",
      path: request.url,
    });
  });

  return app;
}
