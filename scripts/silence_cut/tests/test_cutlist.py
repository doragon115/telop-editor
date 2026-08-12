import unittest

from scripts.silence_cut.cutlist import TimeMap, build_cutlist, cutlist_duration, normalize
from scripts.silence_cut.render import build_filter


def word(text, start, end):
    return {"text": text, "start": start, "end": end}


class NormalizeTests(unittest.TestCase):
    def test_strips_punctuation_and_space(self):
        self.assertEqual(normalize(" えー、 "), "えー")
        self.assertEqual(normalize("そうです。"), "そうです")


class BuildCutlistTests(unittest.TestCase):
    def test_keeps_a_single_run_of_close_words_together(self):
        words = [word("今日", 1.0, 1.4), word("は", 1.4, 1.6), word("晴れ", 1.7, 2.2)]

        segments = build_cutlist(words, total_duration=10.0)

        self.assertEqual(len(segments), 1)
        self.assertAlmostEqual(segments[0]["start"], 0.9, places=3)
        self.assertAlmostEqual(segments[0]["end"], 2.38, places=3)

    def test_cuts_a_long_gap_between_words(self):
        words = [word("最初", 1.0, 1.5), word("次", 6.0, 6.5)]

        segments = build_cutlist(words, total_duration=10.0)

        self.assertEqual(len(segments), 2)
        self.assertAlmostEqual(segments[0]["end"], 1.68, places=3)
        self.assertAlmostEqual(segments[1]["start"], 5.9, places=3)

    def test_short_gaps_are_left_alone(self):
        words = [word("あ", 1.0, 1.2), word("い", 1.5, 1.7)]

        segments = build_cutlist(words, min_silence=0.45, total_duration=10.0)

        self.assertEqual(len(segments), 1)

    def test_drops_filler_words(self):
        words = [word("えー", 1.0, 1.4), word("本題", 1.5, 2.0)]

        segments = build_cutlist(words, total_duration=10.0)

        self.assertEqual(len(segments), 1)
        self.assertAlmostEqual(segments[0]["start"], 1.4, places=3)

    def test_keeps_filler_words_when_asked(self):
        words = [word("えー", 1.0, 1.4), word("本題", 1.5, 2.0)]

        segments = build_cutlist(words, total_duration=10.0, drop_fillers=False)

        self.assertAlmostEqual(segments[0]["start"], 0.9, places=3)

    def test_never_runs_past_the_end_of_the_video(self):
        words = [word("終わり", 9.6, 9.95)]

        segments = build_cutlist(words, total_duration=10.0)

        self.assertLessEqual(segments[-1]["end"], 10.0)

    def test_clamps_the_start_to_zero(self):
        words = [word("頭", 0.02, 0.5)]

        segments = build_cutlist(words, total_duration=10.0)

        self.assertEqual(segments[0]["start"], 0.0)

    def test_returns_nothing_for_an_empty_transcript(self):
        self.assertEqual(build_cutlist([], total_duration=10.0), [])

    def test_skips_words_with_missing_timestamps(self):
        words = [{"text": "壊れ", "start": None, "end": None}, word("正常", 1.0, 1.5)]

        segments = build_cutlist(words, total_duration=10.0)

        self.assertEqual(len(segments), 1)

    def test_drops_segments_shorter_than_the_floor(self):
        words = [word("あ", 1.0, 1.02), word("い", 8.0, 8.9)]

        segments = build_cutlist(
            words, total_duration=10.0, lead_pad=0.0, tail_pad=0.0, min_segment=0.25
        )

        self.assertEqual(len(segments), 1)
        self.assertAlmostEqual(segments[0]["start"], 8.0, places=3)


class TimeMapTests(unittest.TestCase):
    def setUp(self):
        self.segments = [{"start": 1.0, "end": 3.0}, {"start": 7.0, "end": 8.0}]
        self.time_map = TimeMap(self.segments)

    def test_duration_is_the_sum_of_kept_segments(self):
        self.assertAlmostEqual(self.time_map.duration, 3.0)
        self.assertAlmostEqual(cutlist_duration(self.segments), 3.0)

    def test_maps_a_time_inside_the_first_segment(self):
        self.assertAlmostEqual(self.time_map(2.0), 1.0)

    def test_maps_a_time_in_a_later_segment_past_the_removed_gap(self):
        self.assertAlmostEqual(self.time_map(7.5), 2.5)

    def test_returns_none_for_a_removed_time(self):
        self.assertIsNone(self.time_map(5.0))

    def test_clamp_pulls_a_removed_time_to_the_nearest_kept_edge(self):
        self.assertAlmostEqual(self.time_map.clamp(5.0), 2.0)
        self.assertAlmostEqual(self.time_map.clamp(0.0), 0.0)
        self.assertAlmostEqual(self.time_map.clamp(99.0), 3.0)



class RenderFilterTests(unittest.TestCase):
    def test_builds_a_between_expression_per_segment(self):
        audio = build_filter([{"start": 0.0, "end": 1.5}, {"start": 3.25, "end": 4.0}])

        self.assertIn("between(t,0.000,1.500)+between(t,3.250,4.000)", audio)
        self.assertTrue(audio.startswith("aselect="))

    def test_rejects_an_empty_cutlist(self):
        with self.assertRaises(ValueError):
            build_filter([])


if __name__ == "__main__":
    unittest.main()
