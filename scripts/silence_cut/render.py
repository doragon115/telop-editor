"""カットリストどおりに音声を書き出す。

aselect フィルタの between() を並べ、1パスで書き出す。区間ごとに一時ファイルを
作って連結する方式より速く、繋ぎ目の途切れも起きない。区間数が数百になると
コマンドライン長の上限に触れるため、フィルタは必ずファイル経由で渡す。
"""

import subprocess
from pathlib import Path


def build_filter(segments) -> str:
    """音声フィルタの文字列を返す。"""
    if not segments:
        raise ValueError("カットリストが空です。残す区間がありません。")

    ranges = "+".join(f"between(t,{s['start']:.3f},{s['end']:.3f})" for s in segments)
    return f"aselect='{ranges}',asetpts=N/SR/TB"


def render_audio(
    source_path: str,
    segments,
    output_path: str,
    *,
    work_dir: str = None,
    quality: int = 2,
) -> str:
    """カット済みの mp3 を書き出す。input/audio/ に置くもの。

    映像は捨てて音声だけを繋ぐので、17分の動画でも1分前後で終わる。
    音量の正規化はここでは行わない。prepare.ts がコンプレッサーとリミッターを
    掛け直すので、二重に潰すのを避ける。
    """
    audio_filter = build_filter(segments)

    work = Path(work_dir) if work_dir else Path(output_path).resolve().parent
    work.mkdir(parents=True, exist_ok=True)
    filter_script = work / "filter_audio.txt"
    filter_script.write_text(audio_filter, encoding="utf-8")

    args = [
        "ffmpeg",
        "-y",
        "-i",
        source_path,
        "-vn",
        "-filter_script:a",
        str(filter_script),
        "-codec:a",
        "libmp3lame",
        "-q:a",
        str(quality),
        output_path,
    ]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg が失敗しました:\n{result.stderr.strip()[-2000:]}")
    return output_path
