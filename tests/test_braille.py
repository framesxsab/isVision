import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from isvisible import BrailleCell, build_frames, translate_grade1_debug


class BrailleDebugTranslationTests(unittest.TestCase):
    def test_letters_map_to_dot_masks(self):
        cells = translate_grade1_debug("abz")

        self.assertEqual([cell.mask for cell in cells], [1, 3, 53])
        self.assertEqual([cell.dots for cell in cells], [[1], [1, 2], [1, 3, 5, 6]])

    def test_capitals_emit_capital_sign(self):
        cells = translate_grade1_debug("A")

        self.assertEqual([cell.role for cell in cells], ["capital-sign", "content"])
        self.assertEqual([cell.mask for cell in cells], [32, 1])

    def test_digits_emit_number_sign(self):
        cells = translate_grade1_debug("10")

        self.assertEqual([cell.role for cell in cells], ["number-sign", "content", "number-sign", "content"])
        self.assertEqual([cell.mask for cell in cells], [60, 1, 60, 26])

    def test_cells_can_represent_all_eight_dots(self):
        cell = BrailleCell(255, "", "content")

        self.assertEqual(cell.dots, [1, 2, 3, 4, 5, 6, 7, 8])
        self.assertEqual(cell.unicode, chr(0x28FF))

    def test_frames_group_cells(self):
        cells = translate_grade1_debug("abc")
        frames = build_frames(cells, group_size=2)

        self.assertEqual(len(frames), 2)
        self.assertEqual(frames[0]["cellStart"], 0)
        self.assertEqual([cell["mask"] for cell in frames[0]["cells"]], [1, 3])
        self.assertEqual(frames[1]["cellStart"], 2)
        self.assertEqual([cell["mask"] for cell in frames[1]["cells"]], [9])


if __name__ == "__main__":
    unittest.main()
