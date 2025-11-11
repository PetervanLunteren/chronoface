from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import routes_collage, routes_faces, routes_health, routes_scan
from .core.config import get_settings
from .core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title="Chronoface", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_health.router)
app.include_router(routes_scan.router)
app.include_router(routes_faces.router)
app.include_router(routes_collage.router)

app.mount("/api/static", StaticFiles(directory=settings.static_dir), name="static")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Chronoface backend running"}
