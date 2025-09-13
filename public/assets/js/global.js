document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 汉堡菜单功能 ---
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navItems = document.getElementById('nav-items');

    if (hamburgerMenu && navItems) {
        hamburgerMenu.addEventListener('click', () => {
            // 切换 .active 类的存在状态
            navItems.classList.toggle('active');
        });
    }

    // --- 2. 用户登录状态检查与UI更新 ---
    const userToken = localStorage.getItem('userToken');
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    const loginButton = document.getElementById('login-button');
    const userDropdown = document.getElementById('user-dropdown');
    const userEmailSpan = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');
    const ticketButton = document.getElementById('ticket-button');

    if (userToken && userInfo) {
        // 如果用户已登录
        if (loginButton) loginButton.style.display = 'none';
        if (userDropdown) userDropdown.style.display = 'block';
        if (userEmailSpan) {
            // 优先显示昵称，如果没有昵称则显示邮箱前缀
            userEmailSpan.textContent = userInfo.username || userInfo.email.split('@')[0];
        }
        if (ticketButton) ticketButton.style.display = 'inline-block'; // 登录后显示发送工单按钮
    } else {
        // 如果用户未登录
        if (loginButton) loginButton.style.display = 'block';
        if (userDropdown) userDropdown.style.display = 'none';
        if (ticketButton) ticketButton.style.display = 'none';
    }

    // --- 3. 用户下拉菜单功能 ---
    const userDropdownToggle = document.getElementById('user-dropdown-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');

    if (userDropdownToggle && dropdownMenu) {
        userDropdownToggle.addEventListener('click', (event) => {
            event.stopPropagation(); // 防止点击事件冒泡到 window
            dropdownMenu.classList.toggle('show');
        });

        // 点击页面其他地方关闭下拉菜单
        window.addEventListener('click', () => {
            if (dropdownMenu.classList.contains('show')) {
                dropdownMenu.classList.remove('show');
            }
        });
    }

    // --- 4. 退出登录功能 ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userInfo');
            window.location.href = 'index.html'; // 退出后返回主页
        });
    }

    // --- 5. 主题切换功能 ---
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
        // 初始化时根据 localStorage 设置开关状态
        if (localStorage.getItem('theme') === 'light') {
            themeCheckbox.checked = true;
            document.documentElement.classList.add('light-mode');
        } else {
            themeCheckbox.checked = false;
            document.documentElement.classList.remove('light-mode');
        }

        themeCheckbox.addEventListener('change', function() {
            if (this.checked) {
                // 切换到浅色模式
                localStorage.setItem('theme', 'light');
                document.documentElement.classList.add('light-mode');
            } else {
                // 切换到深色模式
                localStorage.setItem('theme', 'dark');
                document.documentElement.classList.remove('light-mode');
            }
        });
    }
});