import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthUtils } from '../utils/auth';
import { tokenBlacklist } from '../utils/token-blacklist';
import { generateEmailToken, sendVerificationEmail } from '../../email';

interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface VerifyEmailQuery {
  token: string;
}

interface ResendVerificationBody {
  email: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Register endpoint
  fastify.post<{ Body: RegisterBody }>('/auth/register', {
    schema: {
      tags: ['Authentication'],
      summary: 'Register a new user',
      description: 'Create a new user account with email and password',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { 
            type: 'string', 
            format: 'email',
            description: 'User email address'
          },
          password: { 
            type: 'string', 
            minLength: 6,
            description: 'User password (minimum 6 characters)'
          },
          name: { 
            type: 'string',
            description: 'User display name (optional)'
          }
        }
      },
      response: {
        201: {
          description: 'User registered successfully - email verification required',
          type: 'object',
          properties: {
            message: { type: 'string', description: 'User registered successfully. Please check your email to verify your account.' },
            user: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                isEmailVerified: { type: 'boolean' },
                createdAt: { type: 'string' }
              }
            }
          }
        },
        400: {
          description: 'Bad request - User already exists or validation error',
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
      const { email, password, name } = request.body;

      // Check if user already exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return reply.status(400).send({
          error: 'User already exists with this email'
        });
      }

      // Hash password
      const hashedPassword = await AuthUtils.hashPassword(password);

      // Generate email verification token
      const emailToken = generateEmailToken();

      // Create user with email verification token
      const user = await fastify.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split('@')[0],
          emailToken,
          isEmailVerified: false
        },
        select: {
          id: true,
          email: true,
          name: true,
          isEmailVerified: true,
          createdAt: true
        }
      });

      // Send verification email
      try {
        await sendVerificationEmail(email, emailToken, user.name);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails, but log it
      }

      return reply.status(201).send({
        message: 'User registered successfully. Please check your email to verify your account.',
        user
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Verify email endpoint
  fastify.get<{ Querystring: VerifyEmailQuery }>('/auth/verify-email', {
    schema: {
      tags: ['Authentication'],
      summary: 'Verify email address',
      description: 'Verify user email address using verification token',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { 
            type: 'string',
            description: 'Email verification token'
          }
        }
      },
      response: {
        302: {
          description: 'Redirect to frontend after successful email verification'
        },
        400: {
          description: 'Invalid or expired token',
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
      const { token } = request.query;

      // Find user by verification token
      const user = await fastify.prisma.user.findFirst({
        where: { 
          emailToken: token,
          isEmailVerified: false
        }
      });

      if (!user) {
        return reply.status(400).send({
          error: 'Invalid or expired verification token'
        });
      }

      // Update user as verified
      const updatedUser = await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerified: new Date(),
          emailToken: null // Clear the token
        },
        select: {
          id: true,
          email: true,
          name: true,
          isEmailVerified: true
        }
      });

      // Generate JWT token for auto-login
      const authToken = AuthUtils.generateToken({
        userId: updatedUser.id,
        email: updatedUser.email
      });

      // Set token in cookie for auto-login
      reply.setCookie('token', authToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });

      // Redirect to frontend URL after successful verification
      const frontendUrl = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendUrl}?email-verified=true&email=${encodeURIComponent(updatedUser.email)}`);

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Resend verification email endpoint
  fastify.post<{ Body: ResendVerificationBody }>('/auth/resend-verification', {
    schema: {
      tags: ['Authentication'],
      summary: 'Resend verification email',
      description: 'Resend email verification to user',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { 
            type: 'string', 
            format: 'email',
            description: 'User email address'
          }
        }
      },
      response: {
        200: {
          description: 'Verification email sent',
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Verification email sent successfully' }
          }
        },
        400: {
          description: 'Bad request - User not found or already verified',
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
      const { email } = request.body;

      // Find user
      const user = await fastify.prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return reply.status(400).send({
          error: 'No account found with this email address'
        });
      }

      if (user.isEmailVerified) {
        return reply.status(400).send({
          error: 'This email is already verified'
        });
      }

      // Generate new verification token
      const emailToken = generateEmailToken();

      // Update user with new token
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { emailToken }
      });

      // Send verification email
      try {
        await sendVerificationEmail(email, emailToken, user.name);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return reply.status(500).send({
          error: 'Failed to send verification email'
        });
      }

      return reply.send({
        message: 'Verification email sent successfully. Please check your inbox.'
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Login endpoint
  fastify.post<{ Body: LoginBody }>('/auth/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Login user',
      description: 'Authenticate user with email and password',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { 
            type: 'string', 
            format: 'email',
            description: 'User email address'
          },
          password: { 
            type: 'string',
            description: 'User password'
          }
        }
      },
      response: {
        200: {
          description: 'Login successful',
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Login successful' },
            user: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                avatar: { type: 'string' }
              }
            },
            token: { type: 'string', description: 'JWT authentication token' }
          }
        },
        401: {
          description: 'Unauthorized - Invalid credentials',
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
      const { email, password } = request.body;

      // Find user
      const user = await fastify.prisma.user.findUnique({
        where: { email }
      });

      if (!user || !user.password) {
        return reply.status(401).send({
          error: 'Invalid email or password'
        });
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        return reply.status(401).send({
          error: 'Please verify your email address before logging in. Check your inbox for the verification link.'
        });
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(password, user.password);
      if (!isValidPassword) {
        return reply.status(401).send({
          error: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = AuthUtils.generateToken({
        userId: user.id,
        email: user.email
      });

      // Set token in cookie
      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });

      return reply.send({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar
        },
        token
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Google OAuth callback
  fastify.get('/auth/google/callback', {
    schema: {
      tags: ['Authentication'],
      summary: 'Google OAuth callback',
      description: 'Handle callback from Google OAuth authentication',
      response: {
        302: {
          description: 'Redirect to frontend after successful Google authentication',
          type: 'string'
        },
        400: {
          description: 'Bad request - OAuth error',
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
      const googleOAuth2 = fastify.googleOAuth2;
      const token = await googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
      
      if (!token || !token.token) {
        return reply.status(400).send({
          error: 'Failed to get access token from Google'
        });
      }

      // Get user info from Google using the access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token.token.access_token}`
        }
      });
      
      if (!userInfoResponse.ok) {
        return reply.status(400).send({
          error: 'Failed to get user info from Google'
        });
      }
      
      const userInfo = await userInfoResponse.json();
      
      // Validate required user info fields
      if (!userInfo.email) {
        return reply.status(400).send({
          error: 'Google did not provide email address. Please ensure email access is granted.'
        });
      }

      // Check if user exists
      let user = await fastify.prisma.user.findUnique({
        where: { googleId: userInfo.id }
      });

      if (!user) {
        // Check if user exists with same email
        user = await fastify.prisma.user.findUnique({
          where: { email: userInfo.email }
        });

        if (user) {
          // Link Google account to existing user
          user = await fastify.prisma.user.update({
            where: { id: user.id },
            data: { googleId: userInfo.id }
          });
        } else {
          // Create new user
          user = await fastify.prisma.user.create({
            data: {
              email: userInfo.email,
              name: userInfo.name,
              googleId: userInfo.id,
              avatar: userInfo.picture,
              emailVerified: new Date(),
              isEmailVerified: true // Google OAuth users are automatically verified
            }
          });
        }
      }

      // Generate JWT token
      const jwtToken = AuthUtils.generateToken({
        userId: user.id,
        email: user.email
      });

      // Set token in cookie
      reply.setCookie('token', jwtToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });

      // Redirect to frontend URL after successful Google authentication
      const frontendUrl = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendUrl}?google-auth-success=true&email=${encodeURIComponent(user.email)}`);

    } catch (error) {
      fastify.log.error('Google OAuth error details:', error);
      console.error('Google OAuth error:', error); // More detailed logging
      return reply.status(500).send({
        error: 'Internal server error during Google authentication',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Logout endpoint
  fastify.post('/auth/logout', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentication'],
      summary: 'Logout user',
      description: 'Logout user and invalidate JWT token',
      security: [
        { Bearer: [] },
        { CookieAuth: [] }
      ],
      response: {
        200: {
          description: 'Logout successful',
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Logout successful' }
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
      const token = AuthUtils.extractTokenFromRequest(request);
      
      if (token) {
        // Add token to blacklist
        tokenBlacklist.add(token);
        
        // Clear cookie
        reply.clearCookie('token', {
          path: '/'
        });
      }

      return reply.send({
        message: 'Logout successful'
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });
}