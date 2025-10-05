import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';

// Import plugins
import prismaPlugin from './plugins/prisma';
import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';
import cookiePlugin from './plugins/cookie';
import swaggerPlugin from './plugins/swagger';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import { AuthUtils } from './utils/auth';
import { tokenBlacklist } from './utils/token-blacklist';

export async function createFastifyApp() {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    },
    trustProxy: true
  });

  // Register plugins
  await app.register(prismaPlugin);
  await app.register(cookiePlugin);
  await app.register(jwtPlugin);
  await app.register(oauth2Plugin);
  await app.register(swaggerPlugin);

  // Enable CORS
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  // Add custom middleware to check token blacklist
  app.addHook('preHandler', async (request, reply) => {
    // Skip for auth routes and public routes
    if (request.url?.startsWith('/auth/') || request.url?.startsWith('/health')) {
      return;
    }

    const token = AuthUtils.extractTokenFromRequest(request);
    if (token && tokenBlacklist.isBlacklisted(token)) {
      return reply.status(401).send({
        error: 'Token has been invalidated'
      });
    }
  });

  // Register routes
  await app.register(authRoutes);
  await app.register(userRoutes);

  // Health check endpoint
  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Check if the API server is running and database is connected',
      response: {
        200: {
          description: 'Server is healthy',
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Server status' },
            timestamp: { type: 'string', format: 'date-time', description: 'Response timestamp' },
            uptime: { type: 'number', description: 'Server uptime in seconds' }
          }
        },
        503: {
          description: 'Database connection failed',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      return reply.status(503).send({
        status: 'error',
        message: 'Database connection failed'
      });
    }
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: error.validation
      });
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.message
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error'
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Route not found',
      path: request.url
    });
  });

  return app;
}