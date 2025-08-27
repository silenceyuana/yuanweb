// ======================================================
// --- 1. 模块引入与配置 ---
// ======================================================
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();

// ======================================================
// --- 2. 应用初始化 ---
// ======================================================
const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const DB_FILE = path.join(__dirname, 'database.db');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("严重错误: JWT_SECRET 未在 .env 文件中设置！程序即将退出。");
    process.exit(1);
}

// ======================================================
// --- 3. 数据库连接与服务器启动 (核心修复) ---
// ======================================================
// 首先连接数据库
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('❌ 连接 SQLite 数据库失败:', err.message);
        process.exit(1); // 数据库连接失败，直接退出
    }
    console.log('✅ 成功连接到 SQLite 数据库 (database.db)');

    // 在连接成功后，创建数据表
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        userEmail TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`, (err) => {
        if (err) {
            console.error("创建 'tickets' 表失败:", err.message);
            process.exit(1);
        }
        
        // --- 只有在数据库完全准备好之后，才开始配置路由和启动服务器 ---
        
        // 配置 Express 应用
        configureApp();

        // 启动服务器
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ 后端服务器已启动，正在监听所有网络地址的 ${PORT} 端口`);
            console.log(`🔑 管理员后台入口: http://<你的服务器IP>:${PORT}/admin`);
        });
    });
});


// ======================================================
// --- 4. 应用配置与路由定义函数 ---
// ======================================================
function configureApp() {
    // --- 中间件设置 ---
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: { message: '登录尝试次数过多，请 15 分钟后再试！' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    // --- 辅助函数 ---
    const readUsers = () => {
        if (!fs.existsSync(USERS_FILE)) return [];
        try {
            return JSON.parse(fs.readFileSync(USERS_FILE));
        } catch (error) {
            console.error("读取或解析 users.json 文件失败:", error);
            return [];
        }
    };
    const writeUsers = (users) => {
        try {
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        } catch (error) {
            console.error("写入 users.json 文件失败:", error);
        }
    };

    // --- 认证中间件 ---
    const authenticateUser = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token == null) return res.sendStatus(401);
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    };
    const authenticateAdmin = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token == null) return res.sendStatus(401);
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err || user.role !== 'admin') return res.status(403).json({ message: '需要管理员权限！' });
            req.user = user;
            next();
        });
    };

    // --- API 路由 ---
    app.post('/api/register', (req, res) => {
        const { email, password } = req.body;
        if (!email || !password || password.length < 6) {
            return res.status(400).json({ message: '邮箱和密码不能为空，且密码至少为6位！' });
        }
        const users = readUsers();
        if (users.find(user => user.email === email)) {
            return res.status(409).json({ message: '该邮箱已被注册！' });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = { id: Date.now().toString(), email, password: hashedPassword, role: 'user', level: 1, isBanned: false };
        users.push(newUser);
        writeUsers(users);
        res.status(201).json({ message: '注册成功！' });
    });

    app.post('/api/login', loginLimiter, (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: '邮箱和密码不能为空！' });
        const user = readUsers().find(u => u.email === email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: '邮箱或密码错误！' });
        }
        if (user.isBanned) {
            return res.status(403).json({ message: '您的账户已被封禁，请联系管理员。' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
        res.status(200).json({ message: '登录成功！', token });
    });

    app.post('/api/tickets', authenticateUser, (req, res) => {
        const { subject, message } = req.body;
        if (!subject || !message) {
            return res.status(400).json({ message: '工单主题和内容不能为空！' });
        }
        const { id: userId, email: userEmail } = req.user;
        const sql = `INSERT INTO tickets (userId, userEmail, subject, message) VALUES (?, ?, ?, ?)`;
        db.run(sql, [userId, userEmail, subject, message], function(err) {
            if (err) {
                console.error("保存工单到 SQLite 失败:", err.message);
                return res.status(500).json({ message: '服务器错误，无法保存工单。' });
            }
            res.status(201).json({ message: '工单已成功发送！' });
        });
    });

    app.post('/api/admin/login', loginLimiter, (req, res) => {
        const { email, password } = req.body;
        const user = readUsers().find(u => u.email === email);
        if (!user || !bcrypt.compareSync(password, user.password) || user.role !== 'admin') {
            return res.status(401).json({ message: '管理员凭证无效！' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
        res.json({ message: '管理员登录成功！', token });
    });

    app.get('/api/admin/users', authenticateAdmin, (req, res) => {
        const users = readUsers();
        const safeUsers = users.map(({ password, ...user }) => user);
        res.json(safeUsers);
    });

    app.delete('/api/admin/users/:id', authenticateAdmin, (req, res) => {
        const { id } = req.params;
        if (req.user.id === id) return res.status(400).json({ message: '不能删除自己！'});
        let users = readUsers();
        const newUsers = users.filter(user => user.id !== id);
        if (users.length === newUsers.length) return res.status(404).json({ message: '用户未找到！' });
        writeUsers(newUsers);
        res.json({ message: '用户已删除！' });
    });

    app.post('/api/admin/users/:id/toggle-ban', authenticateAdmin, (req, res) => {
        const { id } = req.params;
        if (req.user.id === id) return res.status(400).json({ message: '不能封禁自己！'});
        let users = readUsers();
        const userIndex = users.findIndex(user => user.id === id);
        if (userIndex === -1) return res.status(404).json({ message: '用户未找到！' });
        users[userIndex].isBanned = !users[userIndex].isBanned;
        writeUsers(users);
        res.json({ message: `用户状态已更新为: ${users[userIndex].isBanned ? '已封禁' : '正常'}` });
    });

    app.get('/api/admin/tickets', authenticateAdmin, (req, res) => {
        const sql = `SELECT * FROM tickets ORDER BY createdAt DESC`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error("从 SQLite 获取工单失败:", err.message);
                return res.status(500).json({ message: '服务器错误，无法获取工单。' });
            }
            res.json(rows);
        });
    });
    
    // --- 页面路由 ---
    app.get('/admin', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
    });
}