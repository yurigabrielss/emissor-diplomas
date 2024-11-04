require('dotenv').config();
const amqp = require('amqplib');
const { Pool } = require('pg');
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Conexão com o RabbitMQ
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue('certificates');

    channel.consume('certificates', async (msg) => {
      const { id } = JSON.parse(msg.content.toString());
      console.log(`Processando certificado com ID: ${id}`);

      try {
        // Obter dados do certificado do banco de dados
        const result = await pool.query('SELECT * FROM certificados WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          console.error('Certificado não encontrado');
          channel.nack(msg); // Not acknowledge the message
          return;
        }
        const certificado = result.rows[0];

        // Criar o PDF
        const html = generateHTML(certificado);
        const pdfDir = path.join(__dirname, 'desktop');

        // Verifica se o diretório existe e cria se necessário
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir);
        }

        const pdfPath = path.join(pdfDir, `certificado_${id}.pdf`);

        // Gerar PDF e aguardar a conclusão
        await createPDF(html, pdfPath);

        console.log('Certificado gerado:', pdfPath);

        // Atualizar status do certificado no banco
        await pool.query('UPDATE certificados SET status = $1 WHERE id = $2', ['gerado', id]);

        // Enviar reconhecimento ao RabbitMQ
        channel.ack(msg);
      } catch (error) {
        console.error('Erro ao processar certificado:', error);
        channel.nack(msg);
      }
    });
  } catch (error) {
    console.error('Erro ao conectar ao RabbitMQ:', error);
    setTimeout(connectRabbitMQ, 5000); // Retry after 5 seconds
  }
}

// Função para criar PDF
function createPDF(html, pdfPath) {
  return new Promise((resolve, reject) => {
    pdf.create(html).toFile(pdfPath, (err, res) => {
      if (err) {
        reject('Erro ao criar PDF: ' + err);
      } else {
        resolve(res);
      }
    });
  });
}

// Função para gerar HTML para o certificado
function generateHTML(certificado) {
  return `...`; // Seu HTML aqui
}

// Iniciar o Worker
connectRabbitMQ().catch(console.error);

