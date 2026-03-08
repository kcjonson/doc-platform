# Architecture

This document covers Specboard's system design, infrastructure, and monorepo layout.

---

## System Overview

Specboard is a monorepo containing two products (Documentation Editor and Planning Board) that share a common backend, authentication system, and infrastructure. The application runs as containerized services on AWS ECS Fargate, with a PostgreSQL database, Redis session store, and S3 file storage.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users / Browser                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    ALB (HTTPS termination)                       │
│                                                                  │
│    /*        → Frontend       /api/*   → API                     │
│    /auth/*   → API            /mcp/*   → MCP                     │
└──────┬──────────────┬───────────────┬──────────────┬────────────┘
       │              │               │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│  Frontend   │ │    API     │ │    MCP     │ │  Storage   │
│   (Hono)    │ │   (Hono)   │ │   (Hono)   │ │   (Hono)   │
│             │ │            │ │            │ │            │
│ Static SPA  │ │ REST API   │ │ MCP tools  │ │ S3 proxy   │
│ + auth gate │ │ + auth     │ │ + OAuth    │ │ + metadata │
└──────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
       │              │               │              │
       └──────────────┼───────────────┘              │
                      │                              │
              ┌───────▼───────┐              ┌───────▼───────┐
              │    Redis      │              │      S3       │
              │  (sessions)   │              │   (files)     │
              └───────────────┘              └───────────────┘
                      │
              ┌───────▼───────┐
              │  PostgreSQL   │
              │  (RDS)        │
              └───────────────┘
```

---

## Services

### Frontend Container
- Hono server serving the built SPA (Vite output)
- Auth middleware validates the session cookie via Redis before serving any content
- No direct database access — all data flows through the API

### API Container
- Hono server handling REST endpoints and authentication
- Session-based auth with PostgreSQL users (bcrypt) and Redis sessions
- GitHub OAuth for repository access
- Manages projects, epics, tasks, documents, and file operations

### MCP Container
- Hono server implementing the Model Context Protocol (MCP)
- OAuth 2.1 + PKCE authentication for AI tool access
- Exposes planning tools (epics, tasks, progress tracking) to Claude Code and similar clients
- Streamable HTTP transport via the MCP SDK

### Storage Container
- Hono server proxying file operations to S3
- Manages file metadata in PostgreSQL
- Tracks pending changes for GitHub commit flow

### Supporting Services

| Service | Purpose |
|---------|---------|
| **PostgreSQL (RDS)** | Primary data store — users, projects, epics, tasks, file metadata |
| **Redis (ElastiCache)** | Session storage shared across containers |
| **S3** | File storage for cloud-mode project content |
| **GitHub Sync Lambda** | Syncs GitHub repositories to S3 (initial ZIP download + incremental via Compare API) |
| **SES** | Transactional email (verification, password reset) |

---

## Authentication

Session-based auth with two paths:

1. **Email + password** — user signs up with email, verifies via SES email, passwords stored with bcrypt
2. **GitHub OAuth** — connects a GitHub account to an existing user for repository access

Sessions are stored in Redis with a 30-day sliding TTL. The session ID is sent as an HttpOnly cookie. Both the Frontend and API containers validate sessions against the same Redis instance.

The MCP server uses a separate OAuth 2.1 + PKCE flow, issuing its own access/refresh tokens for AI tool clients.

---

## Data Flow: GitHub Integration

Specboard operates as a cloud workspace that syncs with GitHub:

```
GitHub Repository
    │
    ├── Initial sync: Lambda downloads ZIP → streams to S3
    ├── Incremental sync: Lambda uses Compare API → updates changed files in S3
    │
    ▼
S3 (cloud storage) ◄──── User edits in browser (saved as pending changes)
    │
    └── Commit: API uses GraphQL createCommitOnBranch → pushes to GitHub
```

Conflict detection uses GitHub's `expectedHeadOid` parameter — if the branch has moved since the last sync, the commit is rejected and the user must re-sync first.

---

## Monorepo Structure

```
specboard/
├── shared/                      # Shared libraries
│   ├── pages/                   # Documentation editor components (no build step)
│   ├── planning/                # Planning board components (no build step)
│   ├── core/                    # Shared types and utilities
│   ├── ui/                      # Reusable Preact components
│   ├── db/                      # Database connection, migrations, service layer
│   ├── auth/                    # Session management, auth middleware, encryption
│   ├── email/                   # Email sending (SES + dev console mode)
│   ├── platform/                # Platform abstraction interfaces
│   ├── platform-electron/       # Electron implementations
│   ├── platform-web/            # Web implementations
│   ├── models/                  # Observable state management (Model/SyncModel)
│   ├── router/                  # Custom client-side router
│   └── fetch/                   # Custom HTTP client wrapper
├── web/                         # Unified web app (Vite + Preact)
├── docs-desktop/                # Documentation editor Electron app
├── planning-desktop/            # Planning board Electron app
├── api/                         # Backend API server (Hono)
├── frontend/                    # Frontend server (Hono, serves SPA)
├── mcp/                         # MCP server for AI tool integration
├── storage/                     # Storage service (S3 proxy + metadata)
├── sync-lambda/                 # GitHub sync Lambda function
├── infra/                       # AWS CDK infrastructure
└── docs/                        # Project documentation and specs
```

### Package Types

**Feature source** (`shared/pages/`, `shared/planning/`) — Preact components with co-located CSS Modules and tests. No independent build step; compiled by consuming apps via Vite. Imported as `@shared/pages` and `@shared/planning`.

**Internal packages** (`shared/db/`, `shared/auth/`, etc.) — built TypeScript libraries consumed by backend services. Published to the npm workspace, not to a registry.

**Apps** (`web/`, `api/`, `frontend/`, `mcp/`, `storage/`) — deployable services, each with its own Dockerfile.

---

## Infrastructure (AWS)

All infrastructure is defined in TypeScript using AWS CDK, deployed to a single AWS account with environment prefixes (staging vs production).

### Compute
- **ECS Fargate** — runs all containers (API, Frontend, MCP, Storage)
- **Lambda** — GitHub sync function (ZIP download + incremental updates)

### Data
- **RDS PostgreSQL 16** — primary database (t4g.micro staging, t4g.medium production)
- **ElastiCache Redis** — session storage
- **S3** — file storage for cloud-mode projects

### Networking
- **ALB** — path-based routing to containers, TLS termination
- **VPC** — isolated network with public/private subnets

### Security
- **Secrets Manager** — database credentials, OAuth secrets, encryption keys
- **GitHub OIDC** — keyless authentication for CI/CD deployments
- **WAF** — AWS managed rules for production (OWASP Top 10, SQL injection, rate limiting)

### CI/CD
- **GitHub Actions** — build, test, deploy pipeline
- **ECR** — Docker image registry with SHA-tagged promotion (staging → production)
- Staging deploys on push to main; production deploys on GitHub release

---

## Local Development

The entire stack runs locally via Docker Compose, mirroring the production architecture:

| Service | Container Port | Description |
|---------|---------------|-------------|
| nginx | 80 | Reverse proxy (matches ALB routing) |
| db | 5432 | PostgreSQL 16 |
| redis | 6379 | Session storage |
| api | 3001 | Backend API |
| frontend | 3000 | Frontend server |
| mcp | 3002 | MCP server |

See [setup.md](setup.md) for detailed setup instructions.
