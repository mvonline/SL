FROM node:20-alpine

# Install SQLite dependencies if needed
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund --omit=optional

COPY . .

# Ensure the log and data directories have proper permissions
RUN mkdir -p /data /var/log/transit

EXPOSE 3000

CMD ["npm", "run", "dev"]
