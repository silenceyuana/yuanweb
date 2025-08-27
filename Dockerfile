# --- 第一阶段：构建 ---
# 使用一个官方的 Node.js 运行时作为基础镜像
FROM node:18-alpine AS builder

# 在容器内创建一个目录来存放应用代码
WORKDIR /app

# 1. 首先只复制 package.json 和 package-lock.json
# 这样只有在依赖发生变化时，Docker 才会重新执行 npm install
COPY package*.json ./

# 2. 在 Docker 容器内部（Linux环境）安装依赖
# 这一步会为正确的 Linux 架构编译 sqlite3
RUN npm install --production

# 3. 然后再复制您项目的所有其他文件
COPY . .

# --- 第二阶段：生产 ---
# 使用一个更小的基础镜像来运行应用
FROM node:18-alpine

WORKDIR /app

# 从'builder'阶段复制已经安装好的依赖和代码
COPY --from=builder /app ./

# 暴露应用运行的端口 (请确保这是您代码中使用的端口)
EXPOSE 3000

# 定义容器启动时运行的命令
CMD ["node", "server.js"]