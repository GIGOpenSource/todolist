# Upgrade

开源待办：UNIApp / Vue3 客户端 + FastAPI 后端。按清单时间戳与云端同步任务。本目录不含对接文档、现网密钥和证书。

## 架构

```
website / frontend / web-admin / todolist-app
                 │
                 ▼
            FastAPI (backend/)  ──▶  PostgreSQL
                 │
                 ├──▶ Redis
                 └──▶ MinIO（可选，头像）
```

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| Backend | 8000 | FastAPI |
| PostgreSQL | 5432 | 业务库 |
| Redis | 6379 | 会话 / 限流 |
| MinIO | 9000 / 9001 | 可选对象存储 |

## 环境

- Python 3.12
- Node.js 18+
- 可选 Docker 20.10+ / Compose 2.0+

## 快速开始（Docker）

```bash
cp backend/.env.example backend/.env
# 编辑 SECRET_KEY、ADMIN_PASSWORD、数据库密码

docker compose up -d --build
```

API：http://127.0.0.1:8000  
OpenAPI：http://127.0.0.1:8000/docs

部署细节见 [DEPLOY.md](DEPLOY.md)。

## 本地开发（不用 Compose 跑 API）

```bash
cp backend/.env.example backend/.env
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

`DATABASE_URL`、`REDIS_URL` 指向本机或 Compose 里的 postgres/redis。开发可用 `ALLOW_LOCAL_DB=1`。

### PC 网页

```bash
cd frontend
npm install
npm run dev
```

http://127.0.0.1:5180/h5/

### 管理端

```bash
cd web-admin
npm install
npm run dev
```

http://127.0.0.1:5181  
管理员账号见 `backend/.env` 的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`（不要使用示例值上线）。

### 移动端

HBuilderX 打开 `todolist-app/`（Vue3），或：

```bash
cd todolist-app
npm install
npm run dev:h5
```

http://127.0.0.1:5173/app/  
API 地址见 `todolist-app/utils/config.js` / `.env.production.example`。

### 官网静态页

```bash
npx --yes serve website -p 4173
```

## 目录

```
todolist/
├── backend/          # FastAPI
├── todolist-app/     # UNIApp 移动端
├── frontend/         # PC 网页
├── web-admin/        # 管理后台
├── website/          # 落地页
├── shared/           # 跨端法律文案等
├── deploy/nginx/     # 反代示例（无证书、无真实域名）
├── docker-compose.yml
├── DEPLOY.md
└── README.md
```

## 同步逻辑

本地增删改会更新 `list_updated_at`，删除记入 `deleted_ids`。每天本地 **04:00** 调用 `PUT /api/todos/sync`：按删除列表清理云端，再按条目 `updated_at` 做 LWW upsert。

## 常用 API

统一响应：`{ code, message, result }`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| PUT | `/api/todos/sync` | 待办同步 |
| POST | `/api/reports` | 周期汇报 |

完整契约以 `/docs` 为准。

## 开源边界

- 不包含 `docs/` 对接文档、现网 `.env`、TLS 证书
- Compose 不挂生产 Nginx；反代与证书自备
- 前端默认 API 指向本机，构建前请改 `.env.production`
