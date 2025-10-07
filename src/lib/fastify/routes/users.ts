import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthUtils } from '../utils/auth';
import { tokenBlacklist } from '../utils/token-blacklist';

export default async function userRoutes(fastify: FastifyInstance) {
  // Get current user profile
  fastify.get('/users/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Users'],
      summary: 'Get current user profile',
      description: 'Get the profile of the currently authenticated user',
      security: [
        { Bearer: [] },
        { CookieAuth: [] }
      ],
      response: {
        200: {
          description: 'User profile retrieved successfully',
          type: 'object',
          properties: {
            user: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                avatar: { type: 'string' },
                emailVerified: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        },
        401: {
          description: 'Unauthorized - Invalid or missing token',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          description: 'User not found',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const payload = request.user as any;
      
      // Check if token is blacklisted
      const token = AuthUtils.extractTokenFromRequest(request);
      if (token && tokenBlacklist.isBlacklisted(token)) {
        return reply.status(401).send({
          error: 'Token has been invalidated'
        });
      }

      // Get user from database
      const user = await fastify.prisma.users.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found'
        });
      }

      return reply.send({
        user
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Update user profile
  fastify.put('/users/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Users'],
      summary: 'Update user profile',
      description: 'Update the profile of the currently authenticated user',
      security: [
        { Bearer: [] },
        { CookieAuth: [] }
      ],
      body: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100,
            description: 'User display name'
          },
          avatar: { 
            type: 'string',
            description: 'Avatar URL'
          }
        }
      },
      response: {
        200: {
          description: 'Profile updated successfully',
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Profile updated successfully' },
            user: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                avatar: { type: 'string' },
                emailVerified: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        },
        401: {
          description: 'Unauthorized - Invalid or missing token',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const payload = request.user as any;
      const { name, avatar } = request.body as any;

      // Check if token is blacklisted
      const token = AuthUtils.extractTokenFromRequest(request);
      if (token && tokenBlacklist.isBlacklisted(token)) {
        return reply.status(401).send({
          error: 'Token has been invalidated'
        });
      }

      // Update user
      const updatedUser = await fastify.prisma.users.update({
        where: { id: payload.userId },
        data: {
          ...(name && { name }),
          ...(avatar && { avatar })
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return reply.send({
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Change password
  fastify.post('/users/me/change-password', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Users'],
      summary: 'Change user password',
      description: 'Change the password of the currently authenticated user',
      security: [
        { Bearer: [] },
        { CookieAuth: [] }
      ],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { 
            type: 'string', 
            minLength: 6,
            description: 'Current password'
          },
          newPassword: { 
            type: 'string', 
            minLength: 6,
            description: 'New password (minimum 6 characters)'
          }
        }
      },
      response: {
        200: {
          description: 'Password changed successfully',
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Password changed successfully. Please login again.' }
          }
        },
        400: {
          description: 'Bad request - Invalid current password or OAuth user',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          description: 'Unauthorized - Invalid or missing token',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const payload = request.user as any;
      const { currentPassword, newPassword } = request.body as any;

      // Check if token is blacklisted
      const token = AuthUtils.extractTokenFromRequest(request);
      if (token && tokenBlacklist.isBlacklisted(token)) {
        return reply.status(401).send({
          error: 'Token has been invalidated'
        });
      }

      // Get user with password
      const user = await fastify.prisma.users.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          password: true
        }
      });

      if (!user || !user.password) {
        return reply.status(400).send({
          error: 'Cannot change password for OAuth users'
        });
      }

      // Verify current password
      const isValidPassword = await AuthUtils.comparePassword(currentPassword, user.password);
      if (!isValidPassword) {
        return reply.status(401).send({
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedNewPassword = await AuthUtils.hashPassword(newPassword);

      // Update password
      await fastify.prisma.users.update({
        where: { id: user.id },
        data: { password: hashedNewPassword }
      });

      // Blacklist all existing tokens for this user (force re-login)
      // In a real implementation, you might want to track multiple tokens per user
      tokenBlacklist.add(token!);

      return reply.send({
        message: 'Password changed successfully. Please login again.'
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Delete user account
  fastify.delete('/users/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Users'],
      summary: 'Delete user account',
      description: 'Delete the account of the currently authenticated user',
      security: [
        { Bearer: [] },
        { CookieAuth: [] }
      ],
      response: {
        200: {
          description: 'Account deleted successfully',
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Account deleted successfully' }
          }
        },
        401: {
          description: 'Unauthorized - Invalid or missing token',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const payload = request.user as any;

      // Check if token is blacklisted
      const token = AuthUtils.extractTokenFromRequest(request);
      if (token && tokenBlacklist.isBlacklisted(token)) {
        return reply.status(401).send({
          error: 'Token has been invalidated'
        });
      }

      // Delete user (cascade delete will handle related records)
      await fastify.prisma.users.delete({
        where: { id: payload.userId }
      });

      // Blacklist the token
      if (token) {
        tokenBlacklist.add(token);
      }

      // Clear cookie
      reply.clearCookie('token', {
        path: '/'
      });

      return reply.send({
        message: 'Account deleted successfully'
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });
}