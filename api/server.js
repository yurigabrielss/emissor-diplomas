require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue('certificates');
    console.log('Conectado ao RabbitMQ com sucesso');
  } catch (error) {
    console.error('Erro ao conectar ao RabbitMQ:', error);
  }
}
connectRabbitMQ();

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
    const result = await pool.query(
      `INSERT INTO certificados 
        (nome, nacionalidade, estado, data_nascimento, documento, data_conclusao, curso, carga_horaria, nome_assinatura, cargo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pendente')
       RETURNING id`,
      [nome, nacionalidade, estado, data_nascimento, documento, data_conclusao, curso, carga_horaria, nome_assinatura, cargo]
    );

    const certificadoId = result.rows[0].id;

    if (channel) {
      channel.sendToQueue('certificates', Buffer.from(JSON.stringify({ id: certificadoId })));
    } else {
      console.error('Canal RabbitMQ não disponível');
    }

    res.status(201).json({ id: certificadoId, message: 'Certificado criado e enviado para processamento.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar o certificado' });
  }
});

app.get('/certificados', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM certificados');
      res.json(result.rows);
  } catch (error) {
      console.error('Erro ao buscar certificados:', error);
      res.status(500).json({ error: 'Erro ao buscar certificados' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});

