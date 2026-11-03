# Recette de la boite "api" (backend Node.js)
FROM node:20-alpine
WORKDIR /app

# 1) On installe les dependances (en premier, pour profiter du cache Docker)
COPY package*.json ./
RUN npm install --omit=dev

# 2) On copie le code
COPY . .

EXPOSE 4000
CMD ["npm", "start"]
