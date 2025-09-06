// /api/chat.js
const admin = require('firebase-admin');

// 初始化 Firebase Admin SDK
// 确保 Vercel 环境变量 'FIREBASE_ADMIN_SDK_CONFIG' 已经设置
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG))
  });
}

const db = admin.firestore();
const messagesRef = db.collection('messages');
const MESSAGE_LIMIT = 500;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // 处理发送新消息的请求
    try {
      const { userEmail, content } = req.body;
      if (!userEmail || !content) {
        return res.status(400).json({ error: 'Missing userEmail or content' });
      }

      // 1. 添加新消息，附带服务器时间戳
      const newMessage = {
        userEmail,
        content,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await messagesRef.add(newMessage);

      // 2. 检查并清理旧消息 (这是实现500条限制的关键)
      const snapshot = await messagesRef.orderBy('createdAt', 'desc').get();
      
      if (snapshot.size > MESSAGE_LIMIT) {
        const batch = db.batch();
        const docsToDelete = snapshot.docs.slice(MESSAGE_LIMIT); // 获取所有超过500条的旧文档
        docsToDelete.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      res.status(201).json({ success: true });

    } catch (error) {
      console.error('Error posting message:', error);
      res.status(500).json({ error: 'Failed to post message' });
    }
  } else {
    // 拒绝其他类型的请求
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}