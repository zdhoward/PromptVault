FROM node:18-alpine

# Install build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY server.js ./
COPY public ./public

# Create data directory
RUN mkdir -p /app/data && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose ports
EXPOSE 3000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/prompts', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start both API server and static file server
CMD sh -c "node server.js & npx serve public -p 8080 -n"