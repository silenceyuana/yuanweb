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
const { Pool } = require('pg');
const axios = require('axios');
const { Resend } = require('resend');

// ======================================================
// --- 2. 应用初始化与环境变量检查 ---
// ======================================================
const app = express();
const PORT = process.env.PORT || 3000;

// 检查所有必需的环境变量
const requiredEnvVars = [
    'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET',
    'PASSWORD_RESET_SECRET', 'BASE_URL', 'TURNSTILE_SECRET_KEY', 
    'RESEND_API_KEY', 'MAIL_FROM_ADDRESS'
];

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        console.error(`严重错误: 缺少必要的环境变量 "${varName}"！`);
        throw new Error(`Missing required environment variable: ${varName}`);
    }
}

// ======================================================
// --- 3. 第三方服务与数据库连接 ---
// ======================================================

// --- Supabase / PostgreSQL 连接 ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Resend (Email) 连接 ---
const resend = new Resend(process.env.RESEND_API_KEY);
const verificationCodes = {};

// ======================================================
// --- 4. 中间件配置 ---
// ======================================================
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 5,
    message: { message: '登录尝试次数过多，请 15 分钟后再试！' },
    standardHeaders: true, legacyHeaders: false,
});

// ======================================================
// --- 5. 认证中间件 ---
// ======================================================
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err || user.role !== 'admin') {
            return res.status(403).json({ message: '需要管理员权限！' });
        }
        req.user = user;
        next();
    });
};

// ======================================================
// --- 6. API 路由定义 ---
// ======================================================

// --- 配置接口 ---
app.get('/api/config', (req, res) => {
    res.json({ 
        supabaseUrl: process.env.SUPABASE_URL, 
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// --- 注册流程 API ---
app.post('/api/send-verification-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: '邮箱不能为空！' });

    try {
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) return res.status(409).json({ message: '该邮箱已被注册！' });
        
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        verificationCodes[email] = { code, expires: Date.now() + 5 * 60 * 1000 };

        await resend.emails.send({
            from: `YUAN的网站 <${process.env.MAIL_FROM_ADDRESS}>`,
            to: [email],
            subject: '您的注册验证码',
            html: `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>您的验证码</title></head><body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 20px;"><tr><td align="center"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"><tr><td style="padding: 40px;"><div style="text-align: center; margin-bottom: 30px;"><img src="https://www.betteryuan.cn/assets/img/favicon.ico" alt="网站Logo" style="max-width: 80px;"></div><h1 style="font-size: 24px; font-weight: bold; color: #1c1e21; text-align: center; margin-bottom: 15px;">欢迎注册！</h1><p style="font-size: 16px; color: #606770; text-align: center; line-height: 1.6;">您的验证码是：</p><div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;"><p style="font-size: 36px; font-weight: bold; color: #0d6efd; letter-spacing: 5px; margin: 0;">${code}</p></div><p style="font-size: 16px; color: #606770; text-align: center; line-height: 1.6;">该验证码将在5分钟内失效，请勿泄露给他人。</p><div style="font-size: 12px; color: #8b949e; text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; margin-top: 30px;">© 2025 YUAN的网站. 版权所有.</div></td></tr></table></td></tr></table></body></html>`,
        });
        
        res.status(200).json({ message: '验证码已成功发送到您的邮箱！' });
    } catch (error) {
        console.error('发送验证码 API 出错:', error);
        res.status(500).json({ message: '邮件服务器繁忙，请稍后重试。' });
    }
});

app.post('/api/register', async (req, res) => {
    const { email, password, code, turnstileToken } = req.body;
    if (!turnstileToken) {
        return res.status(400).json({ message: '人机验证失败，请刷新重试。' });
    }
    try {
        const response = await axios.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            { secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken },
            { headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.data.success) {
            return res.status(403).json({ message: '人机验证未能通过！' });
        }
    } catch (error) {
        console.error('Turnstile 验证出错:', error);
        return res.status(500).json({ message: '人机验证服务暂时不可用。' });
    }
    if (!email || !password || !code || password.length < 6) {
        return res.status(400).json({ message: '邮箱、验证码和密码不能为空，且密码至少为6位！' });
    }
    const storedCode = verificationCodes[email];
    if (!storedCode || Date.now() > storedCode.expires || storedCode.code !== code) {
        return res.status(400).json({ message: '验证码无效或已过期！' });
    }
    try {
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: '该邮箱已被注册！' });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
        delete verificationCodes[email];

        // --- 注册成功后发送欢迎邮件 ---
        try {
            await resend.emails.send({
                from: `YUAN的网站 <${process.env.MAIL_FROM_ADDRESS}>`,
                to: [email],
                subject: '欢迎来到YUAN的网站！',
                html: `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>欢迎注册！</title></head><body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 20px;"><tr><td align="center"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"><tr><td style="padding: 40px;"><div style="text-align: center; margin-bottom: 30px;"><img src="https://www.betteryuan.cn/assets/img/favicon.ico" alt="网站Logo" style="max-width: 80px;"></div><h1 style="font-size: 24px; font-weight: bold; color: #1c1e21; text-align: center; margin-bottom: 15px;">注册成功！</h1><p style="font-size: 16px; color: #606770; text-align: center; line-height: 1.6;">感谢您注册YUAN的网站。我们很高兴您的加入！</p><div style="text-align: center; margin: 30px 0;"><a href="${process.env.BASE_URL}/login.html" style="background-color: #0d6efd; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">立即登录</a></div><p style="font-size: 14px; color: #606770; text-align: center; line-height: 1.6;">如果您有任何疑问，请随时通过提交工单与我们联系。</p><div style="font-size: 12px; color: #8b949e; text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; margin-top: 30px;">© 2025 YUAN的网站. 版权所有.</div></td></tr></table></td></tr></table></body></html>`,
            });
        } catch (emailError) {
            console.error('发送注册欢迎邮件失败:', emailError);
        }
        
        res.status(201).json({ message: '注册成功！' });
    } catch (error) {
        console.error('注册 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

// --- 用户账户与密码重置 API ---
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
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: '登录成功！', token, user: { email: user.email, role: user.role } });
    } catch (error) {
        console.error('登录 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const genericMessage = { message: '如果该邮箱已注册，您将会收到一封密码重置邮件。' };
    if (!email) return res.status(400).json({ message: '请输入您的邮箱地址。' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user) {
            const passwordResetToken = jwt.sign({ id: user.id, email: user.email }, process.env.PASSWORD_RESET_SECRET, { expiresIn: '15m' });
            const resetLink = `${process.env.BASE_URL}/reset-password.html?token=${passwordResetToken}`;
            
            await resend.emails.send({
                from: `YUAN的网站 <${process.env.MAIL_FROM_ADDRESS}>`,
                to: [email],
                subject: '重置您的账户密码',
                html: `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>重置您的密码</title></head><body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 20px;"><tr><td align="center"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"><tr><td style="padding: 40px;"><div style="text-align: center; margin-bottom: 30px;"><img src="https://www.betteryuan.cn/assets/img/favicon.ico" alt="网站Logo" style="max-width: 80px;"></div><h1 style="font-size: 24px; font-weight: bold; color: #1c1e21; text-align: center; margin-bottom: 15px;">密码重置请求</h1><p style="font-size: 16px; color: #606770; text-align: center; line-height: 1.6;">我们收到了一个重置您账户密码的请求。请点击下方的按钮来设置您的新密码：</p><div style="text-align: center; margin: 30px 0;"><a href="${resetLink}" style="background-color: #0d6efd; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">重置密码</a></div><p style="font-size: 14px; color: #606770; text-align: center; line-height: 1.6;">此链接将在 <strong>15 分钟</strong> 内失效。如果您没有请求重置密码，请忽略此邮件。</p><div style="font-size: 12px; color: #8b949e; text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; margin-top: 30px;">© 2025 YUAN的网站. 版权所有.</div></td></tr></table></td></tr></table></body></html>`,
            });
        }
        res.status(200).json(genericMessage);
    } catch (error) {
        console.error('忘记密码 API 出错:', error);
        res.status(200).json(genericMessage);
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: '缺少必要信息，或新密码格式不正确（至少6位）。' });
    }
    try {
        const decoded = jwt.verify(token, process.env.PASSWORD_RESET_SECRET);
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, decoded.id]);
        res.status(200).json({ message: '密码已成功重置！您现在可以用新密码登录了。' });
    } catch (error) {
        console.error('重置密码 API 出错:', error.name);
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: '密码重置链接已过期，请重新申请。' });
        }
        res.status(400).json({ message: '密码重置链接无效，请重新申请。' });
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

        // --- 发送工单成功后给管理员发送通知邮件 ---
        resend.emails.send({
            from: `YUAN的网站-系统通知 <${process.env.MAIL_FROM_ADDRESS}>`,
            to: [process.env.MAIL_FROM_ADDRESS],
            subject: `新工单提醒: ${subject}`,
            html: `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>新工单提醒</title></head><body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 20px;"><tr><td align="center"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"><tr><td style="padding: 40px;"><h1 style="font-size: 24px; font-weight: bold; color: #1c1e21; text-align: center; margin-bottom: 25px;">新工单提醒</h1><div style="font-size: 16px; color: #606770; line-height: 1.6;"><p style="margin: 0 0 10px;"><strong>来自用户:</strong> ${userEmail}</p><p style="margin: 0 0 10px;"><strong>主题:</strong> ${subject}</p><p style="margin: 0; white-space: pre-wrap; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px;">${message}</p></div><div style="text-align: center; margin: 30px 0;"><a href="${process.env.BASE_URL}/admin-dashboard.html" style="background-color: #0d6efd; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">查看后台面板</a></div><div style="font-size: 12px; color: #8b949e; text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; margin-top: 30px;">© 2025 YUAN的网站. 版权所有.</div></td></tr></table></td></tr></table></body></html>`,
        }).catch(emailError => {
            console.error('发送新工单通知邮件失败:', emailError);
        });
        
        res.status(201).json({ message: '工单已成功发送！' });
    } catch (error) {
        console.error('创建工单 API 出错:', error);
        res.status(500).json({ message: '服务器错误，无法保存工单。' });
    }
});

// --- 新增: 聊天 (Chat) API ---
app.get('/api/chat/messages', authenticateUser, async (req, res) => {
    try {
        // 获取最新的 500 条消息，按时间升序排列
        const result = await pool.query(
            'SELECT m.id, m.user_id, m.user_email, m.content, m.created_at FROM messages m ORDER BY m.created_at DESC LIMIT 500'
        );
        // 前端需要正序显示，所以反转数组
        res.json(result.rows.reverse());
    } catch (error) {
        console.error('获取聊天消息 API 出错:', error);
        res.status(500).json({ message: '无法获取消息。' });
    }
});

app.post('/api/chat/messages', authenticateUser, async (req, res) => {
    const { content } = req.body;
    if (!content || content.trim() === '') {
        return res.status(400).json({ message: '消息内容不能为空！' });
    }
    const { id: userId, email: userEmail } = req.user;

    try {
        // 插入消息到数据库，Supabase Realtime 会自动广播
        const result = await pool.query(
            'INSERT INTO messages (user_id, user_email, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, userEmail, content.trim()]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('发送聊天消息 API 出错:', error);
        res.status(500).json({ message: '无法发送消息。' });
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
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: '管理员登录成功！', token });
    } catch (error) {
        console.error('管理员登录 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, role, level, "isBanned", "createdAt" FROM users ORDER BY "createdAt" DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('获取用户列表 API 出错:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    if (req.user.id == id) {
        return res.status(400).json({ message: '不能删除自己！' });
    }
    try {
        await pool.query('DELETE FROM tickets WHERE "userId" = $1', [id]);
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: '用户未找到！' });
        }
        res.json({ message: '用户及其所有工单已删除！' });
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
        const result = await pool.query('UPDATE users SET "isBanned" = NOT "isBanned" WHERE id = $1 RETURNING "isBanned"', [id]);
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

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// 在本地开发时启动服务器监听，Vercel 会忽略此部分
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ 本地开发服务器已启动，正在监听 ${PORT} 端口`);
    });
}

// 导出 Express app 实例，供 Vercel 部署使用
module.exports = app;