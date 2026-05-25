#!/usr/bin/env python
"""Emit tactile braille frames as JSON lines."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from isvisible import build_frames, translate_grade1_debug  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate prototype braille frames.")
    parser.add_argument("text", nargs="?", help="Text to translate.")
    parser.add_argument("--file", type=Path, help="Read text from a file.")
    parser.add_argument(
        "--group-size",
        type=int,
        default=1,
        help="Number of braille cells per output frame.",
    )
    parser.add_argument(
        "--unicode",
        action="store_true",
        help="Print the Unicode braille preview before JSON frames.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.file:
        text = args.file.read_text(encoding="utf-8")
    elif args.text is not None:
        text = args.text
    else:
        text = sys.stdin.read()

    cells = translate_grade1_debug(text)

    if args.unicode:
        print("".join(cell.unicode for cell in cells))

    for frame in build_frames(cells, group_size=args.group_size):
        print(json.dumps(frame, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
