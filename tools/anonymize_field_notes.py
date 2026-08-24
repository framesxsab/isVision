#!/usr/bin/env python
"""Strip PII from field notes before commit — no participant data invented."""

import re
import sys
from pathlib import Path

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s-]{7,}\d")
NAME_HINT = re.compile(r"\b([A-Z][a-z]+ [A-Z][a-z]+)\b")

def anonymize(text: str) -> str:
    text = EMAIL_RE.sub("[email redacted]", text)
    text = PHONE_RE.sub("[phone redacted]", text)
    return text

def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python tools/anonymize_field_notes.py <file.md>", file=sys.stderr)
        return 2
    p = Path(sys.argv[1])
    if not p.exists():
        print(f"not found: {p}", file=sys.stderr)
        return 1
    out = anonymize(p.read_text(encoding="utf-8"))
    sys.stdout.write(out)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
