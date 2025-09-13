document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 汉堡菜单功能 ---
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navItems = document.getElementById('nav-items');

    if (hamburgerMenu && navItems) {
        hamburgerMenu.addEventListener('click', () => {
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
        // 用户已登录
        if (loginButton) loginButton.style.display = 'none';
        if (userDropdown) userDropdown.style.display = 'block';
        if (userEmailSpan) {
            userEmailSpan.textContent = userInfo.username || userInfo.email.split('@')[0];
        }
        if (ticketButton) ticketButton.style.display = 'inline-block';
    } else {
        // 用户未登录
        if (loginButton) loginButton.style.display = 'block';
        if (userDropdown) userDropdown.style.display = 'none';
        if (ticketButton) ticketButton.style.display = 'none';
    }

    // --- 3. 用户下拉菜单功能 ---
    const userDropdownToggle = document.getElementById('user-dropdown-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');

    if (userDropdownToggle && dropdownMenu) {
        userDropdownToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
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
            window.location.href = 'index.html';
        });
    }

    // --- 5. 主题切换功能 ---
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
        // 初始化开关状态
        if (localStorage.getItem('theme') === 'light') {
            themeCheckbox.checked = true;
        } else {
            themeCheckbox.checked = false;
        }

        themeCheckbox.addEventListener('change', function() {
            if (this.checked) {
                localStorage.setItem('theme', 'light');
                document.documentElement.classList.add('light-mode');
            } else {
                localStorage.setItem('theme', 'dark');
                document.documentElement.classList.remove('light-mode');
            }
        });
    }
});