/**
 * k6 压测脚本：health / sync / auth 场景。
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8000'
const failRate = new Rate('failed_requests')

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-vus',
      vus: 20,
      duration: '1m',
      exec: 'steady',
    },
    sync_storm: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 40,
      maxVUs: 80,
      exec: 'syncStorm',
      startTime: '1m',
    },
    auth_abuse: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 20,
      exec: 'authAbuse',
      startTime: '2m10s',
    },
  },
  thresholds: {
    failed_requests: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
}

function login(vu) {
  const user = `k6user_${vu}`
  const pass = 'k6pass123'
  http.post(`${BASE}/api/auth/register`, JSON.stringify({ username: user, password: pass }), {
    headers: { 'Content-Type': 'application/json' },
  })
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ username: user, password: pass }), {
    headers: { 'Content-Type': 'application/json' },
  })
  const body = res.json()
  return body?.result?.access_token || ''
}

export function steady() {
  const r = http.get(`${BASE}/api/health`)
  const ok = check(r, { 'health 200': (x) => x.status === 200 })
  failRate.add(!ok)
  sleep(0.5)
}

export function syncStorm() {
  const token = login(__VU)
  if (!token) {
    failRate.add(1)
    return
  }
  const todos = []
  for (let i = 0; i < 20; i++) {
    const id = `t_${__VU}_${i}`
    const now = Date.now()
    todos.push({
      id,
      title: `task ${i}`,
      detail: '',
      due_at: 0,
      completed: false,
      created_at: now,
      updated_at: now,
    })
  }
  const res = http.put(
    `${BASE}/api/todos/sync`,
    JSON.stringify({ todos, list_updated_at: Date.now(), deleted_ids: [], sync_weeks: 1 }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  )
  const ok = check(res, {
    'sync code 200': (x) => x.status === 200 && x.json()?.code === 200,
  })
  failRate.add(!ok)
  sleep(0.2)
}

export function authAbuse() {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ username: 'nosuch', password: 'bad' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  // Expect business fail or 429 under pressure
  const ok = check(res, {
    'auth responded': (x) => x.status === 200 || x.status === 429,
  })
  failRate.add(!ok)
}
