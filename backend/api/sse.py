"""Server sent events helpers."""
from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator, Dict


class EventChannel:
    """Async queue for background pipeline events."""

    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        self.queue: asyncio.Queue[Dict[str, object]] = asyncio.Queue()
        self.closed = False

    def publish(self, event: str, data: object) -> None:
        if self.closed:
            return
        payload = {"event": event, "data": data}
        self.loop.call_soon_threadsafe(self.queue.put_nowait, payload)

    async def stream(self) -> AsyncGenerator[bytes, None]:
        try:
            while True:
                payload = await self.queue.get()
                event = payload.get("event", "message")
                data = payload.get("data")
                body = f"event: {event}\ndata: {json.dumps(data)}\n\n"
                yield body.encode("utf-8")
                if event == "done" or event == "error":
                    break
        finally:
            self.closed = True

    def close(self) -> None:
        self.closed = True
        self.loop.call_soon_threadsafe(
            self.queue.put_nowait, {"event": "done", "data": {}}
        )
