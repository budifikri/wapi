import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create email transporter
const createTransporter = async () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('Email credentials not configured. Using test account.');
    // For development, create a test account
    const testAccount = await nodemailer.createTestAccount();
    
    // Return a real transporter configured with test account details
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal username
        pass: testAccount.pass, // generated ethereal password
      },
    });
  }
  
  return nodemailer.createTransport(emailConfig);
};

// Generate email verification token
export const generateEmailToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Send email verification
export const sendVerificationEmail = async (email: string, token: string, name?: string) => {
  try {
    const transporter = await createTransporter();
    
    const verificationUrl = `${process.env.URL_API || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
    
    const mailOptions = {
      from: process.env.SMTP_FROM || '"NextAuth App" <noreply@nextauth.app>',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f8f9fa;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 25px;
              margin: 20px 0;
              font-weight: 600;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to NextAuth!</h1>
            <p>Please verify your email address</p>
          </div>
          
          <div class="content">
            <p>Hi ${name || 'there'},</p>
            <p>Thank you for registering with NextAuth! To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <p><strong>Note:</strong> This verification link will expire in 24 hours.</p>
          </div>
          
          <div class="footer">
            <p>If you didn't create an account with NextAuth, you can safely ignore this email.</p>
            <p>© 2024 NextAuth. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    
    // Only show test account URL for the test transporter
    let previewUrl = null;
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl, // Only for test accounts
    };
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, token: string, name?: string) => {
  try {
    const transporter = await createTransporter();
    
    const resetUrl = `${process.env.URL_API || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.SMTP_FROM || '"NextAuth App" <noreply@nextauth.app>',
      to: email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f8f9fa;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 25px;
              margin: 20px 0;
              font-weight: 600;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Password Reset Request</h1>
            <p>Reset your NextAuth password</p>
          </div>
          
          <div class="content">
            <p>Hi ${name || 'there'},</p>
            <p>We received a request to reset your password for your NextAuth account. Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            
            <p><strong>Note:</strong> This reset link will expire in 1 hour.</p>
            <p><strong>Security:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>© 2024 NextAuth. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    
    // Only show test account URL for the test transporter
    let previewUrl = null;
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl, // Only for test accounts
    };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};