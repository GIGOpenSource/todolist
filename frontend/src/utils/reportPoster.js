/**
 * 周报海报工具：生成并下载报告海报。
 */

import { t } from '../i18n/index.js'

export const DEFAULT_LOGO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none"><rect width="80" height="80" rx="20" fill="#007AFF"/><path d="M22 52V28h12.2c7.4 0 12.1 4.1 12.1 10.4 0 6.4-4.7 10.5-12.1 10.5H28.6V52H22zm6.6-9.3h5c3.7 0 5.9-1.9 5.9-5.1S37.3 32.5 33.6 32.5h-5v10.2z" fill="#fff"/><circle cx="58" cy="50" r="7" fill="#5AC8FA"/></svg>`
  )

const CHEER_KEYS = [
  'report.cheer1',
  'report.cheer2',
  'report.cheer3',
  'report.cheer4',
  'report.cheer5',
  'report.cheer6',
  'report.cheer7',
  'report.cheer8',
]

const POSTER_STYLE_ID = 'upgrade-report-poster-style'

/** 海报画布规范：设计稿 1080×1620（2:3），导出固定 scale=2 → 2160×3240。 */
export const POSTER_WIDTH = 1080
export const POSTER_HEIGHT = 1620
export const POSTER_EXPORT_SCALE = 2

const POSTER_CSS = `
#posterStage {
  position: fixed;
  left: -10000px;
  top: 0;
  width: ${POSTER_WIDTH}px;
  height: ${POSTER_HEIGHT}px;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
#posterStage *,
#posterStage *::before,
#posterStage *::after {
  box-sizing: border-box;
}
.poster-card {
  width: ${POSTER_WIDTH}px;
  height: ${POSTER_HEIGHT}px;
  padding: 64px 56px 56px;
  color: #fff;
  font-family: "Manrope", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  background:
    radial-gradient(900px 700px at 100% 0%, rgba(90, 200, 250, 0.28), transparent 55%),
    radial-gradient(700px 500px at 0% 100%, rgba(0, 122, 255, 0.32), transparent 50%),
    linear-gradient(160deg, #001a3d 0%, #003d82 48%, #007aff 100%);
  position: relative;
  overflow: hidden;
}
.poster-card::before {
  content: "";
  position: absolute;
  inset: 28px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 28px;
  pointer-events: none;
}
.poster-card::after {
  content: "";
  position: absolute;
  width: 420px;
  height: 420px;
  right: -80px;
  top: 180px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.12);
  background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.14), transparent 60%);
}
.poster-inner {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.poster-kicker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  height: 88px;
  flex-shrink: 0;
  font-size: 24px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.72);
  margin-bottom: 28px;
}
.poster-brand-wrap {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
  flex: 1;
}
.poster-logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.22);
}
.poster-brand {
  font-family: "Manrope", "PingFang SC", sans-serif;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: #fff;
  text-transform: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poster-foot-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.2);
}
.poster-foot-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.poster-week {
  border: 1px solid rgba(255,255,255,0.28);
  border-radius: 999px;
  height: 48px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  font-size: 22px;
  white-space: nowrap;
  flex-shrink: 0;
  background: rgba(255,255,255,0.08);
}
.poster-title {
  font-family: "Manrope", "PingFang SC", sans-serif;
  font-size: 56px;
  line-height: 1.2;
  letter-spacing: -0.04em;
  margin: 0 0 16px;
  max-width: 100%;
  height: 134px;
  font-weight: 800;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  flex-shrink: 0;
}
.poster-sub {
  margin: 0 0 28px;
  font-size: 26px;
  line-height: 1.45;
  height: 76px;
  color: rgba(255,255,255,0.78);
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  flex-shrink: 0;
}
.poster-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
  flex-shrink: 0;
}
.poster-metric {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 22px;
  padding: 22px 18px;
  height: 168px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.poster-metric.hero-metric {
  background: linear-gradient(145deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08));
}
.poster-metric .plabel {
  font-size: 20px;
  line-height: 1.2;
  height: 24px;
  color: rgba(255,255,255,0.7);
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}
.poster-metric .pvalue {
  font-family: "Manrope", sans-serif;
  font-size: 52px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  height: 52px;
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}
.poster-metric .pdelta {
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
  color: #9fd0ff;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  flex: 1;
  min-height: 0;
}
.poster-block {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 24px;
  padding: 22px 24px;
  margin-bottom: 16px;
  flex-shrink: 0;
  overflow: hidden;
}
.poster-block h4 {
  margin: 0 0 14px;
  font-size: 20px;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9fd0ff;
  font-weight: 700;
}
.poster-wins { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.poster-wins li {
  display: grid;
  grid-template-columns: 12px 1fr;
  gap: 14px;
  align-items: start;
  font-size: 26px;
  line-height: 1.35;
  font-weight: 600;
  min-height: 36px;
  max-height: 70px;
  overflow: hidden;
}
.poster-wins li::before {
  content: "";
  width: 10px;
  height: 10px;
  margin-top: 10px;
  border-radius: 50%;
  background: #5ac8fa;
}
.poster-tracks { display: grid; gap: 14px; }
.poster-track {
  display: grid;
  grid-template-columns: 160px 1fr 72px;
  gap: 14px;
  align-items: center;
  height: 36px;
  font-size: 24px;
}
.poster-track .name {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poster-track .bar {
  height: 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  overflow: hidden;
}
.poster-track .bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #0056d6, #5ac8fa);
  border-radius: inherit;
}
.poster-track .pct {
  font-family: "Manrope", sans-serif;
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.poster-quote {
  font-family: "Manrope", "PingFang SC", sans-serif;
  font-size: 28px;
  line-height: 1.4;
  letter-spacing: -0.02em;
  font-weight: 700;
  margin: 0;
  max-height: 118px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
.poster-cheer {
  margin-top: 8px;
  padding: 20px 24px;
  border-radius: 22px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(159, 208, 255, 0.28);
  flex-shrink: 0;
  height: 120px;
  overflow: hidden;
}
.poster-cheer .cheer-label {
  display: block;
  margin-bottom: 8px;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9fd0ff;
}
.poster-cheer p {
  margin: 0;
  font-family: "Manrope", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.4;
  color: rgba(255,255,255,0.92);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
.poster-foot {
  margin-top: auto;
  height: 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255,255,255,0.55);
  font-size: 20px;
  flex-shrink: 0;
  padding-top: 16px;
}
.poster-foot span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`

/** 确保海报渲染样式已注入。 */
export function ensurePosterStyles() {
  if (typeof document === 'undefined') return
  let style = document.getElementById(POSTER_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = POSTER_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = POSTER_CSS
}

/** 转义海报中的网页文本。 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 随机选择鼓励文案。 */
export function randomCheer() {
  const key = CHEER_KEYS[Math.floor(Math.random() * CHEER_KEYS.length)]
  return t(key)
}

/** 将品牌标识读取为图片数据。 */
export async function getLogoDataUrl(logoSrc) {
  if (!logoSrc) return DEFAULT_LOGO
  if (String(logoSrc).startsWith('data:')) return logoSrc
  if (typeof document === 'undefined') return DEFAULT_LOGO

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = logoSrc

  try {
    await new Promise((resolve, reject) => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', reject, { once: true })
    })
    if (img.decode) await img.decode().catch(() => {})

    const canvas = document.createElement('canvas')
    const size = Math.max(img.naturalWidth || 160, img.naturalHeight || 160, 160)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    return canvas.toDataURL('image/png')
  } catch {
    return DEFAULT_LOGO
  }
}

/** 构建报告海报内容。 */
export function buildPoster(data) {
  const logoSrc = data.logoUrl || DEFAULT_LOGO
  const cheer = data.cheer || randomCheer()
  const ui = {
    wins: data.ui?.wins || t('report.posterWins'),
    tracks: data.ui?.tracks || t('report.posterTracks'),
    quote: data.ui?.quote || t('report.posterQuote'),
    cheerLabel: data.ui?.cheerLabel || t('report.posterCheerLabel'),
    shareHint: data.ui?.shareHint || t('report.posterShareHint'),
  }
  const metricsHtml = (data.topMetrics || [])
    .map(
      (m, i) => `
            <div class="poster-metric ${i === 0 ? 'hero-metric' : ''}">
              <div class="plabel">${escapeHtml(m.label)}</div>
              <div class="pvalue">${escapeHtml(m.value)}</div>
              <div class="pdelta">${escapeHtml(m.delta || '')}</div>
            </div>
          `
    )
    .join('')

  const winsHtml = (data.wins || []).map((w) => `<li>${escapeHtml(w)}</li>`).join('')
  const tracksHtml = (data.tracks || [])
    .map(
      (tr) => `
            <div class="poster-track">
              <div class="name">${escapeHtml(tr.name)}</div>
              <div class="bar"><i style="width:${tr.pct}%"></i></div>
              <div class="pct">${tr.pct}%</div>
            </div>
          `
    )
    .join('')

  return `
          <div class="poster-card" id="posterCard">
            <div class="poster-inner">
              <div class="poster-kicker">
                <div class="poster-brand-wrap">
                  <img class="poster-logo" src="${logoSrc}" alt="Logo" width="72" height="72" />
                  <div class="poster-brand">${escapeHtml(data.brand)}</div>
                </div>
                <div class="poster-week">${escapeHtml(data.week)}</div>
              </div>
              <h2 class="poster-title">${escapeHtml(data.title)}</h2>
              <p class="poster-sub">${escapeHtml(data.sub)}</p>
              <div class="poster-metrics">${metricsHtml}</div>
              <div class="poster-block">
                <h4>${escapeHtml(ui.wins)}</h4>
                <ul class="poster-wins">${winsHtml}</ul>
              </div>
              <div class="poster-block">
                <h4>${escapeHtml(ui.tracks)}</h4>
                <div class="poster-tracks">${tracksHtml}</div>
              </div>
              <div class="poster-block">
                <h4>${escapeHtml(ui.quote)}</h4>
                <p class="poster-quote">${escapeHtml(data.quote)}</p>
              </div>
              <div class="poster-cheer">
                <span class="cheer-label">${escapeHtml(ui.cheerLabel)}</span>
                <p>${escapeHtml(cheer)}</p>
              </div>
              <div class="poster-foot">
                <div class="poster-foot-left">
                  <img class="poster-foot-logo" src="${logoSrc}" alt="" width="40" height="40" />
                  <span>HIGHLIGHT POSTER</span>
                </div>
                <span>${escapeHtml(ui.shareHint)}</span>
              </div>
            </div>
          </div>
        `
}

/** 收集报告亮点数据。 */
export function collectReportHighlights({
  brand,
  week,
  title,
  sub,
  quote,
  rate,
  taskCount,
  completedCount,
  pendingCount,
  streakDays,
  html,
  todos = [],
  wins: winsOverride,
  tracks: tracksOverride,
  labels = {},
}) {
  const L = {
    rate: labels.rate || t('stats.rate'),
    all: labels.all || t('stats.all'),
    done: labels.done || t('stats.done'),
    pending: labels.pending || t('stats.pending'),
    doneOf:
      labels.doneOf ||
      t('report.metricDoneOf', { done: completedCount, total: taskCount }),
    streak: labels.streak || t('report.streakLabel', { n: streakDays }),
    pendingHint:
      labels.pendingHint ||
      (pendingCount > 0 ? t('report.metricPendingHint') : t('report.metricAllClear')),
    completion: labels.completion || t('report.trackCompletion'),
    delivery: labels.delivery || t('report.trackDelivery'),
    ...labels,
  }

  const metrics = [
    {
      label: L.rate,
      value: `${rate}%`,
      delta: L.doneOf,
      score: rate + 30,
    },
    {
      label: L.all,
      value: String(taskCount),
      delta: L.streak,
      score: taskCount,
    },
    {
      label: L.done,
      value: String(completedCount),
      delta: L.streak,
      score: completedCount + 10,
    },
    {
      label: L.pending,
      value: String(pendingCount),
      delta: L.pendingHint,
      score: pendingCount,
    },
  ]
  metrics.sort((a, b) => b.score - a.score)
  const topMetrics = metrics.slice(0, 3)

  let wins = Array.isArray(winsOverride) && winsOverride.length
    ? winsOverride.map((w) => (typeof w === 'string' ? w : w.title)).filter(Boolean)
    : extractWinsFromHtml(html)
  if (!wins.length) {
    wins = (todos || [])
      .filter((t) => t.completed)
      .map((t) => String(t.title || '').trim())
      .filter(Boolean)
      .slice(0, 3)
  }
  if (!wins.length && taskCount > 0) {
    wins = [
      t('report.posterFallbackWin', { n: taskCount }),
      t('report.posterFallbackRate', { rate }),
      L.streak,
    ]
  }

  let tracks =
    Array.isArray(tracksOverride) && tracksOverride.length
      ? tracksOverride.map((t) => ({ name: t.name, pct: Number(t.pct) || 0 }))
      : [
          { name: L.completion, pct: Math.max(0, Math.min(100, rate)) },
          {
            name: L.delivery,
            pct: taskCount
              ? Math.max(0, Math.min(100, Math.round((completedCount / taskCount) * 100)))
              : 0,
          },
        ]
  tracks = tracks.sort((a, b) => b.pct - a.pct).slice(0, 2)

  let quoteText = (quote || '').trim() || extractQuoteFromHtml(html)
  if (!quoteText) {
    quoteText = rate >= 80 ? t('report.posterQuoteHigh') : t('report.posterQuoteLow')
  }

  return {
    brand: brand || 'Upgrade',
    week: week || '',
    title: title || t('report.posterDefaultTitle'),
    sub: sub || '',
    quote: quoteText,
    topMetrics,
    wins: wins.slice(0, 3),
    tracks,
    ui: {
      wins: t('report.posterWins'),
      tracks: t('report.posterTracks'),
      quote: t('report.posterQuote'),
      cheerLabel: t('report.posterCheerLabel'),
      shareHint: t('report.posterShareHint'),
    },
  }
}

function extractWinsFromHtml(html) {
  const raw = String(html || '')
  if (!raw) return []
  const strongs = [...raw.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi)].map((m) =>
    stripTags(m[1]).trim()
  )
  if (strongs.length) return strongs.filter(Boolean).slice(0, 3)

  const lis = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1]).trim())
  return lis.filter(Boolean).slice(0, 3)
}

function extractQuoteFromHtml(html) {
  const raw = String(html || '')
  const p = raw.match(/<p[^>]*class=['"][^'"]*footnote[^'"]*['"][^>]*>([\s\S]*?)<\/p>/i)
  if (p) return stripTags(p[1]).trim()
  const paragraphs = [...raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]).trim())
  const long = paragraphs.find((p) => p.length > 20)
  return long || ''
}

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

/** 渲染报告亮点海报。 */
export async function renderHighlightPoster(data, { logoSrc } = {}) {
  if (typeof document === 'undefined') {
    throw new Error(t('report.posterErrorH5'))
  }

  ensurePosterStyles()

  let stage = document.getElementById('posterStage')
  if (!stage) {
    stage = document.createElement('div')
    stage.id = 'posterStage'
    stage.setAttribute('aria-hidden', 'true')
    document.body.appendChild(stage)
  }

  const html2canvas = (await import('html2canvas')).default
  if (typeof html2canvas !== 'function') {
    throw new Error(t('report.posterErrorEngine'))
  }

  if (!data.topMetrics?.length || !data.wins?.length) {
    throw new Error(t('report.posterErrorEmpty'))
  }

  const payload = { ...data }
  payload.logoUrl = await getLogoDataUrl(logoSrc)
  payload.cheer = data.cheer || randomCheer()
  stage.innerHTML = buildPoster(payload)
  const card = document.getElementById('posterCard')
  if (!card) throw new Error(t('report.posterErrorRender'))

  const logoNodes = [...card.querySelectorAll('img.poster-logo, img.poster-foot-logo')]
  await Promise.all(
    logoNodes.map(
      (node) =>
        node.decode?.().catch(() => {}) ||
        new Promise((resolve) => {
          if (node.complete) resolve()
          else node.onload = resolve
        })
    )
  )

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  try {
    const canvas = await html2canvas(card, {
      scale: POSTER_EXPORT_SCALE,
      backgroundColor: '#001a3d',
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      windowWidth: POSTER_WIDTH,
      windowHeight: POSTER_HEIGHT,
    })
    return canvas.toDataURL('image/png')
  } finally {
    stage.innerHTML = ''
  }
}

/** 下载图片数据。 */
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename || `${t('report.posterFilename')}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
