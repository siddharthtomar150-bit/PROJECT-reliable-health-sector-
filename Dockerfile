# Multi-stage Dockerfile for MediGo Hospital Finder
FROM node:20-slim AS runner

WORKDIR /app

# Install build dependencies for sqlite3 native bindings if needed
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production || npm install --production

# Copy application source
COPY . .

# Expose server port
ENV PORT=5000
EXPOSE 5000

# Run the hardened application
CMD ["node", "server.js"]
