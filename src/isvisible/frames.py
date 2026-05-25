"""Frame protocol helpers for tactile display prototypes."""

from __future__ import annotations

from collections.abc import Iterable

from .braille import BrailleCell


def build_frames(
    cells: Iterable[BrailleCell],
    *,
    group_size: int = 1,
    mode: str = "text",
) -> list[dict[str, object]]:
    """Group braille cells into serializable tactile frames."""

    if group_size < 1:
        raise ValueError("group_size must be at least 1")

    cell_list = list(cells)
    frames: list[dict[str, object]] = []

    for start in range(0, len(cell_list), group_size):
        chunk = cell_list[start : start + group_size]
        frames.append(
            {
                "type": "frame",
                "mode": mode,
                "index": len(frames),
                "cellStart": start,
                "cells": [cell.to_dict() for cell in chunk],
            }
        )

    return frames

