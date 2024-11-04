FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Definindo o comando padrão para iniciar o worker
CMD ["npm", "start"]

