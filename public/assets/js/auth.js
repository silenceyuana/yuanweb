function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 认证状态和导航栏UI更新逻辑 ---
    const userToken = localStorage.getItem('userToken');
    const loginButton = document.getElementById('login-button');
    const userDropdown = document.getElementById('user-dropdown');
    const userDropdownToggle = document.getElementById('user-dropdown-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const userEmailSpan = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');

    if (userToken) {
        if(loginButton) loginButton.style.display = 'none';
        if(userDropdown) userDropdown.style.display = 'block';

        const userData = parseJwt(userToken);
        if (userData && userData.email && userEmailSpan) {
            userEmailSpan.textContent = userData.email;
        }

        if (userDropdownToggle) {
            userDropdownToggle.addEventListener('click', (event) => {
                event.stopPropagation();
                if(dropdownMenu) dropdownMenu.classList.toggle('show');
            });
        }
        
        if(logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('userToken');
                alert('您已成功退出！');
                window.location.reload();
            });
        }

    } else {
        if(loginButton) loginButton.style.display = 'block';
        if(userDropdown) userDropdown.style.display = 'none';
    }

    // 全局点击事件：用于关闭已打开的下拉菜单
    window.addEventListener('click', (event) => {
        if (dropdownMenu && dropdownMenu.classList.contains('show') && !userDropdown.contains(event.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // --- 工单按钮状态逻辑 ---
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
});