# Usa uma imagem Node.js como base
FROM node:18

# Define o diretório de trabalho no contêiner
WORKDIR /app

# Copia o arquivo package.json e instala as dependências do Node
COPY package*.json ./
RUN npm install

# Copia os arquivos restantes do código para o diretório de trabalho
COPY . .

# Define o comando padrão para iniciar o worker
CMD ["npm", "start"]
