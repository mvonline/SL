FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund --loglevel=info

COPY . .

EXPOSE 5173

# Vite requires '--host 0.0.0.0' to be accessible outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
