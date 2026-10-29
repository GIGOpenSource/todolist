"""Upgrade API 进程入口：创建 FastAPI 应用实例。

开发可直接 `python main.py` 或 `uvicorn main:app --reload`。
"""

from __future__ import annotations

from core.app import create_app

app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
