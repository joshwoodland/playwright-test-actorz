FROM mcr.microsoft.com/playwright:v1.30.0-jammy

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p test-results && \
    mkdir -p playwright-report && \
    mkdir -p test-results/.playwright-artifacts-0 && \
    mkdir -p /usr/src/app/videos && \
    chown -R pwuser:pwuser /usr/src/app && \
    chmod -R 777 /usr/src/app/videos /usr/src/app/test-results /usr/src/app/playwright-report

# Verify directories exist and have correct permissions
RUN ls -la /usr/src/app/videos && \
    ls -la /usr/src/app/test-results && \
    ls -la /usr/src/app/playwright-report

# Set the user to non-root
USER pwuser

# Command to run the actor
CMD ["npm", "start"]
