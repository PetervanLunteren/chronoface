"""Application configuration and constants."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Runtime settings loaded from environment or defaults."""

    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8080)
    output_dir: Path = Field(default=Path("output"))
    cache_dir: Path = Field(default=Path(".chronoface_cache"))
    static_dir: Path = Field(default=Path("output/static"))
    model_dir: Path = Field(default=Path("backend/models"))
    yunet_model: str = Field(default="yunet.onnx")
    sface_model: str = Field(default="sface.onnx")
    thumb_quality: int = Field(default=90)

    class Config:
        env_prefix = "CHRONOFACE_"
        env_file = ".env"

    @property
    def yunet_path(self) -> Path:
        return self.model_dir / self.yunet_model

    @property
    def sface_path(self) -> Path:
        return self.model_dir / self.sface_model


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    settings.static_dir.mkdir(parents=True, exist_ok=True)
    settings.model_dir.mkdir(parents=True, exist_ok=True)
    return settings
