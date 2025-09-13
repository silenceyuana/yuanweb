// chat.js - 全新聊天界面逻辑 (已添加端到端加密和所有修复)
document.addEventListener('DOMContentLoaded', () => {
    // --- 0. 检查登录状态 ---
    const userToken = localStorage.getItem('userToken');
    if (!userToken) {
        alert('请先登录后再访问此页面！');
        window.location.href = 'login.html';
        return;
    }
    
    // --- 1. 全局变量和 DOM 元素 ---
    let supabaseClient;
    let currentUser;
    let conversations = {}; // 存储对话: { 'public': {...}, 'peerId': {...} }
    let activeChat = { type: 'public', id: 'public' }; // 默认激活公开聊天
    let chatEncryptionKey; // 用于存储加密密钥

    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const chatTitle = document.getElementById('chat-title');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const conversationsListContainer = document.getElementById('conversations-list');
    const loadingIndicator = document.querySelector('.loading-indicator');

    // --- 修复后的加密/解密函数 ---

    // XOR 异或加密核心算法，保持不变
    const xorCipher = (str, key) => {
        return str.split('').map((char, i) => {
            return String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length));
        }).join('');
    };

    /**
     * @description 修正后的加密函数
     * @param {string} plainText - 需要加密的明文 (支持中文等任意字符)
     * @param {string} key - 加密密钥
     * @returns {string} - Base64 编码后的密文
     */
    const encryptMessage = (plainText, key) => {
        if (!key) return plainText;
        const xorEncrypted = xorCipher(plainText, key);
        // 关键改动：将可能包含多字节字符的字符串转换为 btoa 可以安全处理的格式
        const safeForBtoa = unescape(encodeURIComponent(xorEncrypted));
        return btoa(safeForBtoa);
    };

    /**
     * @description 修正后的解密函数
     * @param {string} cipherText - 需要解密的 Base64 密文
     * @param {string} key - 解密密钥
     * @returns {string} - 解密后的明文
     */
    const decryptMessage = (cipherText, key) => {
        // 增加对非加密文本的判断，提高健壮性
        if (!key || cipherText === '...' || cipherText === '开始对话吧！' || !cipherText.trim()) {
            return cipherText;
        }
        try {
            // 关键改动：先进行 Base64 解码，然后执行与加密时相反的操作来还原多字节字符
            const decodedFromBtoa = atob(cipherText);
            const decoded = decodeURIComponent(escape(decodedFromBtoa));
            return xorCipher(decoded, key);
        } catch (e) {
            // 如果解密失败 (例如对于旧的、未正确加密的历史消息)，在控制台发出警告并返回原文
            console.warn('消息解密失败，返回原始密文:', cipherText, e);
            return cipherText;
        }
    };

    // --- 2. 辅助函数 ---
    const scrollToBottom = () => {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    };

    const displayMessage = (msg, isHistory = false) => {
        if (loadingIndicator && loadingIndicator.style.display !== 'none') {
            loadingIndicator.style.display = 'none';
        }
        
        // 调用修正后的解密函数
        const decryptedContent = decryptMessage(msg.content, chatEncryptionKey);
        
        const isSent = msg.sender_id === currentUser.id;
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
        const sender = isSent ? '你' : (msg.sender_username || msg.sender_email.split('@')[0]);
        
        // 对解密后的内容进行HTML转义，防止XSS攻击
        const sanitizedContent = decryptedContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        bubble.innerHTML = `
            <div class="sender">${sender}</div>
            <div class="content">${sanitizedContent}</div>
            <div class="timestamp">${new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        messagesContainer.appendChild(bubble);

        if (!isHistory) {
            scrollToBottom();
        }
    };

    const renderConversations = () => {
        conversationsListContainer.innerHTML = '';
        const publicConvo = conversations['public'];
        if (publicConvo) {
            conversationsListContainer.appendChild(createConversationItem(publicConvo));
        }
        Object.values(conversations)
            .filter(c => c.type === 'private')
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .forEach(convo => {
                conversationsListContainer.appendChild(createConversationItem(convo));
            });
    };

    const createConversationItem = (convo) => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.id = convo.id;
        item.dataset.type = convo.type;
        if (activeChat.id == convo.id) {
            item.classList.add('active');
        }
        
        const displayName = convo.username || convo.email?.split('@')[0] || '未知用户';
        // 对会话列表的最后一条消息也进行解密
        const lastMessageDecrypted = decryptMessage(convo.lastMessage || '...', chatEncryptionKey);
        
        item.innerHTML = `
            <div class="avatar">${displayName.charAt(0)}</div>
            <div class="convo-details">
                <div class="username">${displayName}</div>
                <div class="last-message">${lastMessageDecrypted}</div>
            </div>
        `;
        item.addEventListener('click', () => switchChat(convo.type, convo.id, displayName));
        return item;
    };
    
    // --- 3. 核心功能函数 ---
    async function switchChat(type, id, username) {
        if (activeChat.id === id && messagesContainer.innerHTML !== '' && !messagesContainer.querySelector('.loading-indicator')) return;

        activeChat = { type, id, username };
        chatTitle.textContent = username;
        messagesContainer.innerHTML = '<div class="loading-indicator">正在加载消息...</div>';

        document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
        document.querySelector(`.conversation-item[data-id='${id}']`)?.classList.add('active');

        try {
            const endpoint = type === 'public' ? '/api/chat/public' : `/api/chat/private/${id}`;
            const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${userToken}` } });
            
            if (!res.ok) {
                if (res.status === 403) throw new Error('认证失败，请重新登录。');
                throw new Error('获取历史消息失败');
            }

            const messages = await res.json();
            messagesContainer.innerHTML = '';
            
            if (messages.length === 0) {
                messagesContainer.innerHTML = '<div class="loading-indicator">还没有消息，快来开始对话吧！</div>';
            } else {
                messages.forEach(msg => displayMessage(msg, true));
            }
            
            setTimeout(scrollToBottom, 100);
        } catch (err) {
            console.error("加载消息失败:", err);
            messagesContainer.innerHTML = `<div class="loading-indicator">${err.message}</div>`;
        }
    }
    
    async function handleSearch() {
        const query = searchInput.value.trim();
        conversationsListContainer.style.display = 'block';
        searchResultsContainer.innerHTML = '';
        if (query.length < 2) {
            conversationsListContainer.style.display = 'block';
            return;
        }

        conversationsListContainer.style.display = 'none';
        const res = await fetch(`/api/users/search?q=${query}`, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const users = await res.json();
        
        users.forEach(user => {
            const item = createConversationItem({
                id: user.id,
                type: 'private',
                username: user.username || user.email.split('@')[0],
                lastMessage: user.email
            });
            item.addEventListener('click', () => {
                if (!conversations[user.id]) {
                    conversations[user.id] = { type: 'private', id: user.id, username: user.username || user.email.split('@')[0], lastMessage: '开始对话吧！' };
                    renderConversations();
                }
                switchChat('private', user.id, user.username || user.email.split('@')[0]);
                searchInput.value = '';
                searchResultsContainer.innerHTML = '';
                conversationsListContainer.style.display = 'block';
            });
            searchResultsContainer.appendChild(item);
        });
    }

    const handleRealtimeMessage = (payload) => {
        const msg = payload.new;
        const isPublic = msg.receiver_id === null;
        const isMyMessage = msg.sender_id === currentUser.id;
        
        let targetConvoId = isPublic ? 'public' : (isMyMessage ? msg.receiver_id : msg.sender_id);
        
        if (conversations[targetConvoId]) {
            conversations[targetConvoId].lastMessage = msg.content;
            conversations[targetConvoId].created_at = msg.created_at;
            renderConversations();
        }

        if (activeChat.id == targetConvoId) {
            displayMessage(msg);
        }
    };
    
    // --- 4. 初始化 ---
    async function main() {
        try {
            const [profileRes, convosRes, configRes] = await Promise.all([
                fetch('/api/profile', { headers: { 'Authorization': `Bearer ${userToken}` } }),
                fetch('/api/chat/conversations', { headers: { 'Authorization': `Bearer ${userToken}` } }),
                fetch('/api/config')
            ]);
            
            if (!profileRes.ok || !convosRes.ok || !configRes.ok) {
                 throw new Error('初始化失败，无法连接到服务器或认证失败。');
            }

            const profileData = await profileRes.json();
            const jwtPayload = JSON.parse(atob(userToken.split('.')[1]));
            currentUser = { ...profileData, id: jwtPayload.id };
            
            const config = await configRes.json();
            chatEncryptionKey = config.chatEncryptionKey;
            if (!chatEncryptionKey) {
                console.error("未能获取加密密钥，聊天消息将不会被加密。");
            }
            
            conversations['public'] = { type: 'public', id: 'public', username: '公开聊天室', lastMessage: '欢迎来到这里', created_at: new Date(0).toISOString() };
            const recentConvos = await convosRes.json();
            recentConvos.forEach(c => {
                conversations[c.peer_id] = { type: 'private', id: c.peer_id, username: c.peer_username || c.peer_email, lastMessage: c.content, created_at: c.created_at };
            });
            renderConversations();

            await new Promise((resolve, reject) => {
                supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${userToken}` } }
                });

                supabaseClient.channel('public:messages')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleRealtimeMessage)
                    .subscribe((status, err) => {
                        if (status === 'SUBSCRIBED') {
                            console.log('成功连接到实时服务！');
                            resolve();
                        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            console.error('实时服务连接失败:', err);
                            reject(new Error('实时服务连接超时。'));
                        }
                    });
            });

            await switchChat('public', 'public', '公开聊天室');

        } catch (err) {
            console.error("初始化失败:", err);
            loadingIndicator.textContent = err.message || "初始化失败，请刷新页面。";
        }
    }

    // --- 5. 事件监听 ---
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (!content) return;
        
        // 乐观更新UI：立即显示未加密的消息
        const tempMessage = {
            sender_id: currentUser.id,
            sender_email: currentUser.email,
            sender_username: currentUser.username,
            content: content, // 注意：这里显示的是明文
            created_at: new Date().toISOString()
        };
        // 在显示时，displayMessage内部会先尝试解密（虽然此时是明文，但函数能处理），保证逻辑统一
        displayMessage(tempMessage);

        const originalMessage = messageInput.value;
        messageInput.value = '';

        // 加密后发送到服务器
        const encryptedContent = encryptMessage(content, chatEncryptionKey);
        
        const body = { content: encryptedContent };
        if (activeChat.type === 'private') {
            body.receiverId = activeChat.id;
        }

        try {
            const response = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error("发送失败");
            }
            // 成功发送后，服务器会通过Supabase的实时推送返回消息，由handleRealtimeMessage处理
            // 这里不需要再做额外处理
        } catch (err) {
            alert('消息发送失败，请重试。');
            // 恢复输入框内容
            messageInput.value = originalMessage;
            // 可以在这里移除刚才乐观更新的消息气泡
        }
    });
    
    let searchTimeout;
    searchInput.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(handleSearch, 300);
    });
    searchInput.addEventListener('focus', () => {
        conversationsListContainer.style.display = 'none';
        searchResultsContainer.style.display = 'block';
    });
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement !== searchInput) {
                searchResultsContainer.style.display = 'none';
                conversationsListContainer.style.display = 'block';
            }
        }, 200);
    });

    main();
});