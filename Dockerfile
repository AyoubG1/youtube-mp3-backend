# Use the official Node.js image as the base image
FROM node:16

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Python 3.9, pip, yt-dlp, and ffmpeg
RUN apt-get update && apt-get install -y \
    python3.9 \
    python3.9-dev \
    python3.9-distutils \
    wget \
    ffmpeg \
    && wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && python3.9 -m ensurepip --upgrade \
    && python3.9 -m pip install --upgrade pip

# Copy the rest of the application files
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]


