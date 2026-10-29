# Upgrade 官网

独立静态落地页：品牌首屏、**H5 网页登录入口**（登录后回跳展示账号 / 退出 / 进入项目）、四端下载（Android 手机 / Android Pad / iPhone / iPad）、公开隐私政策与用户协议。

## 本地预览

在仓库根目录执行：

```bash
npx --yes serve website -p 4173
```

浏览器打开：http://127.0.0.1:4173

也可用任意静态服务器指向 `website/` 目录。

## 配置

编辑 [`js/config.js`](js/config.js)：

| 字段 | 说明 |
|------|------|
| `apiBaseUrl` | 后端地址；用于访问埋点与拉取 `/api/site/config` 官网 CMS 配置 |
| `contactEmail` | 页脚联系邮箱（可被后台配置覆盖） |
| `loginUrl` | H5 网页登录地址（可被后台配置覆盖） |
| `appUrl` | 登录后「进入项目」地址（默认同源 `/h5/`） |
| `downloads.*.url` | 各端安装包或商店链接（可被后台配置覆盖） |
| `downloads.*.ready` | `true` 才可点击下载；`false` 显示「即将上线」 |

后台「官网配置」页可改品牌、下载链接与落地页文案；官网启动时会请求 `GET {apiBaseUrl}/api/site/config` 并覆盖本地默认值。


上线示例：

```js
downloads: {
  androidPhone: { id: 'androidPhone', url: 'https://cdn.example.com/upgrade-phone.apk', ready: true },
  androidPad:   { id: 'androidPad', url: 'https://cdn.example.com/upgrade-pad.apk', ready: true },
  iosPhone:     { id: 'iosPhone', url: 'https://apps.apple.com/app/idXXXXXXXX', ready: true },
  iosPad:       { id: 'iosPad', url: 'https://apps.apple.com/app/idXXXXXXXX', ready: true },
}
```

手机与 Pad 可暂时共用同一链接，配置项分开便于以后拆包。

## 商店公开 URL

部署本站后，可将以下地址填入 App Store Connect / Google Play：

- 隐私政策：`https://你的域名/privacy.html`（20 语，与应用内同源，页内可切换语言）
- 用户协议：`https://你的域名/terms.html`（同上）
- 法律正文数据：`js/legal.js`（由 `scripts/build-legal-i18n.mjs` 从 `shared/legal-i18n.json` 生成）

并在应用内 [`app/utils/config.js`](../app/utils/config.js) 设置 `LEGAL_PUBLIC_BASE_URL`。

## 语言与主题

- 语言下拉覆盖产品全部 **20** 种语言（与 App 内 `LOCALES` 一致），缺省文案回退英文。
- 后台 CMS 可覆盖各语言的营销字段（`hook` / `slogan` / `features` 等）；导航、主题等 chrome 文案仍以本地 [`js/i18n.js`](js/i18n.js) 为准。
- 顶栏可切换浅色 / 夜间模式；默认跟随系统，选择会写入 `localStorage`。

## 产品截图

`assets/shots/` 下为界面示意（任务 / 日历 / 统计）。上线后可换成真实机型截图，并在 `js/config.js` 的 `shots` 数组更新路径。
