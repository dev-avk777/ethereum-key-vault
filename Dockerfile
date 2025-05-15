# Use official Node.js image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Pass NODE_ENV at build stage
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm@10.8.1

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Compile TypeScript
RUN pnpm build

# Create production image
FROM node:20-alpine

# Install curl
RUN apk add --no-cache curl

WORKDIR /app

# Pass NODE_ENV at runtime
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm@10.8.1

# Check that pnpm is installed
RUN pnpm --version || { echo "pnpm not found"; exit 1; }

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Specify port
EXPOSE 5000

# Run application
CMD ["pnpm", "start:prod"]