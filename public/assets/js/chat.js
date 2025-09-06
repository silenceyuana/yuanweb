// /api/chat.js
const admin = require('firebase-admin');

// 初始化 Firebase Admin SDK (如果还没初始化)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG))
  });
}

const db = admin.firestore();
const MESSAGE_LIMIT = 500; // 仍然可以限制每个对话的消息数量

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    // 从请求中获取发送者ID, 接收者ID, 和消息内容
    const { senderId, senderEmail, recipientId, content } = req.body;
    if (!senderId || !recipientId || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // --- 核心逻辑: 创建或获取对话 ID ---
    // 通过排序用户ID来确保对话ID的唯一性，无论谁先发起
    const participants = [senderId, recipientId].sort();
    const conversationId = participants.join('_');
    
    const conversationRef = db.collection('conversations').doc(conversationId);
    const messagesRef = conversationRef.collection('messages');

    // 检查对话文档是否存在，如果不存在则创建它
    const conversationSnap = await conversationRef.get();
    if (!conversationSnap.exists) {
      await conversationRef.set({
        participants: participants, // 存储参与者ID，用于安全规则
        lastMessage: content,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await conversationRef.update({
        lastMessage: content,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 1. 在对话的子集合中添加新消息
    const newMessage = {
      senderId,
      senderEmail,
      content,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await messagesRef.add(newMessage);

    // 2. 检查并清理该对话中的旧消息
    const snapshot = await messagesRef.orderBy('createdAt', 'desc').get();
    if (snapshot.size > MESSAGE_LIMIT) {
      const batch = db.batch();
      const docsToDelete = snapshot.docs.slice(MESSAGE_LIMIT);
      docsToDelete.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    res.status(201).json({ success: true, conversationId });

  } catch (error) {
    console.error('发送聊天消息 API 出错:', error);
    res.status(500).json({ error: '发送消息失败' });
  }
}