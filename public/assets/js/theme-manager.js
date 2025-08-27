// assets/js/theme-sync.js

(function() {
    // 这个函数会立即执行
    function applyTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

        if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
    }
    applyTheme();

    // 监听跨标签页的主题变化
    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            applyTheme();
        }
    });
})();