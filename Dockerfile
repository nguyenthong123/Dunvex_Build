# Minimal Dockerfile for running the Dunvex Build server + static frontend
FROM node:18-bullseye-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
