// ======================================================
// --- 1. 模块引入与配置 ---
// ======================================================
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const axios = require('axios');
const { Resend } = require('resend');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// --- 2. 环境变量检查 ---
// ======================================================
const requiredEnvVars = [
    'DATABASE_URL', 
    'JWT_SECRET', 
    'PASSWORD_RESET_SECRET', 
    'BASE_URL', 
    'TURNSTILE_SECRET_KEY', 
    'RESEND_API_KEY', 
    'MAIL_FROM_ADDRESS', 
    'CRON_SECRET'
];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.warn(`警告: 缺少环境变量 "${varName}"，部分功能可能受限。`);
    }
});

// ======================================================
// --- 3. 数据库与第三方服务初始化 ---
// ======================================================
// 解析 MySQL 连接字符串
function parseMySQLConnectionString(uri) {
    const url = new URL(uri);
    return {
        host: url.hostname,
        port: parseInt(url.port, 10),
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1) // 移除开头的 /
    };
}

const dbConfig = parseMySQLConnectionString(process.env.DATABASE_URL);

// 创建 MySQL 连接池
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5, // Vercel Serverless 环境下建议保持较小的连接数
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false // 适配大多数云端 MySQL (如 TiDB, Aiven, 阿里云)
    }
});

// 测试数据库连接
pool.getConnection().then(conn => {
    console.log('Database connected successfully');
    conn.release();
}).catch(err => {
    console.error('Database connection failed:', err);
});

const resend = new Resend(process.env.RESEND_API_KEY);
const verificationCodes = {}; // 内存存储验证码（Vercel 实例重启会重置，生产环境建议用 Redis）

// ======================================================
// --- 4. 中间件配置 ---
// ======================================================
app.set('trust proxy', 1); // 必须：在 Vercel 后面正确获取用户 IP
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 限流器
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10,
    message: { message: '尝试次数过多，请 15 分钟后再试。' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ======================================================
// --- 5. 权限验证中间件 ---
// ======================================================
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: '未授权，请登录' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token 已失效' });
        req.user = user;
        next();
    });
};

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: '未授权' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err || user.role !== 'admin') {
            return res.status(403).json({ message: '权限不足，需要管理员权限' });
        }
        req.user = user;
        next();
    });
};

// ======================================================
// --- 6. 核心业务 API 路由 ---
// ======================================================

// --- 数据库保活接口 ---
app.get('/api/keep-alive', async (req, res) => {
    const cronSecret = req.headers['authorization']?.split(' ')[1];
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
        return res.status(401).send('Unauthorized');
    }
    try {
        await pool.query('SELECT 1');
        res.status(200).send('MySQL Ping Success');
    } catch (error) {
        res.status(500).send('Database connection failed');
    }
});

// --- 多语言支持 ---
app.get('/api/locales/:lng', async (req, res) => {
    const { lng } = req.params;
    const allowedLangs = ['en', 'zh-CN'];
    if (!allowedLangs.includes(lng)) return res.status(404).send('Not found');
    
    try {
        const filePath = path.join(__dirname, 'public', 'locales', lng, 'translation.json');
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ message: 'Error loading locale' });
    }
});

// --- 注册流程 ---
app.post('/api/send-verification-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: '邮箱不能为空' });

    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(409).json({ message: '该邮箱已被注册' });
        
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        verificationCodes[email] = { code, expires: Date.now() + 5 * 60 * 1000 };

        await resend.emails.send({
            from: `YUAN的网站 <${process.env.MAIL_FROM_ADDRESS}>`,
            to: [email],
            subject: '您的注册验证码',
            html: `<div style="padding:20px; border:1px solid #eee;"><h1>您的验证码是：${code}</h1><p>有效期为5分钟。</p></div>`,
        });
        res.status(200).json({ message: '验证码已发送' });
    } catch (error) {
        res.status(500).json({ message: '邮件发送失败' });
    }
});

app.post('/api/register', async (req, res) => {
    const { email, password, code, turnstileToken } = req.body;
    
    // Cloudflare Turnstile 验证
    try {
        const verifyRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken
        });
        if (!verifyRes.data.success) return res.status(403).json({ message: '人机验证失败' });
    } catch (e) { return res.status(500).json({ message: '验证服务异常' }); }

    const stored = verificationCodes[email];
    if (!stored || Date.now() > stored.expires || stored.code !== code) {
        return res.status(400).json({ message: '验证码无效或已过期' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
        delete verificationCodes[email];
        res.status(201).json({ message: '注册成功' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '邮箱已存在' });
        res.status(500).json({ message: '注册失败' });
    }
});

// --- 登录 ---
app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: '账号或密码错误' });
        }
        if (user.isBanned) return res.status(403).json({ message: '账号已被封禁' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        res.json({ token, user: { email: user.email, role: user.role, username: user.username } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: '登录异常' });
    }
});

// --- 找回密码 ---
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            const token = jwt.sign({ id: rows[0].id }, process.env.PASSWORD_RESET_SECRET, { expiresIn: '15m' });
            const link = `${process.env.BASE_URL}/reset-password.html?token=${token}`;
            await resend.emails.send({
                from: process.env.MAIL_FROM_ADDRESS,
                to: [email],
                subject: '重置密码',
                html: `<p>请点击链接重置密码（15分钟有效）：<a href="${link}">${link}</a></p>`
            });
        }
        res.json({ message: '如果邮箱存在，重置邮件已发送。' });
    } catch (e) { res.status(500).json({ message: '服务异常' }); }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.PASSWORD_RESET_SECRET);
        const hash = bcrypt.hashSync(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, decoded.id]);
        res.json({ message: '密码重置成功' });
    } catch (e) { res.status(400).json({ message: '链接无效或已过期' }); }
});

// --- 用户资料 ---
app.get('/api/profile', authenticateUser, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT email, username, level, createdAt FROM users WHERE id = ?', [req.user.id]);
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ message: '获取失败' }); }
});

app.post('/api/profile', authenticateUser, async (req, res) => {
    const { username } = req.body;
    try {
        await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
        res.json({ message: '昵称更新成功', username });
    } catch (e) { 
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '昵称已被占用' });
        res.status(500).json({ message: '更新失败' }); 
    }
});

// --- 每日运势 (适配 MySQL 获取插入后的数据) ---
app.get('/api/fortune', authenticateUser, async (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    try {
        const [rows] = await pool.query('SELECT * FROM fortunes WHERE userId = ? AND fortune_date = ?', [userId, today]);
        if (rows.length > 0) return res.json(rows[0]);

        // 获取 Hitokoto 接口
        let quote = "顺其自然。";
        let from = "网络";
        try {
            const h = await axios.get('https://v1.hitokoto.cn/?c=i', { timeout: 2000 });
            quote = h.data.hitokoto;
            from = h.data.from;
        } catch (e) {}

        const luck = Math.floor(Math.random() * 100) + 1;
        const [result] = await pool.query(
            `INSERT INTO fortunes (userId, luck_number, luck_level_text, wealth_luck, career_luck, quote, quote_source, image_url, fortune_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, luck, luck > 80 ? '大吉' : '正常', 8, 8, quote, from, `https://picsum.photos/500/300?random=${luck}`, today]
        );

        const [newRows] = await pool.query('SELECT * FROM fortunes WHERE id = ?', [result.insertId]);
        res.json(newRows[0]);
    } catch (e) { res.status(500).json({ message: '运势生成失败' }); }
});

// --- 工单系统 ---
app.post('/api/tickets', authenticateUser, async (req, res) => {
    const { subject, message } = req.body;
    try {
        await pool.query('INSERT INTO tickets (userId, userEmail, subject, message) VALUES (?, ?, ?, ?)', 
            [req.user.id, req.user.email, subject, message]);
        res.status(201).json({ message: '工单已提交' });
    } catch (e) { res.status(500).json({ message: '提交失败' }); }
});

// --- 外号系统 ---
app.get('/api/nicknames', authenticateUser, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM nicknames ORDER BY created_at DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ message: '加载失败' }); }
});

// ======================================================
// --- 7. 管理员 API 路由 ---
// ======================================================

app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND role = "admin"', [email]);
        const user = rows[0];
        if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: '凭证错误' });
        
        const token = jwt.sign({ id: user.id, email: user.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.json({ token });
    } catch (e) { res.status(500).json({ message: '登录异常' }); }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    const [rows] = await pool.query('SELECT id, email, role, isBanned, createdAt FROM users');
    res.json(rows);
});

app.post('/api/admin/users/:id/toggle-ban', authenticateAdmin, async (req, res) => {
    if (req.user.id == req.params.id) return res.status(400).json({ message: '不能封禁自己' });
    await pool.query('UPDATE users SET isBanned = NOT isBanned WHERE id = ?', [req.params.id]);
    res.json({ message: '状态已更新' });
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    if (req.user.id == req.params.id) return res.status(400).json({ message: '不能删除自己' });
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: '用户已彻底删除' });
});

app.get('/api/admin/tickets', authenticateAdmin, async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM tickets ORDER BY createdAt DESC');
    res.json(rows);
});

app.post('/api/admin/nicknames', authenticateAdmin, async (req, res) => {
    const { creator, nickname, meaning } = req.body;
    await pool.query('INSERT INTO nicknames (creator, nickname, meaning) VALUES (?, ?, ?)', [creator, nickname, meaning]);
    res.json({ message: '外号添加成功' });
});

// ======================================================
// --- 8. 启动与导出 ---
// ======================================================

// 针对本地开发模式
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`[Local] Server running at http://localhost:${PORT}`);
    });
}

// 针对 Vercel 部署
module.exports = app;