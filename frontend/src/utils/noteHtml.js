/**
 * 笔记正文：纯文本 ↔ 编辑器 HTML，列表预览去标签。
 */

export function looksLikeHtml(s) {
  return /<\/?[a-z][\s\S]*>/i.test(String(s || ''))
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function contentToEditorHtml(raw) {
  const s = String(raw || '')
  if (!s.trim()) return ''
  if (looksLikeHtml(s)) return s
  return s
    .split(/\n/)
    .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
    .join('')
}

export function htmlToPlainPreview(html) {
  if (typeof document === 'undefined') {
    return String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const tmp = document.createElement('div')
  tmp.innerHTML = String(html || '')
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim()
}
