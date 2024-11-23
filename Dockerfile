# Use an official Node.js runtime as a base image
FROM node:16

# Install yt-dlp
RUN apt-get update && apt-get install -y yt-dlp

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the rest of the application (all other files)
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
