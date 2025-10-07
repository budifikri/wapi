import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { FastifyRequest } from 'fastify';

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    return jwt.sign(payload, secret, { expiresIn });
  }

  static verifyToken(token: string): JWTPayload {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    return jwt.verify(token, secret) as JWTPayload;
  }

  static extractTokenFromRequest(request: FastifyRequest): string | null {
    // Try to get token from Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get token from cookie
    const token = request.cookies.token;
    if (token) {
      return token;
    }

    return null;
  }

  static generateRandomPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  static encryptApiKey(token: string): string {
    const algorithm = 'aes-256-cbc';
    const key = process.env.API_KEY_ENCRYPTION_KEY || 'your-super-secret-encryption-key-32chars';
    const iv = crypto.randomBytes(16); // Generate a random IV for each encryption
    
    if (key.length < 32) {
      // Pad the key to 32 bytes if it's too short
      const padding = Buffer.alloc(32 - key.length);
      padding.fill(0);
      const paddedKey = Buffer.concat([Buffer.from(key), padding]);
    }
    
    const cipher = crypto.createCipher(algorithm, Buffer.from(key.slice(0, 32)));
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (IV is not secret, just needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
  }

  static hashApiKey(token: string): string {
    // Create a hash of the API key using SHA-256
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  
  static compareApiKey(token: string, hashedToken: string): boolean {
    // Hash the provided token and compare it to the stored hash
    const hashedProvidedToken = crypto.createHash('sha256').update(token).digest('hex');
    return hashedProvidedToken === hashedToken;
  }
}