FROM node:20-slim

WORKDIR /app

# Instalar pg_dump para backups
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000 8080

CMD ["node", "server.js"]
