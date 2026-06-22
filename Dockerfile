FROM node:20-alpine
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# Copiar código fuente
COPY src ./src

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
