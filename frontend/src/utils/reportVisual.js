/**
 * 周报可视化工具：整理周期数据与展示区块。
 */

import { intlLocale, t } from '../i18n/index.js'

function dayStart(ts) {
  const d = new Date(Number(ts) || 0)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function inRange(ts, start, end) {
  if (!ts) return false
  const n = Number(ts)
  return n >= start && n <= end
}

function weekdayLabel(ts) {
  try {
    return new Intl.DateTimeFormat(intlLocale(), { weekday: 'short' }).format(new Date(ts))
  } catch {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ts).getDay()]
  }
}

function shortDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
}

function strip(s) {
  return String(s || '').trim()
}

/** 筛选统计周期内的待办。 */
export function filterPeriodTodos(todos, startAt, endAt) {
  const start = Number(startAt)
  const end = Number(endAt)
  return (todos || []).filter(
    (item) =>
      inRange(item.created_at, start, end) ||
      inRange(item.updated_at, start, end) ||
      inRange(item.due_at, start, end) ||
      (item.completed && inRange(item.updated_at, start, end))
  )
}

/** 构建报告可视化区块。 */
export function buildVisualSections(periodTodos, { startAt, endAt, rate, streakDays } = {}) {
  const list = [...(periodTodos || [])]
  const now = Date.now()
  const completed = list.filter((item) => item.completed)
  const pending = list.filter((item) => !item.completed)
  const overdue = pending.filter((item) => item.due_at && Number(item.due_at) < dayStart(now))

  const wins = completed
    .slice()
    .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))
    .slice(0, 5)
    .map((item) => ({
      title: strip(item.title) || t('report.visualUntitled'),
      detail: strip(item.detail) || t('report.visualDone'),
    }))

  const risks = []
  for (const item of overdue.slice(0, 4)) {
    risks.push({
      title: strip(item.title),
      detail: t('report.visualOverdueDue', { date: shortDate(item.due_at) }),
      level: 'warn',
    })
  }
  for (const item of pending
    .filter((x) => !overdue.includes(x))
    .slice(0, Math.max(0, 4 - risks.length))) {
    risks.push({
      title: strip(item.title),
      detail:
        strip(item.detail) ||
        (item.due_at
          ? t('report.visualDue', { date: shortDate(item.due_at) })
          : t('report.visualInProgress')),
      level: 'muted',
    })
  }

  const total = list.length || 1
  const donePct = Math.round((completed.length / total) * 100)
  const onTimePending = pending.filter((item) => !item.due_at || Number(item.due_at) >= dayStart(now))
  const dueCoverage = list.filter((item) => item.due_at).length
  const duePct = Math.round((dueCoverage / total) * 100)
  const activeDays = new Set()
  for (const item of list) {
    if (item.created_at) activeDays.add(dayStart(item.created_at))
    if (item.completed && item.updated_at) activeDays.add(dayStart(item.updated_at))
  }
  const spanDays = Math.max(1, Math.round((Number(endAt) - Number(startAt)) / 86400000) + 1)
  const cadencePct = Math.min(100, Math.round((activeDays.size / spanDays) * 100))

  const tracks = [
    {
      name: t('report.visualTrackDone'),
      desc: t('report.visualTrackDoneDesc', { done: completed.length, total: list.length }),
      pct: donePct,
    },
    {
      name: t('report.visualTrackOpen'),
      desc: t('report.visualTrackOpenDesc', {
        open: onTimePending.length,
        overdue: overdue.length,
      }),
      pct: Math.max(8, 100 - Math.round((overdue.length / total) * 100)),
    },
    {
      name: t('report.visualTrackCadence'),
      desc: t('report.visualTrackCadenceDesc', {
        active: activeDays.size,
        days: spanDays,
      }),
      pct: Math.max(10, cadencePct),
    },
    {
      name: t('report.visualTrackPlan'),
      desc: t('report.visualTrackPlanDesc', { n: dueCoverage }),
      pct: Math.max(10, duePct),
    },
  ]

  const byDay = new Map()
  for (const item of list) {
    const keyTs = item.completed
      ? dayStart(item.updated_at || item.created_at)
      : dayStart(item.created_at || item.updated_at)
    if (!keyTs) continue
    if (!byDay.has(keyTs)) byDay.set(keyTs, { done: [], open: [] })
    const bucket = byDay.get(keyTs)
    if (item.completed) bucket.done.push(item)
    else bucket.open.push(item)
  }
  const timeline = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-4)
    .map(([ts, bag]) => {
      const top = bag.done[0] || bag.open[0]
      const nDone = bag.done.length
      const nOpen = bag.open.length
      return {
        day: `${weekdayLabel(ts)} · ${shortDate(ts)}`,
        title: strip(top?.title) || t('report.visualDailyProgress'),
        detail: t('report.visualDayDetail', { done: nDone, open: nOpen }),
      }
    })

  const planSource = pending
    .slice()
    .sort((a, b) => {
      const ad = Number(a.due_at) || Number.MAX_SAFE_INTEGER
      const bd = Number(b.due_at) || Number.MAX_SAFE_INTEGER
      return ad - bd
    })
    .slice(0, 4)

  const plans = planSource.map((item, i) => {
    const isOver = item.due_at && Number(item.due_at) < dayStart(now)
    const prio = i === 0 || isOver ? 'P0' : i === 1 ? 'P1' : i === 2 ? 'P1' : 'P2'
    const prioClass = prio === 'P0' ? '' : prio === 'P2' ? 'p3' : 'p2'
    return {
      prio,
      prioClass,
      title: strip(item.title),
      detail:
        strip(item.detail) ||
        (item.due_at
          ? t('report.visualPlanDue', { date: shortDate(item.due_at) })
          : t('report.visualPlanNext')),
    }
  })

  const r = Number(rate) || 0
  let quote
  if (r >= 85) quote = t('report.visualQuoteHigh')
  else if (r >= 60) quote = t('report.visualQuoteMid')
  else quote = t('report.visualQuoteLow')

  let quoteFooter
  if (overdue.length > 0) {
    quoteFooter = t('report.visualQuoteFooterOverdue', { n: overdue.length })
  } else if (streakDays) {
    quoteFooter = t('report.visualQuoteFooterStreak', { n: streakDays })
  } else {
    quoteFooter = t('report.visualQuoteFooterDue')
  }

  return {
    completed,
    pending,
    overdue,
    wins,
    risks,
    tracks,
    timeline,
    plans,
    quote,
    quoteFooter,
  }
}
