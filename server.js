// ======================================================
// --- 1. 模块引入与配置 ---
// ======================================================
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const rateLimit = require('express-rate-limit');
// 引入 'pg' 模块，这是 Node.js 连接 PostgreSQL 数据库的官方驱动
const { Pool } = require('pg');

// ======================================================
// --- 2. 应用初始化与环境变量检查 ---
// ======================================================
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// 启动前严格检查必要的环境变量，防止部署后出错
if (!JWT_SECRET) {
    console.error("严重错误: JWT_SECRET 环境变量未设置！程序即将退出。");
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error("严重错误: DATABASE_URL 环境变量 (Supabase 连接字符串) 未设置！程序即将退出。");
    process.exit(1);
}

// ======================================================
// --- 3. 数据库连接 ---
// ======================================================
// 创建一个数据库连接池。
// Vercel 的无服务器环境每次请求都可能是一个新的实例，
// 连接池能高效地管理数据库连接，避免连接数耗尽。
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// ======================================================
// --- 4. 中间件配置 ---
// ======================================================
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析 JSON 格式的请求体

// 这行代码在本地开发时用于提供 public 文件夹下的静态文件。
// 在 Vercel 上，静态文件会由 Vercel 的 CDN 直接处理，但这行代码无害。
app.use(express.static(path.join(__dirname, 'public')));

// 为登录接口设置请求频率限制，防止暴力破解
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 5, // 每个 IP 在 15 分钟内最多尝试 5 次
    message: { message: '登录尝试次数过多，请 15 分钟后再试！' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ======================================================
// --- 5. 认证中间件 ---
// ======================================================
// 验证普通用户 Token
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); // 未授权

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // 禁止访问 (Token 无效或过期)
        req.user = user;
        next();
    });
};

// 验证管理员 Token
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err || user.role !== 'admin') {
            return res.status(403).json({ message: '需要管理员权限！' });
        }
        req.user = user;
        next();
    });
};

// ======================================================
// --- 6. API 路由定义 (已完全迁移至 PostgreSQL) ---
// ======================================================

// --- 用户账户 API ---

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: '邮箱和密码不能为空，且密码至少为6位！' });
    }
    try {
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: '该邮箱已被注册！' });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
        res.status(201).json({ message: '注册成功！' });
    } catch (error) {
        console.error('注册 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: '邮箱和密码不能为空！' });
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: '邮箱或密码错误！' });
        }
        if (user.isBanned) {
            return res.status(403).json({ message: '您的账户已被封禁，请联系管理员。' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );
        res.status(200).json({ message: '登录成功！', token });
    } catch (error) {
        console.error('登录 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

// --- 工单 (Tickets) API ---

app.post('/api/tickets', authenticateUser, async (req, res) => {
    const { subject, message } = req.body;
    if (!subject || !message) {
        return res.status(400).json({ message: '工单主题和内容不能为空！' });
    }
    const { id: userId, email: userEmail } = req.user;
    const sql = `INSERT INTO tickets ("userId", "userEmail", subject, message) VALUES ($1, $2, $3, $4)`;
    try {
        await pool.query(sql, [userId, userEmail, subject, message]);
        res.status(201).json({ message: '工单已成功发送！' });
    } catch (error)
    {
        console.error('创建工单 API 出错:', error);
        res.status(500).json({ message: '服务器错误，无法保存工单。' });
    }
});

// --- 管理员 (Admin) API ---

app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'admin']);
        const user = result.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: '管理员凭证无效！' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );
        res.json({ message: '管理员登录成功！', token });
    } catch (error) {
        console.error('管理员登录 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        // 查询时排除密码字段，更安全
        const result = await pool.query('SELECT id, email, role, level, "isBanned", "createdAt" FROM users ORDER BY "createdAt" DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('获取用户列表 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    if (req.user.id == id) { // 使用 '==' 进行类型转换比较，因为 id 可能为字符串
        return res.status(400).json({ message: '不能删除自己！' });
    }
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: '用户未找到！' });
        }
        res.json({ message: '用户已删除！' });
    } catch (error) {
        console.error('删除用户 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.post('/api/admin/users/:id/toggle-ban', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    if (req.user.id == id) {
        return res.status(400).json({ message: '不能封禁自己！' });
    }
    try {
        // 使用 "RETURNING" 子句可以一次性完成更新和查询，效率更高
        const result = await pool.query(
            'UPDATE users SET "isBanned" = NOT "isBanned" WHERE id = $1 RETURNING "isBanned"',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: '用户未找到！' });
        }
        const isBanned = result.rows[0].isBanned;
        res.json({ message: `用户状态已更新为: ${isBanned ? '已封禁' : '正常'}` });
    } catch (error) {
        console.error('切换用户封禁状态 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.get('/api/admin/tickets', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets ORDER BY "createdAt" DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('获取工单列表 API 出错:', error);
        res.status(500).json({ message: '服务器错误，无法获取工单。' });
    }
});

// ======================================================
// --- 7. 页面路由与服务器启动 ---
// ======================================================
// 为 /admin 路径提供管理员登录页面
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// 仅在本地开发环境中启动服务器监听。
// 在 Vercel 上，Vercel 会自动处理请求的传入，不需要我们手动监听端口。
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ 本地开发服务器已启动，正在监听所有网络地址的 ${PORT} 端口`);
    });
}

// 导出 Express app 实例，这是 Vercel 部署所必需的。
module.exports = app;