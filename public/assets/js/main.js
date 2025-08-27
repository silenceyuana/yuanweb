// assets/js/main.js (最终整合版 for index.html)

(function() {
    // --- 模块一：主题管理 ---
    const body = document.body;
    const themeCheckbox = document.getElementById('theme-checkbox');

    function applyTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            if (themeCheckbox) themeCheckbox.checked = true;
        } else {
            body.classList.remove('light-mode');
            if (themeCheckbox) themeCheckbox.checked = false;
        }
    }

    // 页面加载时立即应用主题
    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (prefersLight) {
        applyTheme('light');
    }

    // 为切换器添加事件
    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', () => {
            const newTheme = themeCheckbox.checked ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    // 监听跨页面同步
    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            applyTheme(event.newValue);
        }
    });


    // --- 模块二：认证与UI管理 ---
    function parseJwt(token) {
        try { return JSON.parse(atob(token.split('.')[1])); } catch (e) { return null; }
    }

    const userToken = localStorage.getItem('userToken');
    const loginButton = document.getElementById('login-button');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userToken) {
        // 用户已登录
        if (loginButton) loginButton.style.display = 'none';
        if (userDropdown) userDropdown.style.display = 'block';

        const userData = parseJwt(userToken);
        const userEmailSpan = document.getElementById('user-email');
        if (userData && userData.email && userEmailSpan) {
            userEmailSpan.textContent = userData.email;
        }

        const userDropdownToggle = document.getElementById('user-dropdown-toggle');
        const dropdownMenu = document.getElementById('dropdown-menu');
        const logoutButton = document.getElementById('logout-button');

        if (userDropdownToggle && dropdownMenu) {
            userDropdownToggle.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.toggle('show'); });
        }
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('userToken');
                alert('您已成功退出！');
                window.location.reload();
            });
        }
    } else {
        // 用户未登录
        if (loginButton) loginButton.style.display = 'block';
        if (userDropdown) userDropdown.style.display = 'none';
    }
    
    // 全局点击关闭下拉菜单
    window.addEventListener('click', (e) => {
        const dropdownMenu = document.getElementById('dropdown-menu');
        if (dropdownMenu && dropdownMenu.classList.contains('show') && userDropdown && !userDropdown.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // --- 模块三：工单按钮 ---
    const ticketButton = document.getElementById('ticket-button');
    if (ticketButton) {
        if (userToken) {
            ticketButton.textContent = '发送工单';
            ticketButton.href = 'ticket.html';
        } else {
            ticketButton.textContent = '登录以发送工单';
            ticketButton.href = 'login.html';
        }
    }

    // --- 模块四：汉堡菜单 ---
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navItems = document.getElementById('nav-items');
    if (hamburgerMenu && navItems) {
        hamburgerMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            navItems.classList.toggle('active');
        });
    }
})();