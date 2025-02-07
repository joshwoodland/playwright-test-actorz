FROM mcr.microsoft.com/playwright:v1.30.0-jammy

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript files
RUN npm run build

# Set the user to non-root
USER pwuser

# Command to run the actor
CMD ["npm", "start"] 