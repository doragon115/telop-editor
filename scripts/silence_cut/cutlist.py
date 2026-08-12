"""単語＋タイムスタンプから「残す区間」を組み立てる。

外部依存なし。文字起こし結果だけを入力に取り、次の2つを返す:
  * カットリスト（残す区間のリスト。元動画のタイムライン上の秒）
  * 旧タイムライン → 新タイムラインの時刻変換（テロップの貼り直しに使う）

無音の判定は「音量」ではなく「単語と単語の間隔」で行う。
息継ぎや言い淀みで音量が下がりきらない箇所を silencedetect は拾えないが、
単語間のギャップなら確実に取れるため。
"""

import re

# 日本語のフィラー。既定は保守的に、意味を持ちにくいものだけを入れている。
# 「はい」「まあ」などは文意を担うことがあるので既定では落とさない。
DEFAULT_FILLERS = (
    "えー",
    "えーと",
    "えっと",
    "えと",
    "あのー",
    "あの",
    "あー",
    "うー",
    "うーん",
    "んー",
    "んーと",
    "そのー",
    "でー",
    "まー",
)

# 文末とみなす記号。テロップの改行位置の判定にも使う。
SENTENCE_END = "。．.!！?？"

_PUNCT = re.compile(r"[、。，．,.!！?？…・\s]+")


def normalize(text: str) -> str:
    """比較用に記号と空白を落とす。"""
    return _PUNCT.sub("", text or "")


def is_filler(word: dict, fillers: set) -> bool:
    return normalize(word.get("text", "")) in fillers


def build_cutlist(
    words,
    *,
    total_duration=None,
    min_silence=0.45,
    lead_pad=0.10,
    tail_pad=0.18,
    min_segment=0.25,
    drop_fillers=True,
    fillers=None,
):
    """残す区間のリストを返す。

    引数:
      words          … {"text", "start", "end"} の辞書のリスト（時刻順）
      total_duration … 元動画の尺（秒）。末尾のはみ出しを抑えるために使う
      min_silence    … これ以上の単語間ギャップを「無音」とみなしてカットする
      lead_pad       … 各区間の頭に足す余白（秒）。語頭の子音が切れるのを防ぐ
      tail_pad       … 各区間の尻に足す余白（秒）。頭より長めが自然に聞こえる
      min_segment    … これより短い区間は捨てる（フィラー削除の削りかすを掃除する）
      drop_fillers   … True ならフィラー語を落とす
      fillers        … フィラー語の集合。None なら DEFAULT_FILLERS

    戻り値:
      [{"start": float, "end": float}, ...]（元動画のタイムライン上の秒）
    """
    filler_set = set(fillers) if fillers is not None else set(DEFAULT_FILLERS)

    kept = []
    for word in words:
        start = word.get("start")
        end = word.get("end")
        if start is None or end is None or end <= start:
            continue
        if drop_fillers and is_filler(word, filler_set):
            continue
        kept.append({"text": word.get("text", ""), "start": start, "end": end})

    if not kept:
        return []

    # 単語間ギャップが min_silence 以上なら、そこで区間を切る。
    segments = []
    current = {"start": kept[0]["start"] - lead_pad, "end": kept[0]["end"]}
    for previous, word in zip(kept, kept[1:]):
        if word["start"] - previous["end"] >= min_silence:
            current["end"] = previous["end"] + tail_pad
            segments.append(current)
            current = {"start": word["start"] - lead_pad, "end": word["end"]}
        else:
            current["end"] = word["end"]
    current["end"] = kept[-1]["end"] + tail_pad
    segments.append(current)

    # 動画の外にはみ出した余白を戻す。
    upper = total_duration if total_duration is not None else segments[-1]["end"]
    for segment in segments:
        segment["start"] = max(0.0, segment["start"])
        segment["end"] = min(upper, segment["end"])

    # 余白を足した結果くっついた区間は、1本にまとめる。
    merged = [segments[0]]
    for segment in segments[1:]:
        if segment["start"] <= merged[-1]["end"]:
            merged[-1]["end"] = max(merged[-1]["end"], segment["end"])
        else:
            merged.append(segment)

    return [s for s in merged if s["end"] - s["start"] >= min_segment]


def cutlist_duration(segments) -> float:
    """カット後の尺（秒）。"""
    return sum(s["end"] - s["start"] for s in segments)


class TimeMap:
    """元動画の時刻を、カット後の時刻へ読み替える。

    カットで消えた時刻を渡した場合は None を返す。テロップの開始・終了は
    必ず残した区間の中にあるので、実用上は None にならない。
    """

    def __init__(self, segments):
        self._segments = list(segments)
        self._offsets = []
        elapsed = 0.0
        for segment in self._segments:
            self._offsets.append(elapsed)
            elapsed += segment["end"] - segment["start"]
        self.duration = elapsed

    def __call__(self, t: float):
        for segment, offset in zip(self._segments, self._offsets):
            if segment["start"] <= t <= segment["end"]:
                return offset + (t - segment["start"])
        return None

    def clamp(self, t: float) -> float:
        """None を返さない版。カットされた時刻は最寄りの残存時刻へ寄せる。"""
        if not self._segments:
            return 0.0
        for segment, offset in zip(self._segments, self._offsets):
            if t < segment["start"]:
                return offset
            if t <= segment["end"]:
                return offset + (t - segment["start"])
        return self.duration
