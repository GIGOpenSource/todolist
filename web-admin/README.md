# Upgrade Admin

独立后台管理面板（Vue 3 + Vite）。

## 功能

- 数据统计（新增用户、日活、汇报、官网访问、任务创建/完成）
- 用户管理
- 任务列表
- 大模型 API 配置管理
- **官网配置**（品牌 / 下载链接 / 与 App 一致的 20 种语言营销文案）
- 管理员账号 CRUD
- 界面语言：简体中文 / English / 한국어

## 启动

```bash
cd web-admin
npm install
npm run dev
```

浏览器打开：http://127.0.0.1:5181  

API：`src/config.js` 中 `BASE_URL`（默认 `http://127.0.0.1:8000`）。

默认管理员：`admin` / `admin123456`（与后端 bootstrap 一致）。

## 官网配置

需具备 `site` 权限（超级管理员 `*` 默认包含）。保存后写入后端 `site_configs`；官网在配置了 `apiBaseUrl` 时通过 `GET /api/site/config` 拉取并覆盖本地文案。
