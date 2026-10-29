# Nginx 示例

复制 [nginx.conf.example](./nginx.conf.example)，改 `server_name` 与静态资源路径。证书请自备，不要提交到仓库。

| 路径 | 内容 |
|------|------|
| `/` | `website/` |
| `/h5/` | `frontend/dist` |
| `/admin/` | `web-admin/dist` |
| `/app/` | `todolist-app/dist/build/h5` |
| `/api/` | FastAPI `127.0.0.1:8000` |
| `/upgrade/` | MinIO bucket 反代（头像） |

头像预签名 PUT 走 `/upgrade/...`。CORS 只保留 MinIO 或只保留 Nginx 一侧，避免双边重复。
