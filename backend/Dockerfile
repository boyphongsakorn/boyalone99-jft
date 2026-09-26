# Use an official lightweight Node.js image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# The app binds to port 3000 by default
EXPOSE 3000

# Start the server
CMD [ "node", "index.js" ]
