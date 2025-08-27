// public/assets/js/global.js
// 这个文件包含了所有页面共享的、在 DOM 加载后执行的逻辑

document.addEventListener('DOMContentLoaded', () => {

    // --- 模块一：主题切换器逻辑 ---
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
        // 根据 <html> 元素的 class 初始化切换器的状态
        themeCheckbox.checked = document.documentElement.classList.contains('light-mode');

        // 为切换器添加事件监听
        themeCheckbox.addEventListener('change', () => {
            const newTheme = themeCheckbox.checked ? 'light' : 'dark';
            // 1. 保存新主题到 localStorage
            localStorage.setItem('theme', newTheme);
            
            // 2. 立即应用到当前页面，无需等待事件
            if (newTheme === 'light') {
                document.documentElement.classList.add('light-mode');
            } else {
                document.documentElement.classList.remove('light-mode');
            }
        });
    }


    // --- 模块二：认证状态与导航栏UI管理 ---
    function parseJwt(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
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
            userDropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('show');
            });
        }
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('userToken');
                alert('您已成功退出！');
                window.location.href = '/'; // 退出后返回主页
            });
        }
    } else {
        // 用户未登录
        if (loginButton) loginButton.style.display = 'block';
        if (userDropdown) userDropdown.style.display = 'none';
    }

    // 全局点击事件：用于关闭已打开的下拉菜单
    window.addEventListener('click', (e) => {
        const dropdownMenu = document.getElementById('dropdown-menu');
        if (dropdownMenu && dropdownMenu.classList.contains('show') && userDropdown && !userDropdown.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });


    // --- 模块三：工单按钮状态管理 ---
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


    // --- 模块四：汉堡菜单（移动端导航） ---
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navItems = document.getElementById('nav-items');
    if (hamburgerMenu && navItems) {
        hamburgerMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            navItems.classList.toggle('active');
        });
    }
});