# Authentication Specification

This specification defines the authentication and authorization architecture for doc-platform.

---

## Overview

The authentication system handles:
1. **User accounts** - Email/password via AWS Cognito
2. **Storage provider connections** - GitHub OAuth (others in future)
3. **API authentication** - JWT tokens
4. **MCP authentication** - OAuth 2.1 + PKCE for Claude Code

Key principles:
- Users own their accounts (not tied to GitHub)
- GitHub is a connected storage provider, not identity
- Email is NOT the primary key
- Backend proxies all GitHub API calls

---

## User Identity Model

### Database Schema

```sql
-- Users table (primary identity)
CREATE TABLE users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	cognito_sub VARCHAR(255) UNIQUE NOT NULL,
	display_name VARCHAR(255) NOT NULL,
	avatar_url TEXT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User emails (multiple per user)
CREATE TABLE user_emails (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	email VARCHAR(255) NOT NULL,
	is_primary BOOLEAN DEFAULT FALSE,
	is_verified BOOLEAN DEFAULT FALSE,
	verified_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	UNIQUE(email)
);

-- Ensure one primary email per user
CREATE UNIQUE INDEX idx_user_primary_email
	ON user_emails(user_id)
	WHERE is_primary = TRUE;

-- GitHub connections
CREATE TABLE github_connections (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	github_user_id VARCHAR(255) NOT NULL,
	github_username VARCHAR(255) NOT NULL,
	access_token TEXT NOT NULL,  -- Encrypted with KMS
	refresh_token TEXT,          -- Encrypted with KMS
	token_expires_at TIMESTAMP WITH TIME ZONE,
	scopes TEXT[] NOT NULL,
	connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	UNIQUE(user_id),
	UNIQUE(github_user_id)
);

-- MCP OAuth tokens
CREATE TABLE mcp_tokens (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	client_id VARCHAR(255) NOT NULL,
	access_token_hash VARCHAR(255) NOT NULL,
	refresh_token_hash VARCHAR(255),
	scopes TEXT[] NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	UNIQUE(access_token_hash)
);

-- OAuth authorization codes (short-lived)
CREATE TABLE oauth_codes (
	code VARCHAR(255) PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	client_id VARCHAR(255) NOT NULL,
	code_challenge VARCHAR(255) NOT NULL,
	code_challenge_method VARCHAR(10) NOT NULL,
	scopes TEXT[] NOT NULL,
	redirect_uri TEXT NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### Data Structures

```
User:
  id: UUID (primary key)
  cognitoSub: string (from Cognito)
  displayName: string
  avatarUrl: string (optional)
  createdAt: timestamp
  updatedAt: timestamp

UserEmail:
  id: UUID
  userId: UUID (foreign key)
  email: string (unique)
  isPrimary: boolean
  isVerified: boolean
  verifiedAt: timestamp (optional)

GitHubConnection:
  id: UUID
  userId: UUID (foreign key)
  githubUserId: string
  githubUsername: string
  accessToken: string (encrypted)
  refreshToken: string (optional, encrypted)
  tokenExpiresAt: timestamp (optional)
  scopes: string[]
  connectedAt: timestamp
```

---

## AWS Cognito Setup

### User Pool Configuration

| Setting | Value |
|---------|-------|
| Self-signup | Enabled |
| Sign-in aliases | Email only |
| Auto-verify | Email |
| Password policy | Min 8, upper, lower, digit |
| MFA | Optional (TOTP only) |
| Account recovery | Email only |

### App Client Configuration

| Setting | Value |
|---------|-------|
| Auth flows | USER_SRP_AUTH, USER_PASSWORD_AUTH |
| OAuth flows | Authorization code grant |
| OAuth scopes | email, openid, profile |
| Callback URLs | localhost:3000, app.doc-platform.com |
| Generate secret | No (public client) |

### Post-Confirmation Trigger

When a user confirms their email in Cognito:
1. Lambda trigger fires
2. Creates user record in our database with Cognito sub
3. Creates user_emails record with verified email

---

## Authentication Flows

### 1. User Registration

```
Browser                        API                         Cognito
   │                            │                            │
   │ POST /auth/signup          │                            │
   │ {email, password, name}    │                            │
   │───────────────────────────►│                            │
   │                            │                            │
   │                            │ SignUp                     │
   │                            │───────────────────────────►│
   │                            │◄───────────────────────────│
   │                            │                            │
   │◄───────────────────────────│                            │
   │ {message: "Check email"}   │                            │
   │                            │                            │
   │ User clicks email link     │                            │
   │                            │                            │
   │ GET /auth/verify?code=xxx  │                            │
   │───────────────────────────►│                            │
   │                            │ ConfirmSignUp              │
   │                            │───────────────────────────►│
   │                            │                            │
   │                            │ Post-confirmation trigger  │
   │                            │ creates DB records         │
   │                            │◄───────────────────────────│
   │◄───────────────────────────│                            │
   │ Redirect to login          │                            │
```

### 2. User Login

```
Browser                        API                         Cognito
   │                            │                            │
   │ POST /auth/login           │                            │
   │ {email, password}          │                            │
   │───────────────────────────►│                            │
   │                            │                            │
   │                            │ InitiateAuth (USER_SRP)    │
   │                            │───────────────────────────►│
   │                            │◄───────────────────────────│
   │                            │                            │
   │◄───────────────────────────│                            │
   │ {                          │                            │
   │   accessToken,             │                            │
   │   idToken,                 │                            │
   │   refreshToken (cookie)    │                            │
   │ }                          │                            │
```

### 3. Token Refresh

When access token expires:
1. Frontend calls POST /auth/refresh
2. Backend reads refresh token from HttpOnly cookie
3. Backend calls Cognito REFRESH_TOKEN_AUTH
4. Returns new access + ID tokens

---

## GitHub Connection

### OAuth Flow

```
Browser                        API                         GitHub
   │                            │                            │
   │ GET /auth/github/connect   │                            │
   │───────────────────────────►│                            │
   │                            │                            │
   │                            │ Generate state token       │
   │                            │ Store in session           │
   │                            │                            │
   │◄───────────────────────────│                            │
   │ Redirect to:               │                            │
   │ github.com/login/oauth     │                            │
   │ ?client_id=xxx             │                            │
   │ &scope=repo,user:email     │                            │
   │ &state=xxx                 │                            │
   │────────────────────────────────────────────────────────►│
   │                            │                            │
   │ User authorizes            │                            │
   │                            │                            │
   │◄────────────────────────────────────────────────────────│
   │ Redirect to callback       │                            │
   │ ?code=xxx&state=xxx        │                            │
   │                            │                            │
   │ GET /auth/github/callback  │                            │
   │ ?code=xxx&state=xxx        │                            │
   │───────────────────────────►│                            │
   │                            │                            │
   │                            │ Verify state               │
   │                            │                            │
   │                            │ POST /access_token         │
   │                            │ {code, client_secret}      │
   │                            │───────────────────────────►│
   │                            │◄───────────────────────────│
   │                            │ {access_token}             │
   │                            │                            │
   │                            │ GET /user                  │
   │                            │───────────────────────────►│
   │                            │◄───────────────────────────│
   │                            │ {id, login, ...}           │
   │                            │                            │
   │                            │ Encrypt & store token      │
   │                            │ Create github_connection   │
   │                            │                            │
   │◄───────────────────────────│                            │
   │ Redirect to /settings      │                            │
   │ GitHub connected!          │                            │
```

### Token Encryption

GitHub tokens are encrypted at rest:
- Use AWS KMS for encryption/decryption
- Key rotation enabled
- Tokens decrypted only when calling GitHub API

### GitHub API Proxy

All GitHub API calls go through our backend:
1. Frontend requests /api/github/* endpoint
2. Backend retrieves user's encrypted token
3. Backend decrypts token via KMS
4. Backend calls GitHub API with token
5. Backend returns response to frontend

**Important**: Browser NEVER has access to GitHub token.

### Required GitHub Scopes

| Scope | Purpose |
|-------|---------|
| `repo` | Full access to private and public repositories |
| `user:email` | Read user email addresses (for matching) |

---

## MCP Authentication (OAuth 2.1 + PKCE)

### OAuth Metadata Endpoint

`GET /.well-known/oauth-authorization-server`

Returns:
- issuer
- authorization_endpoint
- token_endpoint
- revocation_endpoint
- scopes_supported: docs:read, docs:write, tasks:read, tasks:write
- response_types_supported: code
- grant_types_supported: authorization_code, refresh_token
- code_challenge_methods_supported: S256

### Authorization Flow

1. Claude Code generates PKCE code_verifier and code_challenge
2. Redirects to /oauth/authorize with:
   - client_id
   - redirect_uri
   - response_type=code
   - scope
   - state
   - code_challenge
   - code_challenge_method=S256
3. User logs in (if not already)
4. Backend generates authorization code
5. Redirects back with code and state
6. Claude Code exchanges code for tokens via /oauth/token:
   - code
   - code_verifier
   - grant_type=authorization_code
7. Backend verifies PKCE challenge
8. Returns access_token and refresh_token

### MCP Token Scopes

| Scope | Description | Allows |
|-------|-------------|--------|
| `docs:read` | Read documents | get_document, search_docs, list_documents |
| `docs:write` | Modify documents | create_document, update_document |
| `tasks:read` | Read tasks | get_task, get_epic, get_backlog |
| `tasks:write` | Modify tasks | create_task, update_task |

---

## API Authentication Middleware

### Token Validation

For each authenticated request:
1. Extract Bearer token from Authorization header
2. Try to verify as Cognito JWT
3. If Cognito fails, try to verify as MCP token
4. Load user from database
5. Attach user to request context

### Scope Enforcement (MCP only)

For MCP tokens, check required scope before executing:
- docs:read for document read operations
- docs:write for document write operations
- tasks:read for task read operations
- tasks:write for task write operations

---

## Token Lifetimes

| Token | Lifetime | Refresh |
|-------|----------|---------|
| Cognito Access Token | 1 hour | Via refresh token |
| Cognito ID Token | 1 hour | Via refresh token |
| Cognito Refresh Token | 30 days | Re-authenticate |
| MCP Access Token | 1 hour | Via refresh token |
| MCP Refresh Token | 30 days | Re-authorize |
| GitHub Access Token | No expiry* | N/A |

*GitHub tokens don't expire but can be revoked by user.

---

## Security Considerations

### Token Storage (Frontend)

- Access/ID tokens: Memory only (NOT localStorage)
- Refresh token: HttpOnly cookie (set by server)
- On page refresh: Call /auth/refresh to get new access token

### CSRF Protection

- Generate CSRF token per session
- Validate on all state-changing requests (POST, PUT, DELETE)
- Token sent via X-CSRF-Token header

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| /auth/login | 5 attempts per 15 minutes |
| /auth/signup | 3 per hour per IP |
| General API | 100 requests per minute |

---

## Infrastructure (CDK)

### Components to Deploy

| Resource | Purpose |
|----------|---------|
| Cognito User Pool | User authentication |
| Cognito App Client | Web app authentication |
| KMS Key | GitHub token encryption |
| Lambda (Post-Confirmation) | Create user records on signup |

### KMS Key Configuration

- Enable key rotation
- Grant access to API service role
- Use for encrypt/decrypt of GitHub tokens only

---

## API Routes Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/signup | None | Create account |
| POST | /auth/login | None | Login |
| POST | /auth/refresh | Cookie | Refresh tokens |
| POST | /auth/logout | JWT | Logout |
| GET | /auth/github/connect | JWT | Start GitHub OAuth |
| GET | /auth/github/callback | Session | GitHub OAuth callback |
| DELETE | /auth/github | JWT | Disconnect GitHub |
| GET | /oauth/authorize | JWT | MCP OAuth authorize |
| POST | /oauth/token | None | MCP token exchange |
| POST | /oauth/revoke | None | Revoke MCP token |

---

## File Structure

```
apps/api/src/
├── auth/
│   ├── routes.ts           # Auth endpoints
│   ├── cognito.ts          # Cognito client
│   ├── github.ts           # GitHub OAuth
│   ├── mcp-oauth.ts        # MCP OAuth endpoints
│   ├── middleware.ts       # Auth middleware
│   └── tokens.ts           # Token utilities
├── middleware/
│   ├── auth.ts             # Auth middleware
│   ├── csrf.ts             # CSRF protection
│   └── rate-limit.ts       # Rate limiting
└── utils/
    └── encryption.ts       # KMS encryption
```
