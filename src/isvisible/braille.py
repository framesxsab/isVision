"""Braille cell helpers.

This module intentionally implements only a small uncontracted debug mapping.
Production translation should use Liblouis so language, grade, math, and
punctuation rules are handled correctly.
"""

from __future__ import annotations

from dataclasses import dataclass


DOTS_BY_LETTER = {
    "a": 0b000001,
    "b": 0b000011,
    "c": 0b001001,
    "d": 0b011001,
    "e": 0b010001,
    "f": 0b001011,
    "g": 0b011011,
    "h": 0b010011,
    "i": 0b001010,
    "j": 0b011010,
    "k": 0b000101,
    "l": 0b000111,
    "m": 0b001101,
    "n": 0b011101,
    "o": 0b010101,
    "p": 0b001111,
    "q": 0b011111,
    "r": 0b010111,
    "s": 0b001110,
    "t": 0b011110,
    "u": 0b100101,
    "v": 0b100111,
    "w": 0b111010,
    "x": 0b101101,
    "y": 0b111101,
    "z": 0b110101,
}

PUNCTUATION_DOTS = {
    ",": 0b000010,
    ";": 0b000110,
    ":": 0b010010,
    ".": 0b110010,
    "!": 0b010110,
    "?": 0b100110,
    "-": 0b100100,
    "'": 0b000100,
    " ": 0,
}

CAPITAL_SIGN = 0b100000
NUMBER_SIGN = 0b111100


@dataclass(frozen=True)
class BrailleCell:
    """One braille cell represented as an eight-dot bitmask."""

    mask: int
    source: str
    role: str = "content"

    @property
    def dots(self) -> list[int]:
        return [dot for dot in range(1, 9) if self.mask & (1 << (dot - 1))]

    @property
    def unicode(self) -> str:
        return chr(0x2800 + (self.mask & 0xFF))

    def to_dict(self) -> dict[str, object]:
        return {
            "mask": self.mask,
            "dots": self.dots,
            "unicode": self.unicode,
            "source": self.source,
            "role": self.role,
        }


def translate_grade1_debug(text: str) -> list[BrailleCell]:
    """Translate text to a simple grade-1-style debug cell sequence.

    This covers ASCII letters, digits, a small punctuation set, and spaces.
    Unknown characters are represented as blank cells with role ``unknown``.
    """

    cells: list[BrailleCell] = []

    for char in text:
        if char.isalpha() and char.lower() in DOTS_BY_LETTER:
            if char.isupper():
                cells.append(BrailleCell(CAPITAL_SIGN, char, "capital-sign"))
            cells.append(BrailleCell(DOTS_BY_LETTER[char.lower()], char))
            continue

        if char.isdigit():
            cells.append(BrailleCell(NUMBER_SIGN, char, "number-sign"))
            digit_letter = "j" if char == "0" else chr(ord("a") + int(char) - 1)
            cells.append(BrailleCell(DOTS_BY_LETTER[digit_letter], char))
            continue

        if char in PUNCTUATION_DOTS:
            role = "space" if char == " " else "punctuation"
            cells.append(BrailleCell(PUNCTUATION_DOTS[char], char, role))
            continue

        cells.append(BrailleCell(0, char, "unknown"))

    return cells
