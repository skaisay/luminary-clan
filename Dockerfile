# Node.js 20 with system FFmpeg for Discord music bot
FROM node:20-slim

# Install FFmpeg, yt-dlp, and build tools for native addons (sodium-native, opusscript)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    make \
    g++ \
    libsodium-dev \
    && pip3 install --break-system-packages yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build step)
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the application (vite build + esbuild server bundle)
RUN npm run build

# Push schema to database (creates new tables if missing)
# This runs at build time — DATABASE_URL must be available as a build-time arg or env
ARG DATABASE_URL
RUN if [ -n "$DATABASE_URL" ]; then npx drizzle-kit push --force; fi

# Prune devDependencies to reduce image size
RUN npm prune --production

# Expose the port Render assigns
EXPOSE ${PORT:-5000}

# Start the server
CMD ["node", "dist/index.js"]
