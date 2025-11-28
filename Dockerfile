# Use the official Node.js image
FROM node:18

# Create working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the entire source code into the container
COPY . .

# Open port 5000
EXPOSE 5000

# Launch command
CMD ["npm", "start"]