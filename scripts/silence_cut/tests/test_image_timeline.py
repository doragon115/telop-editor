import unittest

from scripts.silence_cut.image_timeline import build_image_timeline, filled_only


def segment(text, start, end):
    return {"text": text, "start": start, "end": end}


class BuildImageTimelineTests(unittest.TestCase):
    def test_joins_segments_that_run_together(self):
        segments = [segment("前半", 0.0, 2.0), segment("後半", 2.2, 4.0)]

        timeline = build_image_timeline(segments, gap_threshold=0.7)

        self.assertEqual(len(timeline), 1)
        self.assertEqual(timeline[0]["note"], "前半後半")
        self.assertEqual(timeline[0]["start"], 0.0)
        self.assertEqual(timeline[0]["end"], 4.0)

    def test_splits_on_a_long_pause(self):
        segments = [segment("話題A", 0.0, 4.0), segment("話題B", 6.0, 10.0)]

        timeline = build_image_timeline(segments, gap_threshold=0.7, min_length=1.0)

        self.assertEqual([entry["note"] for entry in timeline], ["話題A", "話題B"])

    def test_splits_a_block_that_runs_past_the_target_length(self):
        segments = [segment(f"文{i}", i * 3.0, i * 3.0 + 2.9) for i in range(6)]

        timeline = build_image_timeline(
            segments, gap_threshold=5.0, target_length=6.0, min_length=1.0
        )

        self.assertGreater(len(timeline), 1)
        for entry in timeline:
            self.assertLessEqual(entry["end"] - entry["start"], 9.0)

    def test_absorbs_a_block_that_is_too_short_to_read(self):
        segments = [
            segment("じゅうぶん長い話", 0.0, 8.0),
            segment("一瞬", 9.0, 9.5),
        ]

        timeline = build_image_timeline(
            segments, gap_threshold=0.7, min_length=3.0
        )

        self.assertEqual(len(timeline), 1)
        self.assertEqual(timeline[0]["end"], 9.5)

    def test_strips_newlines_out_of_the_note(self):
        segments = [segment("上の行\n下の行", 0.0, 3.0)]

        timeline = build_image_timeline(segments)

        self.assertEqual(timeline[0]["note"], "上の行下の行")

    def test_truncates_a_long_note(self):
        segments = [segment("あ" * 100, 0.0, 5.0)]

        timeline = build_image_timeline(segments, note_chars=10)

        self.assertEqual(timeline[0]["note"], "あ" * 10 + "…")

    def test_leaves_the_file_empty_and_suggests_a_name(self):
        segments = [segment("一枚目", 0.0, 5.0), segment("二枚目", 9.0, 14.0)]

        timeline = build_image_timeline(segments, gap_threshold=0.7)

        self.assertEqual([entry["file"] for entry in timeline], ["", ""])
        self.assertEqual(
            [entry["suggested"] for entry in timeline],
            ["images/inserts/insert_001.png", "images/inserts/insert_002.png"],
        )

    def test_handles_an_empty_transcript(self):
        self.assertEqual(build_image_timeline([]), [])


class FilledOnlyTests(unittest.TestCase):
    def test_drops_empty_slots_and_the_draft_field(self):
        timeline = [
            {"file": "", "start": 0.0, "end": 5.0, "note": "未定", "suggested": "x.png"},
            {
                "file": "images/inserts/zu.png",
                "start": 5.0,
                "end": 9.0,
                "note": "4小節練習の図",
                "suggested": "y.png",
            },
        ]

        result = filled_only(timeline)

        self.assertEqual(
            result,
            [
                {
                    "file": "images/inserts/zu.png",
                    "start": 5.0,
                    "end": 9.0,
                    "note": "4小節練習の図",
                }
            ],
        )
        self.assertNotIn("suggested", result[0])


if __name__ == "__main__":
    unittest.main()
