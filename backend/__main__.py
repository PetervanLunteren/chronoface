from __future__ import annotations

from pathlib import Path

import typer
import uvicorn

from .core.config import get_settings
from .core.pipeline import run_manager
from .core.types import CollageRequest, ScanRequest

cli = typer.Typer(help="Chronoface command line interface")


@cli.command()
def serve(host: str = typer.Option(None), port: int = typer.Option(None)) -> None:
    """Run the FastAPI server."""

    settings = get_settings()
    bind_host = host or settings.host
    bind_port = port or settings.port
    uvicorn.run("backend.app:app", host=bind_host, port=bind_port, reload=False)


@cli.command()
def scan(
    folder: Path = typer.Argument(..., exists=True, resolve_path=True, readable=True),
    bucket: str = typer.Option("month", help="Bucket granularity"),
    max_edge: int = typer.Option(1600),
    min_face_px: int = typer.Option(48),
    thumb_edge: int = typer.Option(256),
    downscale_detector: bool = typer.Option(True, help="Downscale before detection"),
) -> None:
    """Process a folder and emit collages without running the API."""

    request = ScanRequest(
        folder=str(folder),
        bucket=bucket,  # type: ignore[arg-type]
        max_edge=max_edge,
        min_face_px=min_face_px,
        thumb_edge=thumb_edge,
        downscale_detector=downscale_detector,
    )
    context = run_manager.run_once(request)
    typer.echo(f"Run {context.run_id} completed with phase {context.phase}")
    for summary in run_manager.list_buckets(context.run_id):
        coll_req = CollageRequest(
            run_id=context.run_id,
            bucket=summary["key"],
            tile_size=160,
            columns=12,
            padding=4,
            margin=32,
            background="white",
            sort="by_time",
            max_faces=300,
            face_selection="accepted_and_unreviewed",
        )
        try:
            result = run_manager.create_collage(coll_req)
        except ValueError:
            continue
        typer.echo(
            f"Collage for {summary['label']}: {result['output_path']} ({result['width']}x{result['height']})"
        )


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
