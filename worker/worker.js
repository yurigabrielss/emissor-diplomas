require('dotenv').config();
const amqp = require('amqplib');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Aguardar 10 segundos para o RabbitMQ iniciar
setTimeout(() => {
  console.log(`Aguardando o RabbitMQ iniciar...`);
}, 10000);

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Função para conectar ao RabbitMQ
async function connectRabbitMQ() {
  try {
    console.log('Tentando conectar ao RabbitMQ...');
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    const queue = 'certificates';

    // Verificar se a fila existe
    await channel.assertQueue(queue, { durable: true });

    console.log('Conexão com RabbitMQ estabelecida.');
    await consumeMessages(channel);
  } catch (error) {
    console.error('Erro ao conectar ao RabbitMQ:', error);
    setTimeout(connectRabbitMQ, 5000); // Tentativa de reconexão após 5 segundos
  }
}

// Função para consumir mensagens da fila RabbitMQ
async function consumeMessages(channel) {
  channel.consume('certificates', async (msg) => {
    const { id } = JSON.parse(msg.content.toString());
    console.log(`Processando certificado com ID: ${id}`);

    try {
      // Obter dados do certificado do banco de dados
      const result = await pool.query('SELECT * FROM certificados WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        console.error(`Certificado com ID ${id} não encontrado.`);
        channel.nack(msg); // Rejeita a mensagem
        return;
      }
      const certificado = result.rows[0];

      // Diretório para salvar o PDF
      const pdfDir = path.join(__dirname, 'certificados_pdf');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }
      const pdfPath = path.join(pdfDir, `certificado_${id}.pdf`);

      // Gerar o PDF
      await createPDF(certificado, pdfPath);

      console.log('Certificado gerado:', pdfPath);

      // Atualizar status do certificado no banco de dados
      await pool.query('UPDATE certificados SET status = $1 WHERE id = $2', ['gerado', id]);

      // Reconhecer a mensagem processada
      channel.ack(msg);
    } catch (error) {
      console.error('Erro ao processar certificado:', error);
      channel.nack(msg); // Rejeitar a mensagem em caso de erro
    }
  });
}

async function createPDF(certificado, pdfPath) {
  const doc = new PDFDocument({ layout: 'landscape', margin: 50 });

  // Salvar o PDF no caminho especificado
  doc.pipe(fs.createWriteStream(pdfPath));

  // Desenhar borda externa
  doc.lineWidth(2).strokeColor('#003366')
    .rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();

  // Desenhar borda interna
  doc.lineWidth(1).strokeColor('#003366')
    .rect(40, 40, doc.page.width - 80, doc.page.height - 80).stroke();

  // Adicionar título principal
  doc.fontSize(32).font('Times-Bold').fillColor('#003366').text('Certificado de Conclusão', {
    align: 'center'
  });
  doc.moveDown(2);

  // Inserir o texto principal com espaçamento apropriado e alinhamento
  doc.fontSize(16).font('Times-Roman').fillColor('#000000').text(
    `Certificamos que ${certificado.nome}, ${certificado.nacionalidade}, natural do Estado de ${certificado.estado}, nascido em ${certificado.data_nascimento}, RG ${certificado.documento}, concluiu em ${certificado.data_conclusao} o curso de ${certificado.curso}, nível de especialização, com carga horária de ${certificado.carga_horaria} horas.`,
    {
      align: 'justify',
      indent: 20,
      lineGap: 6,
      paragraphGap: 10,
    }
  );

  doc.moveDown();

  // Adicionar o parágrafo final com a legislação
  doc.fontSize(14).text(
    'Este certificado é concedido em conformidade com o artigo 44, inciso 3358, da Lei 9394/96, e com a Resolução C.N.C./C.C.S. nº 01/07.',
    {
      align: 'center',
      lineGap: 6,
    }
  );

  doc.moveDown(3);

  // Adicionar a data de emissão
  doc.fontSize(14).text(`São Paulo, ${new Date().toLocaleDateString()}`, { align: 'center' });

  // Espaço para assinatura
  doc.moveDown(4);
  doc.lineWidth(1).moveTo(300, doc.y).lineTo(540, doc.y).stroke();
  doc.moveDown(0.5);
  doc.text(`${certificado.nome_assinatura}`, { align: 'center' });
  doc.text(`${certificado.cargo}`, { align: 'center' });
  
  doc.moveDown(2);
  doc.fontSize(12).text(`Instituição de Ensino XYZ`, { align: 'center' });

  // Finalizar o PDF
  doc.end();
}

module.exports = { createPDF };


// Iniciar o worker
connectRabbitMQ().catch(console.error);
