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
    chown -R pwuser:pwuser /usr/src/app

# Set the user to non-root
USER pwuser

# Command to run the actor
CMD ["npm", "start"]
