# 部署说明

面向自己的机器或测试环境。不含生产域名、证书和现网密钥。

## 1. 配置

```bash
cp backend/.env.example backend/.env
```

至少改：

| 变量 | 说明 |
|------|------|
| `SECRET_KEY` | JWT 签名，生产至少 32 位随机字符 |
| `ADMIN_PASSWORD` | 种子管理员密码，不要用示例值 |
| `DATABASE_URL` | 与 Compose 中的 Postgres 账号一致 |
| `REDIS_URL` | Compose 内填 `redis://redis:6379/0` |
| `CORS_ORIGINS` | 实际前端源；生产禁止 `*` |
| `OSS_*` | 可选，头像对象存储 |

根目录 Compose 可用环境变量覆盖库密码（`POSTGRES_PASSWORD` 等），不要把真实密码写进 yaml。

## 2. 启动基础设施 + API

```bash
docker compose up -d --build
curl -sS http://127.0.0.1:8000/api/health
```

只起依赖、API 跑在宿主机：

```bash
docker compose up -d postgres redis minio minio-init
cd backend
# 编辑 .env 后
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 3. 数据库迁移

```bash
cd backend
alembic upgrade head
```

镜像启动时会尝试 `alembic upgrade head`；正式发布仍建议在流水线里显式执行并检查结果。

## 4. 前端（可选）

本仓库带源码，静态产物请自行构建，不要提交 `dist/`：

```bash
# PC
cd frontend && cp .env.production.example .env.production && npm install && npm run build

# 管理端
cd web-admin && cp .env.production.example .env.production && npm install && npm run build

# 移动端 H5
cd todolist-app && cp .env.production.example .env.production && npm install && npm run build:h5
```

把构建结果交给自己的 Nginx / Caddy。反代示例见 `deploy/nginx/nginx.conf.example`。

## 5. 健康检查

```bash
docker compose ps
curl -sS http://127.0.0.1:8000/api/health
docker compose exec postgres pg_isready -U upgrade
docker compose exec redis redis-cli ping
```

## 6. 可选反向代理

Compose **不**挂生产 Nginx 或证书。需要 HTTPS 时：

1. 复制 `deploy/nginx/nginx.conf.example`，改 `server_name`
2. 自备证书
3. 把 `/api/` 指到 `127.0.0.1:8000`

## 7. 不要做的事

- 不要提交 `.env`、证书、私钥
- 不要在 `docker-compose.yml` 里写死生产密码、内网 IP、现网域名
- 不要把现网 `SECRET_KEY` 带到公开仓库
