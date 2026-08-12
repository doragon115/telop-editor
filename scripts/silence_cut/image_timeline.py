"""telop-editor の transcript.json から image-timeline.json の下書きを作る。

長尺に図をたくさん入れる場合、14個くらいなら手で書けるが、
12分ぶんを1件ずつ手打ちするのは現実的ではない。喋りの区切りで機械的に枠を並べ、
`file` を空にしておくので、そこに画像名を埋めるだけで済むようにする。

区切りは「テロップとテロップの間隔」で取る。話題が変わるところでは息が長く空くので、
そこが図の切り替え位置とだいたい一致する。
"""

INSERT_DIR = "images/inserts"


def build_image_timeline(
    segments,
    *,
    gap_threshold: float = 0.7,
    target_length: float = 12.0,
    min_length: float = 3.0,
    note_chars: int = 40,
    prefix: str = "insert",
):
    """[{"file", "start", "end", "note"}, ...] を返す。

    引数:
      segments      … transcript.json の segments（start / end / text を持つ）
      gap_threshold … これ以上テロップが空いたら話題の切れ目とみなす
      target_length … 1枚あたりの目安の秒数。超えたら切れ目を待たずに割る
      min_length    … これより短い枠は隣へ吸収する
      note_chars    … note に載せる文字数

    `file` は空文字で返す。埋まっていない枠は telop-editor 側で無視されるので、
    必要なところだけ画像名を書けばよい。
    """
    blocks = []
    current = None

    for segment in segments:
        start = float(segment["start"])
        end = float(segment["end"])
        text = segment.get("text") or ""

        if current is None:
            current = {"start": start, "end": end, "texts": [text]}
            continue

        gap = start - current["end"]
        too_long = end - current["start"] >= target_length
        if gap >= gap_threshold or too_long:
            blocks.append(current)
            current = {"start": start, "end": end, "texts": [text]}
        else:
            current["end"] = end
            current["texts"].append(text)

    if current is not None:
        blocks.append(current)

    # 短すぎる枠は前の枠へ吸収する。図が一瞬で消えるのを防ぐ。
    merged = []
    for block in blocks:
        if merged and block["end"] - block["start"] < min_length:
            merged[-1]["end"] = block["end"]
            merged[-1]["texts"].extend(block["texts"])
        else:
            merged.append(block)

    timeline = []
    for index, block in enumerate(merged, start=1):
        # テロップの改行は見た目のためのものなので、note では詰めて1行にする。
        note = "".join(block["texts"]).replace("\n", "").replace("\r", "")
        if len(note) > note_chars:
            note = note[:note_chars] + "…"
        timeline.append(
            {
                "file": "",
                "start": round(block["start"], 2),
                "end": round(block["end"], 2),
                "note": note,
                "suggested": f"{INSERT_DIR}/{prefix}_{index:03d}.png",
            }
        )
    return timeline


def filled_only(timeline):
    """`file` が埋まっている枠だけを残し、下書き用の suggested を落とす。

    telop-editor へ渡す直前にこれを通す。空の枠を渡すと存在しない画像を
    読みにいくので、渡す前にふるいにかける。
    """
    return [
        {
            "file": entry["file"],
            "start": entry["start"],
            "end": entry["end"],
            "note": entry.get("note", ""),
        }
        for entry in timeline
        if entry.get("file")
    ]
