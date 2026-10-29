# shared

跨端共享静态数据（无运行时依赖）。

| 文件 | 说明 |
|------|------|
| `legal-i18n.json` | 隐私政策与用户协议 20 语正文（App Store / Play 公开页与应用内同源） |

重新生成官网与前端消费文件：

```bash
node scripts/build-legal-i18n.mjs
```

产出：`website/js/legal.js`、`app/utils/legalLocales.js`。
