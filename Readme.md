个人 Web 在线编辑系统实现计划                                                                                                                                                │
│                                                                                                                                                                              │
│ 背景与目标                                                                                                                                                                   │
│                                                                                                                                                                              │
│ 为个人/小团队构建一套基于 Node.js + Express + SQLite 的轻量 Web 在线编辑系统。                                                                                               │
│ - 后端 OnlyOffice Document Server 运行在本机 8081 端口，系统通过 OnlyOffice JS API 嵌入编辑器。                                                                              │
│ - 支持微信登录占位，当前先实现本地演示登录，便于后续接入真实微信 OAuth。                                                                                                     │
│ - 支持文档的访问权限、编辑权限、管理员权限三级权限控制，管理员可删除文档。                                                                                                   │
│ - 支持在项目配置中为不同文档类型设置独立存储路径。                                                                                                                           │
│ - 提供 Web 管理页面，管理文档、用户和项目配置。                                                                                                                              │
│ - 面向少量用户，使用 SQLite 单文件数据库，简化部署。                                                                                                                         │
│                                                                                                                                                                              │
│ 技术栈                                                                                                                                                                       │
│                                                                                                                                                                              │
│ - 运行环境：Node.js 18+                                                                                                                                                      │
│ - 后端框架：Express 4                                                                                                                                                        │
│ - 数据库：SQLite（better-sqlite3）                                                                                                                                           │
│ - 会话：express-session + connect-sqlite3（会话持久化）                                                                                                                      │
│ - 文件上传/存储：原生 fs + multer                                                                                                                                            │
│ - 密码加密：bcryptjs                                                                                                                                                         │
│ - 前端：纯 HTML + 原生 JS（单页面应用风格，无构建步骤，降低维护成本）                                                                                                        │
│ - 在线编辑器：OnlyOffice Document Server（http://localhost:8081）                                                                                                            │
│                                                                                                                                                                              │
│ 项目结构                                                                                                                                                                     │
│                                                                                                                                                                              │
│ .                                                                                                                                                                            │
│ ├── package.json                                                                                                                                                             │
│ ├── .env.example                                                                                                                                                             │
│ ├── README.md                                                                                                                                                                │
│ ├── server.js                 # Express 应用入口                                                                                                                             │
│ ├── config.js                 # 项目配置（OnlyOffice 地址、默认管理员等）                                                                                                    │
│ ├── db.js                     # SQLite 数据库初始化与连接                                                                                                                    │
│ ├── middleware/                                                                                                                                                              │
│ │   └── auth.js               # 登录校验、权限校验中间件                                                                                                                     │
│ ├── routes/                                                                                                                                                                  │
│ │   ├── auth.js               # 登录/登出/当前用户（含微信占位登录）                                                                                                         │
│ │   ├── documents.js          # 文档 CRUD、权限管理、OnlyOffice 配置                                                                                                         │
│ │   ├── admin.js              # 管理后台接口（用户、文档类型、配置）                                                                                                         │
│ │   └── onlyoffice.js         # OnlyOffice 回调与文件下载接口                                                                                                                │
│ ├── services/                                                                                                                                                                │
│ │   ├── permission.js         # 权限检查逻辑                                                                                                                                 │
│ │   └── storage.js            # 文档存储路径解析与文件操作                                                                                                                   │
│ ├── public/                   # 静态前端资源                                                                                                                                 │
│ │   ├── index.html            # 文档列表 + 编辑器入口                                                                                                                        │
│ │   ├── admin.html            # 管理后台页面                                                                                                                                 │
│ │   ├── css/                                                                                                                                                                 │
│ │   │   └── style.css                                                                                                                                                        │
│ │   └── js/                                                                                                                                                                  │
│ │       ├── api.js            # 前端 API 封装                                                                                                                                │
│ │       ├── app.js            # 首页逻辑                                                                                                                                     │
│ │       └── admin.js          # 管理后台逻辑                                                                                                                                 │
│ └── uploads/                  # 默认文档存储目录（按类型分子目录）                                                                                                           │
│                                                                                                                                                                              │
│ 数据模型                                                                                                                                                                     │
│                                                                                                                                                                              │
│ 使用 SQLite，通过 db.js 初始化以下表：                                                                                                                                       │
│                                                                                                                                                                              │
│ 1. users：用户信息                                                                                                                                                           │
│   - id INTEGER PRIMARY KEY                                                                                                                                                   │
│   - username TEXT UNIQUE（本地登录账号）                                                                                                                                     │
│   - password_hash TEXT（bcrypt 加密后的密码）                                                                                                                                │
│   - openid TEXT UNIQUE（微信 openid，占位阶段可为空）                                                                                                                        │
│   - nickname TEXT                                                                                                                                                            │
│   - avatar TEXT                                                                                                                                                              │
│   - role TEXT DEFAULT 'user'（admin / user）                                                                                                                                 │
│   - status TEXT DEFAULT 'active'（active / inactive）                                                                                                                        │
│   - created_at / updated_at DATETIME                                                                                                                                         │
│ 2. login_records（可选）：登录日志                                                                                                                                           │
│   - id INTEGER PRIMARY KEY                                                                                                                                                   │
│   - user_id INTEGER                                                                                                                                                          │
│   - ip TEXT                                                                                                                                                                  │
│   - user_agent TEXT                                                                                                                                                          │
│   - login_at DATETIME                                                                                                                                                        │
│ 3. documents：文档元数据                                                                                                                                                     │
│   - id INTEGER PRIMARY KEY                                                                                                                                                   │
│   - title TEXT                                                                                                                                                               │
│   - type_id INTEGER（关联 document_types）                                                                                                                                   │
│   - filename TEXT（磁盘文件名）                                                                                                                                              │
│   - owner_id INTEGER                                                                                                                                                         │
│   - created_at / updated_at DATETIME                                                                                                                                         │
│ 4. document_types：文档类型及存储路径                                                                                                                                        │
│   - id INTEGER PRIMARY KEY                                                                                                                                                   │
│   - name TEXT UNIQUE（如 word、excel、ppt）                                                                                                                                  │
│   - storage_path TEXT（相对或绝对路径）                                                                                                                                      │
│ 5. permissions：文档权限                                                                                                                                                     │
│   - id INTEGER PRIMARY KEY                                                                                                                                                   │
│   - document_id INTEGER                                                                                                                                                      │
│   - user_id INTEGER                                                                                                                                                          │
│   - level TEXT（view / edit / admin）                                                                                                                                        │
│   - UNIQUE(document_id, user_id)                                                                                                                                             │
│ 6. project_config：项目级配置键值                                                                                                                                            │
│   - key TEXT PRIMARY KEY                                                                                                                                                     │
│   - value TEXT                                                                                                                                                               │
│                                                                                                                                                                              │
│ 权限模型                                                                                                                                                                     │
│                                                                                                                                                                              │
│ - 文档 owner 自动拥有该文档的 admin 权限。                                                                                                                                   │
│ - view：可查看/打开文档。                                                                                                                                                    │
│ - edit：可在 OnlyOffice 中编辑并保存。                                                                                                                                       │
│ - admin：可修改文档权限、删除文档、转移所有权。                                                                                                                              │
│ - 系统级 admin 角色：可进入管理后台，管理文档类型/存储路径/用户。                                                                                                            │
│                                                                                                                                                                              │
│ 权限检查集中在 services/permission.js：                                                                                                                                      │
│ - canView(userId, docId)                                                                                                                                                     │
│ - canEdit(userId, docId)                                                                                                                                                     │
│ - canAdmin(userId, docId)                                                                                                                                                    │
│ - setPermission(docId, targetUserId, level)                                                                                                                                  │
│                                                                                                                                                                              │
│ OnlyOffice 集成要点                                                                                                                                                          │
│                                                                                                                                                                              │
│ OnlyOffice Document Server 跑在 http://localhost:8081。                                                                                                                      │
│                                                                                                                                                                              │
│ 1. 打开文档：前端调用 /api/documents/:id/config 获取 OnlyOffice 配置：                                                                                                       │
│   - document.key：由 docId + updated_at 或版本号生成的唯一 key。                                                                                                             │
│   - document.url：文档下载地址 /api/onlyoffice/download/:id。                                                                                                                │
│   - editorConfig.mode：edit（可编辑）或 view（只读）。                                                                                                                       │
│   - editorConfig.callbackUrl：/api/onlyoffice/callback/:id。                                                                                                                 │
│ 2. 保存文档：OnlyOffice 调用 callbackUrl 推送最新文件，服务端写回磁盘并更新 updated_at。                                                                                     │
│ 3. 下载文档：权限校验后返回文件流，供 OnlyOffice 读取。                                                                                                                      │
│                                                                                                                                                                              │
│ 认证方式                                                                                                                                                                     │
│                                                                                                                                                                              │
│ 系统同时支持本地账号登录与微信登录占位两种模式。                                                                                                                             │
│                                                                                                                                                                              │
│ 本地账号登录                                                                                                                                                                 │
│                                                                                                                                                                              │
│ - 使用 username + password 登录，密码使用 bcryptjs 加密存储。                                                                                                                │
│ - 登录时校验账号状态 status，inactive 账号禁止登录并提示“账号已停用”。                                                                                                       │
│ - 普通用户可在个人设置中修改自己的密码。                                                                                                                                     │
│ - 系统管理员可在管理后台：                                                                                                                                                   │
│   - 创建新账号（设置初始密码）。                                                                                                                                             │
│   - 修改用户信息（昵称、角色、状态）。                                                                                                                                       │
│   - 停用/启用账号。                                                                                                                                                          │
│   - 重置指定账号密码。                                                                                                                                                       │
│                                                                                                                                                                              │
│ 微信登录占位实现                                                                                                                                                             │
│                                                                                                                                                                              │
│ 当前不接入真实微信 OAuth，而是提供一个演示登录接口：                                                                                                                         │
│ - POST /api/auth/demo-login：传入 nickname，服务端创建/查找用户并写入 session。                                                                                              │
│ - 后续真实微信登录只需替换 routes/auth.js 中的登录逻辑，保留 session 写入部分即可。                                                                                          │
│ - 保留 openid 字段，真实接入时通过 openid 匹配用户。                                                                                                                         │
│                                                                                                                                                                              │
│ 管理后台功能（Web 页面）                                                                                                                                                     │
│                                                                                                                                                                              │
│ public/admin.html 仅对系统 admin 角色开放：                                                                                                                                  │
│ - 用户管理：查看用户列表、创建账号、修改信息、停用/启用、重置密码、设置系统管理员。                                                                                          │
│ - 文档类型管理：新增/修改/删除类型及其存储路径。                                                                                                                             │
│ - 项目配置：OnlyOffice 服务器地址等全局配置。                                                                                                                                │
│                                                                                                                                                                              │
│ 实现步骤                                                                                                                                                                     │
│                                                                                                                                                                              │
│ 1. 初始化 Node.js 项目，安装依赖：express, better-sqlite3, express-session, connect-sqlite3, multer, dotenv, bcryptjs。                                                      │
│ 2. 编写 config.js 与 .env.example，配置 OnlyOffice 地址、端口、默认管理员账号。                                                                                              │
│ 3. 编写 db.js 创建表结构并提供数据库连接；初始化时若不存在管理员，自动创建默认管理员账号。                                                                                   │
│ 4. 实现 middleware/auth.js 登录校验、账号状态校验、系统管理员校验。                                                                                                          │
│ 5. 实现 services/permission.js 与 services/storage.js。                                                                                                                      │
│ 6. 实现 routes/auth.js：                                                                                                                                                     │
│   - POST /api/auth/login：本地账号密码登录。                                                                                                                                 │
│   - POST /api/auth/demo-login：微信占位/演示登录。                                                                                                                           │
│   - POST /api/auth/logout：登出。                                                                                                                                            │
│   - GET /api/auth/me：当前登录用户信息。                                                                                                                                     │
│   - POST /api/auth/change-password：修改自己的密码。                                                                                                                         │
│ 7. 实现 routes/admin-users.js（或合并到 admin.js）：                                                                                                                         │
│   - GET /api/admin/users：用户列表。                                                                                                                                         │
│   - POST /api/admin/users：创建用户。                                                                                                                                        │
│   - PUT /api/admin/users/:id：修改用户信息/状态/角色。                                                                                                                       │
│   - POST /api/admin/users/:id/reset-password：重置密码。                                                                                                                     │
│ 8. 实现 routes/documents.js：                                                                                                                                                │
│   - GET /api/documents：当前用户可见文档列表。                                                                                                                               │
│   - POST /api/documents：创建文档/上传文件。                                                                                                                                 │
│   - GET /api/documents/:id：文档详情。                                                                                                                                       │
│   - DELETE /api/documents/:id：删除文档（owner/admin）。                                                                                                                     │
│   - GET /api/documents/:id/config：OnlyOffice 配置。                                                                                                                         │
│   - POST /api/documents/:id/permissions：设置权限（admin）。                                                                                                                 │
│ 9. 实现 routes/onlyoffice.js：下载文件与保存回调。                                                                                                                           │
│ 10. 实现 routes/admin.js：文档类型、项目配置管理（用户管理可拆分到 routes/admin-users.js）。                                                                                 │
│ 11. 实现前端页面：                                                                                                                                                           │
│   - public/login.html：本地账号登录页。                                                                                                                                      │
│   - public/index.html：文档列表 + 编辑器入口。                                                                                                                               │
│   - public/admin.html：管理后台页面（含用户管理）。                                                                                                                          │
│ 12. 本地启动 OnlyOffice（8081）并测试登录、新建、编辑、保存、权限、删除、账号停用等全流程。                                                                                  │
│                                                                                                                                                                              │
│ 关键文件清单                                                                                                                                                                 │
│                                                                                                                                                                              │
│ - package.json                                                                                                                                                               │
│ - .env.example                                                                                                                                                               │
│ - server.js                                                                                                                                                                  │
│ - config.js                                                                                                                                                                  │
│ - db.js                                                                                                                                                                      │
│ - middleware/auth.js                                                                                                                                                         │
│ - services/permission.js                                                                                                                                                     │
│ - services/storage.js                                                                                                                                                        │
│ - routes/auth.js                                                                                                                                                             │
│ - routes/documents.js                                                                                                                                                        │
│ - routes/onlyoffice.js                                                                                                                                                       │
│ - routes/admin.js                                                                                                                                                            │
│ - public/login.html                                                                                                                                                          │
│ - public/index.html                                                                                                                                                          │
│ - public/admin.html                                                                                                                                                          │
│ - public/css/style.css                                                                                                                                                       │
│ - public/js/api.js                                                                                                                                                           │
│ - public/js/app.js                                                                                                                                                           │
│ - public/js/admin.js                                                                                                                                                         │
│                                                                                                                                                                              │
│ 验证计划                                                                                                                                                                     │
│                                                                                                                                                                              │
│ 1. 安装依赖：npm install                                                                                                                                                     │
│ 2. 启动 OnlyOffice Document Server，确认 http://localhost:8081 可访问。                                                                                                      │
│ 3. 启动后端：node server.js                                                                                                                                                  │
│ 4. 打开 http://localhost:<PORT>/login.html，使用默认管理员账号 admin / admin 登录。                                                                                          │
│ 5. 在管理后台创建普通用户账号，测试停用账号后无法登录。                                                                                                                      │
│ 6. 普通用户登录后修改个人密码，重新登录验证新密码。                                                                                                                          │
│ 7. 上传或新建一个 Office 文档，检查 OnlyOffice 编辑器是否正常加载。                                                                                                          │
│ 8. 编辑文档并保存，确认回调接口更新文件及数据库时间戳。                                                                                                                      │
│ 9. 切换另一用户，测试 view/edit/admin 权限是否生效。                                                                                                                         │
│ 10. 使用管理员账号进入 /admin.html，测试文档类型存储路径配置及删除文档功能。                                                                                                 │
│ 11. 检查 uploads/ 目录下文件是否按配置的文档类型子目录存储。
