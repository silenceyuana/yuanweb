// public/assets/js/theme-sync.js (修正版)
(function() {
    function applyTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

        // 直接在 <body> 上添加或移除类，与 theme.css 完全匹配
        if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
            // 为了防止 body 还未加载完成，我们先在 html 上预设
            document.documentElement.classList.add('light-mode'); 
        } else {
            document.documentElement.classList.remove('light-mode');
        }
    }
    applyTheme();

    // 监听其他标签页的主题变化
    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            applyTheme();
        }
    });
    
    // 确保 body 加载后，类名也正确
    document.addEventListener('DOMContentLoaded', () => {
         if (document.documentElement.classList.contains('light-mode')) {
             document.body.classList.add('light-mode');
         } else {
             document.body.classList.remove('light-mode');
         }
    });
})();