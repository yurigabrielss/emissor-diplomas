require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

// Configuração do banco de dados
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });  

// Configuração do RabbitMQ
let channel;
async function connectRabbitMQ() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue('certificates');
}
connectRabbitMQ().catch(console.error);

// Endpoint para criar certificado
app.post('/certificados', async (req, res) => {
  const {
    nome,
    nacionalidade,
    estado,
    data_nascimento,
    documento,
    data_conclusao,
    curso,
    carga_horaria,
    nome_assinatura,
    cargo,
  } = req.body;

  try {
    // Insere o novo certificado no banco
    const result = await pool.query(
      `INSERT INTO certificados 
        (nome, nacionalidade, estado, data_nascimento, documento, data_conclusao, curso, carga_horaria, nome_assinatura, cargo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pendente')
       RETURNING id`,
      [nome, nacionalidade, estado, data_nascimento, documento, data_conclusao, curso, carga_horaria, nome_assinatura, cargo]
    );

    const certificadoId = result.rows[0].id;

    // Envia o ID para o RabbitMQ
    channel.sendToQueue('certificates', Buffer.from(JSON.stringify({ id: certificadoId })));

    res.status(201).json({ id: certificadoId, message: 'Certificado criado e enviado para processamento.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar o certificado' });
  }
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
