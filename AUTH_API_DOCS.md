# Authentication API Documentation

## Base URL
`http://localhost:3001`

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

Register a new user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe" (optional)
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt_token_here"
}
```

### 2. Login User
**POST** `/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://example.com/avatar.jpg"
  },
  "token": "jwt_token_here"
}
```

### 3. Google OAuth Login
**GET** `/auth/google`

Redirect to Google OAuth for authentication.

**Response:** Redirect to Google OAuth page

### 4. Google OAuth Callback
**GET** `/auth/google/callback`

Handle callback from Google OAuth.

**Response (200):**
```json
{
  "message": "Google authentication successful",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://lh3.googleusercontent.com/..."
  },
  "token": "jwt_token_here"
}
```

### 5. Logout User
**POST** `/auth/logout`

Logout and invalidate the current JWT token.

**Headers:** `Authorization: Bearer <token>` or Cookie: `token=<token>`

**Response (200):**
```json
{
  "message": "Logout successful"
}
```

## User Endpoints (Protected)

All user endpoints require a valid JWT token.

### 1. Get Current User Profile
**GET** `/users/me`

Get the current authenticated user's profile.

**Headers:** `Authorization: Bearer <token>` or Cookie: `token=<token>`

**Response (200):**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "emailVerified": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Update User Profile
**PUT** `/users/me`

Update the current user's profile.

**Headers:** `Authorization: Bearer <token>` or Cookie: `token=<token>`

**Request Body:**
```json
{
  "name": "Jane Doe",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatar": "https://example.com/new-avatar.jpg",
    "emailVerified": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Change Password
**POST** `/users/me/change-password`

Change the user's password (only for users registered with email/password).

**Headers:** `Authorization: Bearer <token>` or Cookie: `token=<token>`

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully. Please login again."
}
```

### 4. Delete User Account
**DELETE** `/users/me`

Delete the current user's account.

**Headers:** `Authorization: Bearer <token>` or Cookie: `token=<token>`

**Response (200):**
```json
{
  "message": "Account deleted successfully"
}
```

## Health Check

### 1. Health Check
**GET** `/health`

Check if the API server is running and database is connected.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

## Authentication Methods

### 1. Bearer Token
Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### 2. Cookie
The token is automatically set in a cookie named `token` after login/register.

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation Error",
  "details": [...]
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid email or password"
}
```

### 404 Not Found
```json
{
  "error": "Route not found",
  "path": "/invalid-route"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Token Management

- JWT tokens expire after 7 days by default
- Tokens are invalidated on logout using an in-memory blacklist
- Password changes force re-login by invalidating the current token
- Tokens are stored in HTTP-only cookies for security

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT token validation
- Token blacklist for logout functionality
- CORS protection
- Input validation with JSON Schema
- HTTP-only cookies for token storage