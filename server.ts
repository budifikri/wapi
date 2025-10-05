// server.ts - Next.js Standalone + Socket.IO + Fastify API
import "dotenv/config";
import { setupSocket } from "@/lib/socket";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { createFastifyApp } from "@/lib/fastify/app";

const dev = process.env.NODE_ENV !== "production";
const nextPort = 3000; // Changed from 3000 to 3002 to avoid conflict
const fastifyPort = 3001;
const hostname = "127.0.0.1";

// Custom server with Socket.IO integration
async function createCustomServer() {
  try {
    // Start Fastify API server
    console.log("Starting Fastify API server...");
    const fastifyApp = await createFastifyApp();

    fastifyApp.listen(
      {
        port: fastifyPort,
        host: hostname,
      },
      (err, address) => {
        if (err) {
          console.error("Fastify server error:", err);
          process.exit(1);
        }
        console.log(`> Fastify API ready on http://${hostname}:${fastifyPort}`);
        console.log(
          `> Auth endpoints available at http://${hostname}:${fastifyPort}/auth/*`
        );
        console.log(
          `> User endpoints available at http://${hostname}:${fastifyPort}/users/*`
        );
      }
    );

    // Create Next.js app
    console.log("Starting Next.js app...");
    const nextApp = next({
      dev,
      dir: process.cwd(),
      // In production, use the current directory where .next is located
      conf: dev ? undefined : { distDir: "./.next" },
    });

    try {
      await nextApp.prepare();
      const handle = nextApp.getRequestHandler();

      // Create HTTP server that will handle both Next.js and Socket.IO
      const server = createServer((req, res) => {
        // Skip socket.io requests from Next.js handler
        if (req.url?.startsWith("/api/socketio")) {
          return;
        }
        handle(req, res);
      });

      // Setup Socket.IO
      const io = new Server(server, {
        path: "/api/socketio",
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
        },
      });

      setupSocket(io);

      // Start the Next.js server
      server.listen(nextPort, hostname, () => {
        console.log(`> Next.js ready on http://${hostname}:${nextPort}`);
        console.log(
          `> Socket.IO server running at ws://${hostname}:${nextPort}/api/socketio`
        );
      });
    } catch (error) {
      console.error("Failed to start Next.js app:", error);
      throw error;
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      try {
        await fastifyApp.close();
        server.close(() => {
          console.log("Servers closed successfully");
          process.exit(0);
        });
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (err) {
    console.error("Server startup error:", err);
    process.exit(1);
  }
}

// Start the server
createCustomServer();
