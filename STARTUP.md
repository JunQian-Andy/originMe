# 项目启动说明

## 1. 项目简介

这是一个面向个人/小团队的轻量 Web 在线编辑系统，基于 Node.js + Express + SQLite + OnlyOffice 构建。

- 在线编辑 Word / Excel / PPT 文档
- 支持文档访问、编辑、管理员三级权限控制
- 系统管理员可管理用户、文档类型、存储路径及全局配置
- 使用 SQLite 单文件数据库，无需额外部署数据库服务
- 前端为原生 HTML/JS，无构建步骤

## 2. 环境要求

| 依赖 | 版本/说明 |
|------|-----------|
| Node.js | >= 18.0.0 |
| npm | 随 Node.js 附带 |
| OnlyOffice Document Server | 运行在本机 `http://localhost:8081` |

## 3. 目录结构

```
.
├── server.js              # Express 应用入口
├── config.js              # 项目配置读取
├── db.js                  # SQLite 初始化与连接
├── .env.example           # 环境变量示例
├── package.json
├── middleware/
│   └── auth.js            # 登录/权限校验中间件
├── routes/
│   ├── auth.js            # 登录/登出/当前用户
│   ├── documents.js       # 文档 CRUD、权限、OnlyOffice 配置
│   ├── admin.js           # 管理后台接口
│   └── onlyoffice.js      # OnlyOffice 回调与文件下载
├── services/
│   ├── permission.js      # 权限检查逻辑
│   └── storage.js         # 文件存储操作
├── public/                # 前端静态资源
│   ├── login.html
│   ├── index.html
│   ├── admin.html
│   └── js/ / css/
└── uploads/               # 文档物理存储目录
```

## 4. 快速启动

### 步骤 1：安装依赖

```bash
npm install
```

### 步骤 2：配置环境变量

```bash
cp .env.example .env
```

根据实际情况编辑 `.env`：

```ini
# 服务端口号
PORT=3000
NODE_ENV=development

# OnlyOffice 文档服务地址
# 绝对地址：前端直接加载，如 http://172.16.166.1:8081
# 相对路径 /onlyoffice：走同源代理，需要同时配置 ONLYOFFICE_PROXY_TARGET
ONLYOFFICE_SERVER_URL=/onlyoffice
ONLYOFFICE_PROXY_TARGET=http://localhost:8081

# OnlyOffice JWT 安全令牌密钥，需与 OnlyOffice 服务 local.json 中的 secret 保持一致
ONLYOFFICE_JWT_SECRET=change_this_to_your_jwt_secret

# OnlyOffice 容器回调本服务时使用的主机地址
# 应填写本服务可被 OnlyOffice 容器访问到的地址，而不是 OnlyOffice 自身的地址
ONLYOFFICE_CALLBACK_HOST=http://172.17.0.1:3000

# Session 密钥，请替换为随机字符串
SESSION_SECRET=change_this_to_a_random_secret_string

# 默认管理员账号（首次启动自动创建）
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin
```

### 步骤 3：启动 OnlyOffice Document Server

确保 OnlyOffice Document Server 已在本地 `8081` 端口运行，例如：

```bash
docker run -d -p 8081:80 onlyoffice/documentserver
```

验证访问：http://localhost:8081

### 步骤 4：启动应用

开发模式（文件变更自动重启）：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

启动成功后，控制台输出：

```
Server is running at http://localhost:3000
```

## 5. 访问系统

| 入口 | 地址 | 说明 |
|------|------|------|
| 登录页 | http://localhost:3000/login.html | 本地账号登录 |
| 文档首页 | http://localhost:3000/index.html | 文档列表与编辑器 |
| 管理后台 | http://localhost:3000/admin.html | 仅系统管理员可访问 |

## 6. 默认账号

首次启动时，系统会自动创建默认管理员账号：

- 用户名：`admin`
- 密码：`admin`

> 生产环境请务必在 `.env` 中修改默认密码。

## 7. 验证流程

1. 打开 `http://localhost:3000/login.html`，使用 `admin / admin` 登录。
2. 进入 `admin.html`，创建普通用户账号。
3. 测试普通用户登录、修改密码、重新登录。
4. 在首页上传或新建 Office 文档，检查 OnlyOffice 编辑器是否加载。
5. 编辑文档并保存，确认文件及数据库时间戳更新。
6. 切换其他账号测试 `view / edit / admin` 权限。
7. 在管理后台测试文档类型存储路径配置、停用账号、删除文档等功能。

## 8. 注意事项

- 数据库文件 `data.sqlite` 和 `sessions.sqlite` 为自动生成，建议加入版本控制忽略列表。
- 上传的文档默认存储在 `uploads/` 目录下，按文档类型分子目录。
- 如需修改 OnlyOffice 地址，编辑 `.env` 后重启服务即可。
- 微信登录当前为占位实现，真实接入时替换 `routes/auth.js` 中相关逻辑即可。
