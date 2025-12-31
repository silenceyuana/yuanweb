document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 汉堡菜单功能 ---
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navItems = document.getElementById('nav-items');

    if (hamburgerMenu && navItems) {
        hamburgerMenu.addEventListener('click', () => {
            console.log('Hamburger menu clicked');
            navItems.classList.toggle('active');
            hamburgerMenu.classList.toggle('active');
            
            // 切换图标
            const icon = hamburgerMenu.querySelector('i');
            if (navItems.classList.contains('active')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });
    } else {
        console.log('Hamburger menu or nav items not found', hamburgerMenu, navItems);
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
        if (ticketButton) ticketButton.style.display = 'inline-block'; // 始终显示
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

    // --- 5. 自动主题适配 ---
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    function handleThemeChange(e) {
        if (e.matches) {
            document.documentElement.classList.remove('light-mode');
        } else {
            document.documentElement.classList.add('light-mode');
        }
    }
    mediaQuery.addEventListener('change', handleThemeChange);
    handleThemeChange(mediaQuery); // 初始化

    // --- 6. 导航栏滚动效果 ---
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.classList.add('island'); // 初始为岛状

        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.remove('island');
            } else {
                navbar.classList.add('island');
            }
        });
    }
});