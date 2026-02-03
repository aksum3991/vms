FROM node:20-alpine
WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Ensure Prisma runs on Alpine by installing required system libraries
RUN apk add --no-cache libc6-compat openssl

# Copy Prisma schema BEFORE install so postinstall `prisma generate` succeeds
COPY prisma ./prisma

# Install dependencies (postinstall will now find the schema)
RUN npm install --legacy-peer-deps

# Copy the rest of the application source
COPY . .

# Build the application (includes prisma generate via the build script)
RUN npm run build

ENV PORT=3000
EXPOSE 3000

# Push schema and seed on container start, then start Next.js
CMD sh -c "npx prisma db push && npx prisma db seed && npm run start"
