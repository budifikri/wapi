import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createDevice, getDeviceBySessionId, saveContacts } from "../../devicesService";
const qr = require("qr-image");
// Middleware API key authentication
const apiKeyAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const apiKey = request.headers["x-api-key"] as string;

  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      message: "API key is required in x-api-key header",
    });
  }

  try {
    const apiKeyRecord = await request.server.prisma.apikeys.findFirst({
      where: { token: apiKey, status: true },
      include: { users: true },
    });

    if (!apiKeyRecord || !apiKeyRecord.users) {
      return reply.status(401).send({
        success: false,
        message: "Invalid or inactive API key",
      });
    }

    (request as any).apiKeyUser = apiKeyRecord.users;
    (request as any).apiKeyRecord = apiKeyRecord;
  } catch (error) {
    request.log.error({ error }, "API key authentication error");
    return reply.status(500).send({
      success: false,
      message: "Internal server error during API key authentication",
    });
  }
};

interface SessionStartParams {
  sessionId: string;
}

interface SessionStatusParams {
  sessionId: string;
}

interface SessionQRParams {
  sessionId: string;
}

interface SessionRestartParams {
  sessionId: string;
}

interface SessionTerminateParams {
  sessionId: string;
}

interface SendMessageParams {
  sessionId: string;
}

interface SendMessageBody {
  chatId: string;
  contentType: string;
  content: string;
}

interface GetContactParams {
  sessionId: string;
}

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: SessionStartParams }>(
    "/session/start/:sessionId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description: "Start a session and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: {
              type: "string",
              description: "The session ID to start",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/start/${sessionId}`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Check if the response indicates success to create a device
        const successResponse =
          response.status === 200 && data.success === true;

        // Jika respons menunjukkan bahwa sesi berhasil dimulai, buat perangkat
        if (successResponse) {
          try {
            // Extract userId from the authenticated API key
            const userId = (request as any).apiKeyUser?.id;
            if (userId) {
              // Create device with a default number or empty string
              await createDevice(sessionId, userId, "", "connecting");
              fastify.log.info(
                `Device created for session ${sessionId} and user ${userId}`
              );
            } else {
              fastify.log.warn(
                `Could not extract userId from API key for session ${sessionId}`
              );
            }
          } catch (deviceError) {
            fastify.log.error(
              { error: deviceError },
              `Failed to create device for session ${sessionId}`
            );
            // Don't fail the main request if device creation fails
          }
        }

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get<{ Params: SessionStatusParams }>(
    "/session/status/:sessionId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description:
          "Get session status and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: {
              type: "string",
              description: "The session ID to check status",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/status/${sessionId}`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get<{ Params: SessionQRParams }>(
    "/session/qr/:sessionId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description:
          "Get session QR code and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: {
              type: "string",
              description: "The session ID to get QR code",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/qr/${sessionId}`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get<{ Params: SessionQRParams }>(
    "/session/qr/:sessionId/image",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description:
          "Get session QR code image and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: { type: "string", description: "The session ID" },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": { type: "string", description: "Valid API key" },
          },
        },
        response: {
          200: {
            description: "QR code image or JSON response",
            content: {
              "image/png": {
                schema: { type: "string", format: "binary" },
              },
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    qr: { type: "string" },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/qr/${sessionId}`;
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const data = await response.json();

        // ✅ Jika remote API kirim field qr, generate QR PNG
        if (data?.qr) {
          const qrImage = qr.image(data.qr, { type: "png" });
          reply.header("Content-Type", "image/png").code(200);
          return reply.send(qrImage);
        }

        // Kalau tidak ada field qr, kirim JSON biasa
        return reply.code(response.status).send(data);
      } catch (error) {
        request.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get<{ Params: SessionRestartParams }>(
    "/session/restart/:sessionId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description: "Restart a session and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: {
              type: "string",
              description: "The session ID to restart",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/restart/${sessionId}`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get<{ Params: SessionTerminateParams }>(
    "/session/terminate/:sessionId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description:
          "Terminate a session and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: {
              type: "string",
              description: "The session ID to terminate",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/terminate/${sessionId}`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get(
    "/session/terminateInactive",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description:
          "Terminate inactive sessions and relay the request to remote server",
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/terminateInactive`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get(
    "/session/terminateAll",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Session"],
        description:
          "Terminate all sessions and relay the request to remote server",
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/session/terminateAll`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.post<{ Params: SendMessageParams; Body: SendMessageBody }>(
    "/client/sendMessage/:sessionId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Client"],
        description:
          "Send a message to a client and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: {
              type: "string",
              description: "The session ID to send message",
            },
          },
        },
        body: {
          type: "object",
          required: ["chatId", "contentType", "content"],
          properties: {
            chatId: {
              type: "string",
              description: "The chat ID to send message to",
            },
            contentType: {
              type: "string",
              description: "The content type of the message",
            },
            content: {
              type: "string",
              description: "The content of the message",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const { chatId, contentType, content } = request.body;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/client/sendMessage/${sessionId}`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
          body: JSON.stringify({ chatId, contentType, content }),
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Kirim balik persis hasilnya
        return reply.code(response.status as any).send(data);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );

  fastify.get<{ Params: GetContactParams }>(
    "/client/getContacts/:sessionId",
    {
      preHandler: [apiKeyAuth],
      schema: {
        tags: ["Client"],
        description: "Get contacts and relay the request to remote server",
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: {
              type: "string",
              description: "The session ID to get contacts",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-api-key"],
          properties: {
            "x-api-key": {
              type: "string",
              description: "Valid API key for authentication",
            },
          },
        },
        response: {
          200: {
            description: "Response from remote server",
            type: "object",
            additionalProperties: true, // ✅ Fix agar field tidak dibuang
          },
          401: {
            description: "Unauthorized - Invalid or missing API key",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            description: "Internal server error",
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
      const { sessionId } = request.params;
      const REMOTE_API_KEY = process.env.REMOTE_API_KEY;
      const REMOTE_URL_API = process.env.REMOTE_URL_API;

      if (!REMOTE_API_KEY || !REMOTE_URL_API) {
        const missing = !REMOTE_API_KEY ? "REMOTE_API_KEY" : "REMOTE_URL_API";
        fastify.log.error(`${missing} is not set in environment variables`);
        return reply.status(500).send({
          success: false,
          message: `Configuration error: ${missing} is not set`,
        });
      }

      try {
        const url = `${REMOTE_URL_API}/client/getContacts/${sessionId}`;
        fastify.log.info(`Forwarding request to remote URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "x-api-key": REMOTE_API_KEY,
          },
        });

        const text = await response.text();
        let data: any = {};

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // 🧠 Log lengkap response dari remote API
        fastify.log.info(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers as any),
            body: data,
          },
          "Remote API response"
        );

        // 🔍 Log sebelum kirim ke client
        fastify.log.info(
          {
            statusCode: response.status,
            outgoingData: data,
          },
          "Sending response back to client"
        );

        // Check if the response indicates success to synchronize contacts
        const successResponse = response.status === 200 && (data.success === true || Array.isArray(data) || (data && typeof data === 'object'));
        
        // Jika respons menunjukkan bahwa data kontak berhasil diambil, sinkronkan ke database
        if (successResponse && sessionId) {
          try {
            // Get device by sessionId to get the device key
            const device = await getDeviceBySessionId(sessionId);
            if (device) {
              let contactsData: any[] = [];
              
              // Extract contacts data from response based on possible structures
              if (Array.isArray(data)) {
                // If response is directly an array of contacts
                contactsData = data;
              } else if (data.contacts && Array.isArray(data.contacts)) {
                // If contacts are in a contacts property
                contactsData = data.contacts;
              } else if (data.data && Array.isArray(data.data)) {
                // If contacts are in a data property
                contactsData = data.data;
              } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                // If it's a single contact object or other structure
                if (data.id || data.name || data.number) {
                  // Likely a single contact object
                  contactsData = [data];
                }
              }

              if (contactsData.length > 0) {
                // Save all contacts to the database
                await saveContacts(device.key, contactsData);
                fastify.log.info(`Synced ${contactsData.length} contacts for device ${device.key} (session ${sessionId})`);
              } else {
                fastify.log.info(`No contacts found to sync for session ${sessionId}`);
              }
            } else {
              fastify.log.warn(`Device not found for sessionId ${sessionId}, cannot sync contacts`);
            }
          } catch (syncError) {
            fastify.log.error({ error: syncError, sessionId: sessionId }, `Failed to sync contacts for session ${sessionId}`);
            // Don't fail the main request if contact sync fails
          }
        }

        // If the response contains an array of contacts, limit to 10 items for performance
        let responseData = data;
        if (Array.isArray(data) && data.length > 10) {
          // If response is directly an array of contacts, limit to first 10
          responseData = data.slice(0, 10);
        } else if (data && typeof data === 'object' && Array.isArray(data.contacts) && data.contacts.length > 10) {
          // If contacts are in a contacts property, limit that array to first 10
          responseData = {
            ...data,
            contacts: data.contacts.slice(0, 10)
          };
        } else if (data && typeof data === 'object' && Array.isArray(data.data) && data.data.length > 10) {
          // If contacts are in a data property, limit that array to first 10
          responseData = {
            ...data,
            data: data.data.slice(0, 10)
          };
        }

        // Kirim balik hasil yang sudah di limit
        return reply.code(response.status as any).send(responseData);
      } catch (error) {
        fastify.log.error({ error }, "Error forwarding request to remote API");
        return reply.status(500).send({
          success: false,
          message: "Failed to connect to remote API",
        });
      }
    }
  );
}
