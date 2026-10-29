/**
 * 连续打卡海报：收集展示数据并生成可下载图片。
 */

import { t } from './i18n.js'
import html2canvas from 'html2canvas'
import {
  DEFAULT_LOGO,
  downloadDataUrl,
  escapeHtml,
  getLogoDataUrl,
  POSTER_WIDTH,
  POSTER_HEIGHT,
  POSTER_EXPORT_SCALE,
} from './reportPoster.js'

const STREAK_STYLE_ID = 'upgrade-streak-poster-style'

const STREAK_CSS = `
#streakPosterStage {
  position: fixed;
  left: 0;
  top: 0;
  width: ${POSTER_WIDTH}px;
  height: ${POSTER_HEIGHT}px;
  opacity: 0.01;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
#streakPosterStage *,
#streakPosterStage *::before,
#streakPosterStage *::after {
  box-sizing: border-box;
}
.streak-poster-card {
  width: ${POSTER_WIDTH}px;
  height: ${POSTER_HEIGHT}px;
  padding: 64px 56px 56px;
  color: #fff;
  font-family: "Plus Jakarta Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  background:
    radial-gradient(900px 700px at 100% 0%, rgba(56, 146, 255, 0.38), transparent 55%),
    radial-gradient(700px 520px at 0% 100%, rgba(26, 109, 255, 0.3), transparent 50%),
    linear-gradient(160deg, #071525 0%, #0d2d6b 48%, #1246a8 100%);
  position: relative;
  overflow: hidden;
}
.streak-poster-card::before {
  content: "";
  position: absolute;
  inset: 28px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 28px;
  pointer-events: none;
}
.streak-poster-card::after {
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
.streak-poster-inner {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.streak-poster-kicker {
  display: flex;
  align-items: center;
  gap: 18px;
  height: 88px;
  flex-shrink: 0;
  margin-bottom: 36px;
}
.streak-poster-logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.22);
}
.streak-poster-brand {
  font-family: "Unbounded", "PingFang SC", sans-serif;
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.streak-poster-badge {
  margin-left: auto;
  border: 1px solid rgba(255,255,255,0.28);
  border-radius: 999px;
  height: 48px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  font-size: 22px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.78);
}
.streak-poster-user {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 36px;
  padding: 0 22px;
  height: 88px;
  border-radius: 999px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.16);
  width: fit-content;
  max-width: 100%;
  flex-shrink: 0;
  overflow: hidden;
}
.streak-poster-avatar,
.streak-poster-avatar-fallback {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid rgba(255,255,255,0.35);
}
.streak-poster-avatar {
  object-fit: cover;
  background: rgba(255,255,255,0.12);
}
.streak-poster-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #1a6dff, #0d4fd6);
  font-family: "Unbounded", "PingFang SC", sans-serif;
  font-size: 26px;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.02em;
}
.streak-poster-nickname {
  font-family: "Unbounded", "PingFang SC", sans-serif;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 12em;
}
.streak-poster-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
  padding: 12px 0 24px;
}
.streak-poster-label {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #9fd0ff;
  margin-bottom: 20px;
  height: 30px;
  line-height: 30px;
  flex-shrink: 0;
}
.streak-poster-num {
  font-family: "Unbounded", "PingFang SC", sans-serif;
  font-size: 200px;
  font-weight: 600;
  line-height: 0.9;
  height: 180px;
  letter-spacing: -0.06em;
  margin: 0 0 12px;
  color: #ffffff;
  text-shadow: 0 12px 40px rgba(94, 176, 255, 0.35);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  flex-shrink: 0;
}
.streak-poster-unit {
  font-family: "Unbounded", "PingFang SC", sans-serif;
  font-size: 48px;
  font-weight: 600;
  letter-spacing: -0.02em;
  height: 56px;
  line-height: 56px;
  margin: 0 0 28px;
  color: rgba(255,255,255,0.92);
  flex-shrink: 0;
}
.streak-poster-title {
  font-family: "Unbounded", "PingFang SC", sans-serif;
  font-size: 48px;
  line-height: 1.2;
  letter-spacing: -0.03em;
  margin: 0 0 16px;
  max-width: 100%;
  height: 116px;
  font-weight: 600;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  flex-shrink: 0;
}
.streak-poster-sub {
  margin: 0;
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
.streak-poster-quote {
  margin-top: 28px;
  padding: 22px 24px;
  border-radius: 22px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(159, 208, 255, 0.28);
  font-size: 26px;
  font-weight: 600;
  line-height: 1.4;
  height: 120px;
  color: rgba(255,255,255,0.92);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  flex-shrink: 0;
}
.streak-poster-foot {
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
.streak-poster-foot-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.streak-poster-foot-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.2);
}
.streak-poster-foot span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`

function ensureStreakPosterStyles() {
  if (typeof document === 'undefined') return
  let style = document.getElementById(STREAK_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = STREAK_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = STREAK_CSS
}

function streakMessage(days) {
  const n = Math.max(0, Number(days) || 0)
  if (n >= 100) return t('stats.streakPosterMsg100')
  if (n >= 30) return t('stats.streakPosterMsg30')
  if (n >= 7) return t('stats.streakPosterMsg7')
  if (n >= 3) return t('stats.streakPosterMsg3')
  return t('stats.streakPosterMsg1')
}

function avatarLetter(name) {
  const s = String(name || '').trim()
  return s ? s.slice(0, 1).toUpperCase() : 'U'
}

/** 将用户头像读取为图片数据。 */
export async function getAvatarDataUrl(avatarSrc) {
  if (!avatarSrc) return ''
  if (String(avatarSrc).startsWith('data:')) return avatarSrc
  if (typeof document === 'undefined') return ''

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = avatarSrc

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
    return ''
  }
}

function buildUserBlock(data) {
  const nickname = data.nickname || t('report.nicknameFallback')
  const letter = escapeHtml(avatarLetter(nickname))
  const avatarHtml = data.avatarUrl
    ? `<img class="streak-poster-avatar" src="${data.avatarUrl}" alt="" width="56" height="56" />`
    : `<div class="streak-poster-avatar-fallback">${letter}</div>`
  return `
    <div class="streak-poster-user">
      ${avatarHtml}
      <div class="streak-poster-nickname">${escapeHtml(nickname)}</div>
    </div>
  `
}

/** 构建连续打卡海报数据。 */
export function buildStreakPoster(data) {
  const logoSrc = data.logoUrl || DEFAULT_LOGO
  const days = Math.max(0, Number(data.days) || 0)
  return `
    <div class="streak-poster-card" id="streakPosterCard">
      <div class="streak-poster-inner">
        <div class="streak-poster-kicker">
          <img class="streak-poster-logo" src="${logoSrc}" alt="Logo" width="72" height="72" />
          <div class="streak-poster-brand">${escapeHtml(data.brand)}</div>
          <div class="streak-poster-badge">${escapeHtml(data.badge || t('stats.streakPosterBadge'))}</div>
        </div>
        <div class="streak-poster-hero">
          ${buildUserBlock(data)}
          <div class="streak-poster-label">${escapeHtml(data.label || t('stats.streak'))}</div>
          <div class="streak-poster-num">${escapeHtml(String(days))}</div>
          <div class="streak-poster-unit">${escapeHtml(data.unit || t('stats.streakPosterUnit'))}</div>
          <h2 class="streak-poster-title">${escapeHtml(data.title)}</h2>
          <p class="streak-poster-sub">${escapeHtml(data.sub)}</p>
          <div class="streak-poster-quote">${escapeHtml(data.quote || streakMessage(days))}</div>
        </div>
        <div class="streak-poster-foot">
          <div class="streak-poster-foot-left">
            <img class="streak-poster-foot-logo" src="${logoSrc}" alt="" width="40" height="40" />
            <span>${escapeHtml(data.footLeft || t('stats.streakPosterFoot'))}</span>
          </div>
          <span>${escapeHtml(data.shareHint || t('stats.streakPosterShareHint'))}</span>
        </div>
      </div>
    </div>
  `
}

/** 收集连续打卡海报数据。 */
export function collectStreakPosterData({ days, brand, nickname, avatar } = {}) {
  const n = Math.max(0, Number(days) || 0)
  return {
    brand: brand || t('report.brand'),
    days: n,
    nickname: (nickname || '').trim() || t('report.nicknameFallback'),
    avatar: avatar || '',
    badge: t('stats.streakPosterBadge'),
    label: t('stats.streak'),
    unit: t('stats.streakPosterUnit'),
    title: t('stats.streakPosterTitle', { n }),
    sub: t('stats.streakPosterSub'),
    quote: streakMessage(n),
    footLeft: t('stats.streakPosterFoot'),
    shareHint: t('stats.streakPosterShareHint'),
  }
}

/** 渲染连续打卡海报图片。 */
export async function renderStreakPoster(data, { logoSrc } = {}) {
  if (typeof document === 'undefined') {
    throw new Error(t('report.posterErrorH5'))
  }

  ensureStreakPosterStyles()

  let stage = document.getElementById('streakPosterStage')
  if (!stage) {
    stage = document.createElement('div')
    stage.id = 'streakPosterStage'
    stage.setAttribute('aria-hidden', 'true')
    document.body.appendChild(stage)
  }

  const paint = typeof html2canvas === 'function' ? html2canvas : html2canvas?.default
  if (typeof paint !== 'function') {
    throw new Error(t('report.posterErrorEngine'))
  }

  const payload = { ...data }
  payload.logoUrl = await getLogoDataUrl(logoSrc)
  payload.avatarUrl = await getAvatarDataUrl(data.avatar)
  stage.innerHTML = buildStreakPoster(payload)
  const card = document.getElementById('streakPosterCard')
  if (!card) throw new Error(t('report.posterErrorRender'))

  const imageNodes = [
    ...card.querySelectorAll(
      'img.streak-poster-logo, img.streak-poster-foot-logo, img.streak-poster-avatar'
    ),
  ]
  await Promise.all(
    imageNodes.map(
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
    const canvas = await paint(card, {
      scale: POSTER_EXPORT_SCALE,
      backgroundColor: '#071525',
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

export { downloadDataUrl }
