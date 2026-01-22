FROM node:20-alpine

# Create non-root user first
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy package files and install dependencies
COPY --chown=nodejs:nodejs package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY --chown=nodejs:nodejs index.js ./

# Switch to non-root user
USER nodejs

# Expose the port Code Engine expects
EXPOSE 8080

# Start the server
CMD ["node", "index.js"]
