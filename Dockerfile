# CodeFlow Real Java Execution Backend
# Production container with Node.js 22 + OpenJDK 21 for real javac & java execution on Render
FROM node:22-bookworm-slim

# Install OpenJDK 21 (headless) and essential system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jdk-headless \
    ca-certificates \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Dynamically link default JVM to ensure portability across CPU architectures (amd64, arm64)
RUN ln -sf $(dirname $(dirname $(readlink -f $(which javac)))) /usr/lib/jvm/default-jvm
ENV JAVA_HOME=/usr/lib/jvm/default-jvm
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Verify JDK 21 installation at image build time
RUN javac -version && java -version

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build frontend production bundle for static hosting
RUN npm run build

# Secure application directory: owned by root, read-only to unprivileged node user
RUN chown -R root:root /app && chmod -R 755 /app

# Drop root privileges: run container as unprivileged node user (uid 1000)
USER node

# Render supplies the PORT environment variable dynamically (defaults to 3000)
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Start Express Java Execution Server
CMD ["npm", "run", "start"]
