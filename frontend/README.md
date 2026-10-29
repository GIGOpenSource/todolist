# Upgrade PC Web（frontend）

独立桌面网页客户端（Vue 3 + Vite），对接同一 FastAPI 后端。本地存储使用 `upgrade_pc_*` 前缀，与移动端 `todolist_*` 隔离。

## 启动

```bash
# 后端（仓库根目录）
cd backend && source .venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# PC 端
cd frontend
npm install
npm run dev
```

浏览器打开：http://127.0.0.1:5180/h5/

API 地址：编辑 [`src/config.js`](src/config.js) 的 `BASE_URL`。

## 功能

- 登录 / 注册 / 账号恢复
- 任务增删改、筛选、详情侧栏
- 日历、统计、周期汇报（含海报导出）
- 个人资料、主题、语言；待办直接走接口（进入拉取、变更即时提交）
- 侧栏 / 登录页「下载 App」入口：悬停展示 Google Play、App Store 二维码（链接在 `src/config.js` 的 `APP_DOWNLOADS`）
