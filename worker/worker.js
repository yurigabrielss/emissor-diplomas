require('dotenv').config();
const amqp = require('amqplib');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


setTimeout(() => {
  console.log(`Aguardando o RabbitMQ iniciar...`);
}, 10000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function connectRabbitMQ() {
  try {
    console.log('Tentando conectar ao RabbitMQ...');
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    const queue = 'certificates';

    await channel.assertQueue(queue, { durable: true });

    console.log('Conexão com RabbitMQ estabelecida.');
    await consumeMessages(channel);
  } catch (error) {
    console.error('Erro ao conectar ao RabbitMQ:', error);
    setTimeout(connectRabbitMQ, 10000);
  }
}

async function consumeMessages(channel) {
  channel.consume('certificates', async (msg) => {
    const { id } = JSON.parse(msg.content.toString());
    console.log(`Processando certificado com ID: ${id}`);

    try {
      const result = await pool.query('SELECT * FROM certificados WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        console.error(`Certificado com ID ${id} não encontrado.`);
        channel.nack(msg);
        return;
      }
      const certificado = result.rows[0];

      const pdfDir = path.join(__dirname, 'certificados_pdf');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }
      const pdfPath = path.join(pdfDir, `certificado_${id}.pdf`);

      await createPDF(certificado, pdfPath);

      console.log('Certificado gerado:', pdfPath);

      await pool.query('UPDATE certificados SET status = $1 WHERE id = $2', ['gerado', id]);

      channel.ack(msg);
    } catch (error) {
      console.error('Erro ao processar certificado:', error);
      channel.nack(msg);
    }
  });
}

async function createPDF(certificado, pdfPath) {
  const dataNascimentoFormatada = new Date(certificado.data_nascimento).toLocaleDateString();
  const dataConclusaoFormatada = new Date(certificado.data_conclusao).toLocaleDateString()

  const doc = new PDFDocument({ layout: 'landscape', margin: 50 });

  doc.pipe(fs.createWriteStream(pdfPath));

  doc.lineWidth(2).strokeColor('#003366')
    .rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();

  doc.lineWidth(1).strokeColor('#003366')
    .rect(40, 40, doc.page.width - 80, doc.page.height - 80).stroke();

  doc.fontSize(32).font('Times-Bold').fillColor('#003366').text('Certificado de Conclusão', {
    align: 'center'
  });
  doc.moveDown(2);

  doc.fontSize(16).font('Times-Roman').fillColor('#000000').text(
    `Certificamos que ${certificado.nome}, ${certificado.nacionalidade}, natural do Estado de ${certificado.estado}, nascido em ${dataNascimentoFormatada},
    RG ${certificado.documento}, concluiu em ${dataConclusaoFormatada} o curso de ${certificado.curso}, nível de especialização, com carga horária de ${certificado.carga_horaria} horas.`,
    {
      align: 'justify',
      indent: 20,
      lineGap: 6,
      paragraphGap: 10,
    }
  );

  doc.moveDown();

  doc.fontSize(14).text(
    'Este certificado é concedido em conformidade com o artigo 44, inciso 3358, da Lei 9394/96, e com a Resolução C.N.C./C.C.S. nº 01/07.',
    {
      align: 'center',
      lineGap: 6,
    }
  );

  doc.moveDown(3);

  doc.fontSize(14).text(`São Paulo, ${new Date().toLocaleDateString()}`, { align: 'center' });

  doc.moveDown(4);
  doc.lineWidth(1).moveTo(300, doc.y).lineTo(540, doc.y).stroke();
  doc.moveDown(0.5);
  doc.text(`${certificado.nome_assinatura}`, { align: 'center' });
  doc.text(`${certificado.cargo}`, { align: 'center' });
  
  doc.moveDown(2);
  doc.fontSize(12).text(`Instituição de Ensino XYZ`, { align: 'center' });

  doc.end();
}

module.exports = { createPDF };


connectRabbitMQ().catch(console.error);
