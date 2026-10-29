# 个人汇报可视化模板（Contens 周报）

来源：`~/Desktop/周报/index.html`（含 `#metrics` 关键布局）。

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 完整静态模板（Hero / 指标 / 五线 / 成果 / 节奏 / 计划 / 复盘 / 海报导出） |
| `logo.svg` | 模板默认 Logo |

## 与 App 的关系

- 周期汇报页可视化版（`pages/report/report.vue`）的 Hero + `#metrics` 指标卡样式对齐本模板。
- **「导出海报 / 保存图片」** 复用本页的高光海报逻辑，实现见 `utils/reportPoster.js`（弹层预览 → 下载 PNG）。
- 完整静态页可浏览器直接打开预览；后续可继续把业务线 / 成果等模块迁入 App。

预览：

```bash
open frontend/src/templates/personal-report/index.html
```
