// public/assets/js/theme-sync.js
(function() {
    // 这个函数会立即执行，以最快速度应用主题，防止页面"闪烁"
    function applyTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

        // 检查 localStorage 中是否有保存的主题，或者系统是否偏好浅色主题
        if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
            // 直接在 <html> 元素上添加类，这是最规范的做法
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
    }
    
    applyTheme();

    // 监听其他标签页的主题变化，并同步更新当前页面
    // 这样当用户在一个页面切换主题时，所有打开的页面都会立即响应
    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            applyTheme();
        }
    });
})();