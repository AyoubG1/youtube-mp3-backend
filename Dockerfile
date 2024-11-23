# Use the official Python 3.9 image as the base image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Install Node.js, yt-dlp, Puppeteer dependencies, and other required tools
RUN apt-get update && apt-get install -y \
    wget \
    ffmpeg \
    curl \
    gnupg \
    lsb-release \
    libnss3 \
    libatk1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libxcb-dri3-0 \
    libgbm-dev \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/* \
    # Install Node.js
    && curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
    && apt-get install -y nodejs

# Install yt-dlp globally
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Install Puppeteer and Node.js dependencies
RUN npm install puppeteer

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Copy the cookies file (if manually exporting cookies)
COPY cookies.txt /app/cookies.txt

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]

