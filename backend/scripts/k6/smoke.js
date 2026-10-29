/**
 * k6 冒烟压测（短时，适合本地 SQLite / 预发快速归档）。
 * 全量场景见 load.js。
 *
 *   BASE_URL=http://127.0.0.1:8000 k6 run scripts/k6/smoke.js
 *   # or Docker:
 *   docker run --rm -v "$PWD/backend/scripts/k6:/scripts" -e BASE_URL=http://host.docker.internal:8000 grafana/k6:0.54.0 run /scripts/smoke.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8000'
const failRate = new Rate('failed_requests')
const healthMs = new Trend('health_duration', true)

export const options = {
  scenarios: {
    health_burst: {
      executor: 'constant-vus',
      vus: 10,
      duration: '20s',
      exec: 'steady',
    },
    auth_pulse: {
      executor: 'constant-arrival-rate',
      rate: 8,
      timeUnit: '1s',
      duration: '15s',
      preAllocatedVUs: 10,
      exec: 'authAbuse',
      startTime: '20s',
    },
  },
  thresholds: {
    failed_requests: ['rate<0.15'],
    http_req_duration: ['p(95)<1500'],
  },
}

export function steady() {
  const r = http.get(`${BASE}/api/health`)
  healthMs.add(r.timings.duration)
  const ok = check(r, {
    'health status 200': (x) => x.status === 200,
    'health db ok': (x) => {
      try {
        return x.json()?.result?.db === 'ok'
      } catch {
        return false
      }
    },
  })
  failRate.add(!ok)
  sleep(0.3)
}

export function authAbuse() {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ username: 'no_such_user_k6', password: 'wrong' }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  // Expect business failure (not 5xx)
  const ok = check(res, {
    'login rejected or limited': (x) => x.status < 500,
  })
  failRate.add(!ok)
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)']
  const fails = data.metrics.failed_requests?.values?.rate
  const summary = {
    generated_at: new Date().toISOString(),
    base_url: BASE,
    script: 'smoke.js',
    p95_ms: p95,
    failed_rate: fails,
    checks: data.root_group?.checks || [],
    thresholds: data.thresholds || {},
  }
  return {
    stdout: `\nk6 smoke summary p95=${p95?.toFixed?.(1) ?? p95}ms failRate=${fails}\n`,
    'scripts/k6/archive/smoke-latest.json': JSON.stringify(summary, null, 2),
  }
}
