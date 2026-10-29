# k6 压测归档

## 运行

```bash
cd backend
k6 run scripts/k6/load.js
BASE_URL=http://127.0.0.1:8000 k6 run scripts/k6/load.js
```

导出结果：

```bash
mkdir -p scripts/k6/archive
k6 run --out json=scripts/k6/archive/results-$(date +%Y%m%d-%H%M).json scripts/k6/load.js
```

短时冒烟（约 35s）：

```bash
k6 run scripts/k6/smoke.js
# Docker（本机无 k6 时）
docker run --rm -v "$PWD/scripts/k6:/scripts" \
  -e BASE_URL=http://host.docker.internal:8000 \
  grafana/k6:0.54.0 run /scripts/smoke.js
```

结果可自行导出到 `scripts/k6/archive/`（该目录不进仓库）。

## 场景

| Scenario | 目的 |
|----------|------|
| steady / health_burst | health 基线 |
| sync_storm | 同步热路径吞吐（仅 load.js） |
| auth_abuse / auth_pulse | 登录失败 / 限流 |

## 建议门槛（本地 Postgres + 2–4 workers）

- `http_req_duration` p95 < 800ms（steady / sync）
- `failed_requests` < 5%
- auth_abuse 下应出现业务失败或 429，不应 5xx 雪崩
