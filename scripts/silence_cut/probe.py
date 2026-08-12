"""ffprobe で元動画の素性を調べる。

縦型で撮った動画は 1920x1080 のまま保存され、回転フラグ（rotation）だけが
-90 などになっていることが多い。表示上の縦横はフラグを見ないと分からないので、
ここで解決してから後段へ渡す。
"""

import json
import subprocess


def _run(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{args[0]} が失敗しました:\n{result.stderr.strip()}")
    return result.stdout


def probe(path: str) -> dict:
    """幅・高さ・fps・尺・回転角と、表示上の縦横を返す。

    音声だけのファイルを渡した場合は、縦横と fps が 0 になり、尺だけが入る。
    カットに要るのは尺だけなので、それで先へ進める。
    """
    raw = _run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,duration:stream_tags=rotate:"
            "stream_side_data=rotation:format=duration",
            "-of",
            "json",
            path,
        ]
    )
    data = json.loads(raw)
    streams = data.get("streams") or []
    # 音声だけのファイル（mp3 など）を渡されたら映像ストリームが無い。
    # 尺さえ取れればカットはできるので、縦横は 0 のまま進める。
    stream = streams[0] if streams else {}

    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    rotation = _rotation_of(stream)

    # 90 度系の回転なら、表示上は縦横が入れ替わる。
    if abs(rotation) % 180 == 90:
        display_width, display_height = height, width
    else:
        display_width, display_height = width, height

    duration = stream.get("duration") or (data.get("format") or {}).get("duration")

    return {
        "path": path,
        "width": width,
        "height": height,
        "rotation": rotation,
        "display_width": display_width,
        "display_height": display_height,
        "is_portrait": display_height > display_width,
        "fps": _fps_of(stream.get("r_frame_rate")),
        "duration": float(duration) if duration else None,
    }


def _rotation_of(stream: dict) -> int:
    """回転角を取り出す。新しい ffprobe は side_data、古いものは tags に入れる。"""
    for side_data in stream.get("side_data_list") or []:
        if "rotation" in side_data:
            return int(round(float(side_data["rotation"])))
    rotate = (stream.get("tags") or {}).get("rotate")
    if rotate is not None:
        return int(round(float(rotate)))
    return 0


def _fps_of(rate) -> float:
    if not rate:
        return 0.0
    if "/" in str(rate):
        numerator, denominator = str(rate).split("/", 1)
        denominator = float(denominator)
        return float(numerator) / denominator if denominator else 0.0
    return float(rate)


def extract_audio(video_path: str, audio_path: str, sample_rate: int = 16000) -> str:
    """文字起こし用に、モノラル 16kHz の wav を書き出す。

    2.61GB の動画でも、この wav は 30MB 台に収まる。以降の解析は
    すべてこの音声だけを相手にするので、試行錯誤が軽くなる。
    """
    _run(
        [
            "ffmpeg",
            "-y",
            "-i",
            video_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            str(sample_rate),
            "-c:a",
            "pcm_s16le",
            audio_path,
        ]
    )
    return audio_path
