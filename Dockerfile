# Use official Puppeteer image as base (includes Chrome + all dependencies)
FROM ghcr.io/puppeteer/puppeteer:21.6.1 AS base

# Switch to root to install additional packages
USER root

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Change ownership to pptruser (default user in Puppeteer image)
RUN chown -R pptruser:pptruser /app

# Switch to non-root user
USER pptruser

# Expose port
EXPOSE 5099

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5099', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "app.js"]
