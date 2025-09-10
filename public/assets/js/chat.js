// chat.js - 全新聊天界面逻辑
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

    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const chatTitle = document.getElementById('chat-title');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const conversationsListContainer = document.getElementById('conversations-list');

    // --- 2. 辅助函数 ---
    const scrollToBottom = () => { messagesContainer.scrollTop = messagesContainer.scrollHeight; };

    const displayMessage = (msg, isHistory = false) => {
        const isSent = msg.sender_id === currentUser.id;
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
        const sender = isSent ? '你' : (msg.sender_username || msg.sender_email.split('@')[0]);
        bubble.innerHTML = `
            <div class="sender">${sender}</div>
            <div class="content">${msg.content}</div>
            <div class="timestamp">${new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        messagesContainer.appendChild(bubble);
        if (!isHistory) {
            scrollToBottom();
        }
    };

    const renderConversations = () => {
        conversationsListContainer.innerHTML = '';
        // 总是先显示公开聊天
        const publicConvo = conversations['public'];
        if (publicConvo) {
            conversationsListContainer.appendChild(createConversationItem(publicConvo));
        }
        // 然后显示私聊
        Object.values(conversations).filter(c => c.type === 'private').forEach(convo => {
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
        
        item.innerHTML = `
            <div class="avatar">${(convo.username || '?').charAt(0)}</div>
            <div class="convo-details">
                <div class="username">${convo.username}</div>
                <div class="last-message">${convo.lastMessage || '...'}</div>
            </div>
        `;
        item.addEventListener('click', () => switchChat(convo.type, convo.id, convo.username));
        return item;
    };
    
    // --- 3. 核心功能函数 ---
    async function switchChat(type, id, username) {
        if (activeChat.id === id) return;

        activeChat = { type, id, username };
        chatTitle.textContent = username;
        messagesContainer.innerHTML = '<div class="loading-indicator">正在加载消息...</div>';

        document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
        document.querySelector(`.conversation-item[data-id='${id}']`)?.classList.add('active');

        const endpoint = type === 'public' ? '/api/chat/public' : `/api/chat/private/${id}`;
        const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const messages = await res.json();
        
        messagesContainer.innerHTML = '';
        messages.forEach(msg => displayMessage(msg, true));
        scrollToBottom();
    }
    
    async function handleSearch() {
        const query = searchInput.value.trim();
        searchResultsContainer.innerHTML = '';
        if (query.length < 2) return;

        const res = await fetch(`/api/users/search?q=${query}`, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const users = await res.json();
        
        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `<div class="avatar">${user.username.charAt(0)}</div> <div class="username">${user.username}</div>`;
            item.addEventListener('click', () => {
                if (!conversations[user.id]) {
                    conversations[user.id] = { type: 'private', id: user.id, username: user.username, lastMessage: '开始对话吧！' };
                    renderConversations();
                }
                switchChat('private', user.id, user.username);
                searchInput.value = '';
                searchResultsContainer.innerHTML = '';
            });
            searchResultsContainer.appendChild(item);
        });
    }

    const handleRealtimeMessage = (payload) => {
        const msg = payload.new;
        const isPublic = msg.receiver_id === null;
        const isMyMessage = msg.sender_id === currentUser.id;
        const isForMe = msg.receiver_id === currentUser.id;

        let targetConvoId = isPublic ? 'public' : (isMyMessage ? msg.receiver_id : msg.sender_id);
        
        if (conversations[targetConvoId]) {
            conversations[targetConvoId].lastMessage = msg.content;
            renderConversations();
        }

        if (activeChat.id == targetConvoId) {
            displayMessage(msg);
        }
    };
    
    // --- 4. 初始化 ---
    async function main() {
        try {
            // 获取当前用户信息
            const profileRes = await fetch('/api/profile', { headers: { 'Authorization': `Bearer ${userToken}` } });
            currentUser = await profileRes.json();
            const jwtPayload = JSON.parse(atob(userToken.split('.')[1]));
            currentUser.id = jwtPayload.id;

            // 初始化公开聊天
            conversations['public'] = { type: 'public', id: 'public', username: '公开聊天室', lastMessage: '欢迎来到这里' };

            // 获取最近对话
            const convosRes = await fetch('/api/chat/conversations', { headers: { 'Authorization': `Bearer ${userToken}` } });
            const recentConvos = await convosRes.json();
            recentConvos.forEach(c => {
                conversations[c.peer_id] = { type: 'private', id: c.peer_id, username: c.peer_username || c.peer_email, lastMessage: c.content };
            });
            renderConversations();
            
            // 获取 Supabase 配置并订阅
            const configRes = await fetch('/api/config');
            const config = await configRes.json();
            supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
                global: { headers: { Authorization: `Bearer ${userToken}` } }
            });
            supabaseClient.channel('public:messages')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleRealtimeMessage)
                .subscribe();

            // 默认加载公开聊天
            await switchChat('public', 'public', '公开聊天室');

        } catch (err) {
            console.error("初始化失败:", err);
            messagesContainer.innerHTML = '<div class="loading-indicator">初始化失败，请刷新页面。</div>';
        }
    }

    // --- 5. 事件监听 ---
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (!content) return;
        messageInput.value = '';

        const body = { content };
        if (activeChat.type === 'private') {
            body.receiverId = activeChat.id;
        }

        try {
            const response = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify(body)
            });
            if (response.ok) {
                // 实时消息会处理显示，这里可以做一些UI反馈，比如乐观更新
                const sentMsg = await response.json();
                displayMessage(sentMsg);
            }
        } catch (err) {
            alert('消息发送失败');
        }
    });
    
    // 使用 debounce 防止频繁搜索
    let searchTimeout;
    searchInput.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(handleSearch, 300);
    });

    main();
});