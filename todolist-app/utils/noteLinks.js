/**
 * 笔记深链：跨端统一 note:{id}，并兼容 /notes?id= 网页路径。
 */

const NOTE_SCHEME_RE = /note:([A-Za-z0-9_.-]+)/gi
const NOTE_PATH_RE = /\/(?:h5\/)?notes(?:\/)?\?id=([A-Za-z0-9_.-]+)/gi

/** 生成可粘贴到任务详情的笔记短链。 */
export function buildNoteLink(noteId) {
  const id = String(noteId || '').trim()
  if (!id) return ''
  return `note:${id}`
}

/** 从任意文本中解析第一个笔记 ID。 */
export function extractNoteId(text) {
  const s = String(text || '')
  const m1 = /note:([A-Za-z0-9_.-]+)/i.exec(s)
  if (m1) return m1[1]
  const m2 = /(?:\/(?:h5\/)?notes\?id=|[?&]id=)([A-Za-z0-9_.-]+)/i.exec(s)
  if (m2) return m2[1]
  return ''
}

/**
 * 将文本拆成普通片段与笔记链接片段，便于渲染可点击链接。
 * @returns {{ type: 'text'|'note', text: string, id?: string }[]}
 */
export function splitNoteLinkSegments(text) {
  const raw = String(text || '')
  if (!raw) return []

  /** @type {{ start: number, end: number, id: string, text: string }[]} */
  const hits = []
  const pushHit = (start, end, id, text) => {
    if (!id || start < 0 || end <= start) return
    // skip overlaps
    if (hits.some((h) => !(end <= h.start || start >= h.end))) return
    hits.push({ start, end, id, text })
  }

  let m
  const scheme = new RegExp(NOTE_SCHEME_RE.source, 'gi')
  while ((m = scheme.exec(raw))) {
    pushHit(m.index, m.index + m[0].length, m[1], m[0])
  }
  const path = new RegExp(NOTE_PATH_RE.source, 'gi')
  while ((m = path.exec(raw))) {
    pushHit(m.index, m.index + m[0].length, m[1], m[0])
  }

  hits.sort((a, b) => a.start - b.start)
  const segments = []
  let cursor = 0
  for (const h of hits) {
    if (h.start > cursor) {
      segments.push({ type: 'text', text: raw.slice(cursor, h.start) })
    }
    segments.push({ type: 'note', text: h.text, id: h.id })
    cursor = h.end
  }
  if (cursor < raw.length) {
    segments.push({ type: 'text', text: raw.slice(cursor) })
  }
  return segments.length ? segments : [{ type: 'text', text: raw }]
}

export function textHasNoteLink(text) {
  return splitNoteLinkSegments(text).some((s) => s.type === 'note')
}
