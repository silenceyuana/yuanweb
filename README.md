# Yuan的个人主页 (Personal Homepage)

这是一个基于原生 HTML、CSS 和 JavaScript 构建的现代化、响应式的个人主页模板。它拥有简洁的设计、深色/浅色模式切换以及专门用于展示作品的区域，非常适合作为开发者的个人数字名片。

**线上预览:** [https://<你的Vercel域名>.vercel.app/](https://<你的Vercel域名>.vercel.app/)

[![在 Vercel 上部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F<你的GitHub用户名>%2F<你的仓库名>)

![网站截图](./screenshot.png)
*(提示: 建议你截一张自己网站的图片，命名为 `screenshot.png` 并放在项目根目录)*

---

## ✨ 主要功能 (Features)

-   **现代化设计**: 简洁、优雅的界面设计，突出核心内容。
-   **🎨 深色/浅色主题**: 内置一键切换的深色与浅色模式，适配不同用户的偏好。
-   **📱 完全响应式**: 无论在桌面、平板还是手机上，都能提供完美的浏览体验。
-   **🖼️ 作品展示区**: 使用卡片式布局清晰地展示你的项目作品。
-   **🚀 零配置部署**: 可以轻松地一键部署到 Vercel 平台。
-   **📝 SEO 友好**: 预设了基本的 SEO 元标签，有助于搜索引擎收录。

---

## 🛠️ 技术栈 (Tech Stack)

-   **HTML5**
-   **CSS3** (使用 CSS 变量实现主题切换)
-   **JavaScript (Vanilla)** (用于实现导航菜单、主题切换等交互功能)

---

## 🚀 本地开发与运行 (Getting Started)

由于这是一个纯静态网站，你不需要复杂的配置。

1.  **克隆仓库到本地**:
    ```bash
    git clone https://github.com/<你的GitHub用户名>/<你的仓库名>.git
    ```

2.  **进入项目目录**:
    ```bash
    cd <你的仓库名>
    ```

3.  **在浏览器中打开**:
    直接在你的文件管理器中找到 `index.html` 文件，然后用浏览器（如 Chrome, Firefox）打开它即可预览。

    *   **推荐**: 为了获得更好的开发体验（例如热重载），你可以使用 VS Code 并安装 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) 插件。安装后，只需在 `index.html` 文件上右键，选择 `Open with Live Server` 即可。

---

## 部署到 Vercel (Deployment)

将这个网站托管到 Vercel 上非常简单，并且完全免费。

1.  **准备工作**:
    *   确保你已经将你的项目代码推送到了 GitHub 仓库。
    *   注册并登录 [Vercel](https://vercel.com/) 账号（推荐使用 GitHub 账号直接登录）。

2.  **导入项目**:
    *   在 Vercel 的仪表盘 (Dashboard) 页面，点击 `Add New...` -> `Project`。
    *   从列表中选择并导入你刚刚推送到 GitHub 的仓库。

3.  **配置与部署**:
    *   Vercel 会自动识别这是一个静态网站，你**无需任何特殊配置**。
    *   直接点击 `Deploy` 按钮。

4.  **完成**!
    *   等待大约 30 秒，Vercel 就会为你构建并部署好网站，并提供一个 `.vercel.app` 的域名供你访问。

> **自动部署**: 之后，每当你向 GitHub 仓库的 `main` (或 `master`) 分支推送新的提交时，Vercel 都会自动为你重新部署网站，无需手动操作！

---

## ✍️ 如何自定义 (Customization)

你可以轻松地修改网站内容，使其完全属于你。

-   **网站标题和描述**:
    *   打开 `index.html`，修改 `<head>` 标签内的 `<title>` 和 `<meta name="description">` 内容。

-   **个人信息**:
    *   在 `index.html` 中找到 `<!-- < 欢迎区 > -->` 和 `<!-- < 关于我 > -->` 的注释块，修改里面的文本内容为你自己的介绍。

-   **作品集**:
    *   在 `index.html` 中找到 `<!-- < 我的作品 > -->` 注释块。
    *   每个 `project-card` 代表一个项目。你可以修改其中的图标 (`<i class="...">`)、标题、描述和技术标签 (`<span class="tech-tag">`)。
    *   别忘了在 `<a>` 标签中填上你项目的实际链接。

-   **联系方式与社交链接**:
    *   在 `<!-- < 联系方式 > -->` 部分修改你的邮箱地址。
    *   在 `<!-- < 页脚 > -->` 部分，修改 `<a>` 标签中的 `href` 属性，链接到你的 GitHub、Bilibili 或其他社交媒体主页。

-   **头像/图标**:
    *   替换 `assets/img/favicon.ico` 文件为你自己的图标或头像。

---

## 📄 许可证 (License)

本项目采用 [MIT License](LICENSE) 授权。