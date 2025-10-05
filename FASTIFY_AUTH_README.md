# Fastify Authentication System

A comprehensive authentication system built with Fastify, JWT, Google OAuth, and Prisma ORM. This system provides secure user authentication with email/password and Google OAuth options.

## 🚀 Features

- **Email/Password Authentication**: Register and login with email and password
- **Google OAuth**: Sign in with Google account
- **JWT Token Management**: Secure JWT-based authentication
- **Token Blacklist**: Secure logout with token invalidation
- **Protected Routes**: Middleware for protecting API endpoints
- **User Management**: Complete user profile management
- **Password Security**: bcrypt hashing for secure password storage
- **Cookie Support**: HTTP-only cookies for token storage
- **CORS Protection**: Cross-origin resource sharing configuration
- **Database Integration**: Prisma ORM with SQLite

## 📋 Requirements

- Node.js 18+
- npm or yarn
- Google Cloud Console (for OAuth setup - optional)

## 🛠️ Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Database
   DATABASE_URL="file:./db/custom.db"
   
   # JWT Configuration
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   JWT_EXPIRES_IN="7d"
   
   # Cookie Configuration
   COOKIE_SECRET="your-super-secret-cookie-key"
   
   # Google OAuth (optional)
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   
   # Application URLs
   BASE_URL="http://localhost:3001"
   FRONTEND_URL="http://localhost:3000"
   URL_API="http://localhost:3001"  # API server URL for email verification links
   URL_FRONT="http://localhost:3000"  # Frontend URL for redirects
   
   # Logging
   LOG_LEVEL="info"
   
   # Node Environment
   NODE_ENV="development"
   ```

3. **Set up the database:**
   ```bash
   npm run db:push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The application will start with:
- **Fastify API Server**: http://localhost:3001
- **Next.js Frontend**: http://localhost:3000
- **Socket.IO Server**: ws://localhost:3000/api/socketio

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| GET | `/auth/google` | Redirect to Google OAuth |
| GET | `/auth/google/callback` | Handle Google OAuth callback |
| POST | `/auth/logout` | Logout and invalidate token |

### User Endpoints (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/me` | Update user profile |
| POST | `/users/me/change-password` | Change password |
| DELETE | `/users/me` | Delete user account |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Check API server status |

## 🔧 Google OAuth Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select existing one
3. **Enable Google+ API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. **Create OAuth 2.0 credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
5. **Copy Client ID and Client Secret** to your `.env` file

## 🧪 Testing

Run the test script to verify all endpoints:
```bash
node test-auth-api.js
```

## 🏗️ Project Structure

```
src/lib/fastify/
├── app.ts                 # Main Fastify app configuration
├── plugins/               # Fastify plugins
│   ├── prisma.ts         # Prisma database plugin
│   ├── jwt.ts            # JWT authentication plugin
│   ├── oauth2.ts         # Google OAuth plugin
│   └── cookie.ts         # Cookie handling plugin
├── routes/               # API routes
│   ├── auth.ts           # Authentication routes
│   └── users.ts          # User management routes
├── middleware/           # Custom middleware
└── utils/               # Utility functions
    ├── auth.ts          # Authentication utilities
    └── token-blacklist.ts # Token blacklist management
```

## 🔒 Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Security**: Secure token generation and validation
- **Token Blacklist**: In-memory blacklist for logout functionality
- **HTTP-Only Cookies**: Prevent XSS attacks
- **CORS Protection**: Configurable cross-origin policies
- **Input Validation**: JSON Schema validation for all inputs
- **Rate Limiting**: Built-in Fastify rate limiting (can be added)

## 📝 Usage Examples

### Register a new user
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Access protected route
```bash
curl -X GET http://localhost:3001/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🚀 Production Deployment

1. **Environment Variables**: Set secure values for all secrets
2. **Database**: Consider using PostgreSQL or MySQL for production
3. **Token Storage**: Use Redis for token blacklist in production
4. **HTTPS**: Enable SSL/TLS for secure communication
5. **Rate Limiting**: Implement rate limiting for authentication endpoints
6. **Logging**: Configure proper logging and monitoring
7. **Domain**: Update OAuth redirect URIs to production domain

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

1. **Port already in use**: Change ports in `server.ts`
2. **Database connection error**: Check `DATABASE_URL` in `.env`
3. **Google OAuth error**: Verify redirect URI in Google Console
4. **JWT token invalid**: Check `JWT_SECRET` is consistent
5. **CORS errors**: Update `FRONTEND_URL` in `.env`

### Logs

Check the development logs:
```bash
tail -f dev.log
```

### Database Reset

Reset the database:
```bash
npm run db:reset
```