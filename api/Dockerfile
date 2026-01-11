# ===== DEV TARGET =====
# Used by docker-compose for local development with hot reloading
FROM node:25-alpine AS dev

RUN npm install -g pnpm@9.15.1
RUN apk add --no-cache git

WORKDIR /app

# Copy workspace config and package files
COPY api/pnpm-workspace.docker.yaml ./pnpm-workspace.yaml
COPY package.json pnpm-lock.yaml ./
COPY shared/core/package.json ./shared/core/
COPY shared/db/package.json ./shared/db/
COPY shared/auth/package.json ./shared/auth/
COPY shared/email/package.json ./shared/email/
COPY api/package.json ./api/
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for tsx, etc.)
RUN pnpm install --frozen-lockfile

# Download AWS RDS CA bundle for SSL certificate verification
RUN wget -O /app/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Source code is mounted at runtime via docker-compose volumes
EXPOSE 3001

CMD ["node", "--watch", "api/src/index.ts"]

# ===== PRODUCTION STAGE =====
# Node 25 runs TypeScript directly, no build step needed
FROM node:25-alpine AS runner

# Install git for project storage git operations
RUN apk add --no-cache git

RUN npm install -g pnpm@9.15.1

WORKDIR /app

# Download AWS RDS CA bundle for SSL certificate verification
RUN wget -O /app/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Copy workspace config and package files
COPY api/pnpm-workspace.docker.yaml ./pnpm-workspace.yaml
COPY package.json pnpm-lock.yaml ./
COPY shared/core/package.json ./shared/core/
COPY shared/db/package.json ./shared/db/
COPY shared/auth/package.json ./shared/auth/
COPY shared/email/package.json ./shared/email/
COPY api/package.json ./api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy source code (Node 25 runs TypeScript directly)
COPY tsconfig.json ./
COPY shared/core ./shared/core
COPY shared/db ./shared/db
COPY shared/auth ./shared/auth
COPY shared/email ./shared/email
COPY api ./api

EXPOSE 3001

CMD ["node", "api/src/index.ts"]
