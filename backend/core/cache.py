"""Simple manifest-backed cache for Chronoface runs."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from PIL import Image
import imagehash

from .config import get_settings


@dataclass
class CacheEntry:
    image_hash: str
    thumb_path: str
    updated_at: str


class CacheManager:
    """Cache manifest for thumbnails and embeddings."""

    def __init__(self, run_id: str) -> None:
        settings = get_settings()
        self.run_id = run_id
        self.base_dir = settings.cache_dir / run_id
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.manifest_path = self.base_dir / "manifest.json"
        self._entries: Dict[str, CacheEntry] = {}
        self._load()

    def _load(self) -> None:
        if not self.manifest_path.exists():
            return
        data = json.loads(self.manifest_path.read_text())
        self._entries = {
            path: CacheEntry(**entry) for path, entry in data.get("entries", {}).items()
        }

    def _save(self) -> None:
        payload = {
            "run_id": self.run_id,
            "updated": datetime.utcnow().isoformat(),
            "entries": {path: entry.__dict__ for path, entry in self._entries.items()},
        }
        self.manifest_path.write_text(json.dumps(payload, indent=2))

    def compute_hash(self, image_path: Path) -> str:
        with Image.open(image_path) as img:
            hash_value = imagehash.phash(img)
        return str(hash_value)

    def get(self, image_path: Path) -> Optional[CacheEntry]:
        return self._entries.get(str(image_path))

    def update(self, image_path: Path, thumb_path: Path) -> CacheEntry:
        entry = CacheEntry(
            image_hash=self.compute_hash(image_path),
            thumb_path=str(thumb_path),
            updated_at=datetime.utcnow().isoformat(),
        )
        self._entries[str(image_path)] = entry
        self._save()
        return entry

    def needs_refresh(self, image_path: Path) -> bool:
        entry = self.get(image_path)
        if not entry:
            return True
        current_hash = self.compute_hash(image_path)
        return current_hash != entry.image_hash
