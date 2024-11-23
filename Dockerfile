# Use the official Node.js image as the base image
FROM node:16

# Set the working directory in the container
WORKDIR /app

# Install required dependencies
RUN apt-get update && apt-get install -y \
    wget \
    ffmpeg \
    python3.9 \
    python3.9-dev \
    python3.9-distutils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Ensure pip is installed
RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py \
    && python3.9 get-pip.py

# Install yt-dlp Python dependencies
RUN python3.9 -m pip install --upgrade pip

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]



