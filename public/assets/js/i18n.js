// i18n.js - 国际化配置文件 (API版本)

// 查找所有带 data-i18n 属性的元素并更新其内容
function updateContent() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attribute = el.getAttribute('data-i18n-attr');
        const translation = i18next.t(key);

        if (attribute) {
            el.setAttribute(attribute, translation);
        } else {
            el.innerHTML = translation;
        }
    });
}

// 初始化 i18next
i18next
    .use(i18nextBrowserLanguageDetector)
    .use(i18nextHttpBackend)
    .init({
        debug: false,
        fallbackLng: 'zh-CN',
        backend: {
            // 【核心修改】
            // loadPath现在指向我们创建的API端点
            loadPath: '/api/locales/{{lng}}', 
        },
        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator'],
            caches: ['cookie', 'localStorage'],
            lookupQuerystring: 'lng',
        }
    }, (err, t) => {
        if (err) return console.error('i18next initialization failed', err);
        updateContent();
    });

// 监听语言变化事件
i18next.on('languageChanged', () => {
    updateContent();
});