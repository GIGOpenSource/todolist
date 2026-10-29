"""Lightweight in-process request metrics (Phase 0)."""

from __future__ import annotations

import threading
from collections import defaultdict
from typing import Dict


class Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.requests_total = 0
        self.status_counts: Dict[int, int] = defaultdict(int)
        self.path_counts: Dict[str, int] = defaultdict(int)
        self.total_elapsed_ms = 0.0

    def record(self, path: str, status: int, elapsed_ms: float) -> None:
        with self._lock:
            self.requests_total += 1
            self.status_counts[int(status)] += 1
            # normalize path a bit
            key = path.split("?")[0]
            self.path_counts[key] += 1
            self.total_elapsed_ms += float(elapsed_ms)

    def snapshot(self) -> dict:
        with self._lock:
            avg = (self.total_elapsed_ms / self.requests_total) if self.requests_total else 0.0
            return {
                "requests_total": self.requests_total,
                "avg_elapsed_ms": round(avg, 2),
                "status_counts": dict(self.status_counts),
                "top_paths": sorted(self.path_counts.items(), key=lambda x: -x[1])[:20],
            }


metrics = Metrics()
