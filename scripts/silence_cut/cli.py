#!/usr/bin/env python3
"""無音カットとフィラー削除。

  npm run cut -- ~/Movies/VID_20260812_082629.mp4

処理の流れ:
  1. probe      … 元動画の縦横・回転・尺を調べる
  2. audio      … モノラル16kHzの wav を抜く（以降の解析はこれだけを見る）
  3. transcribe … openai-whisper で単語単位の文字起こし
  4. cut        … 無音とフィラーを落として「残す区間」を決める
  5. audiocut   … カット済み mp3 を書き出す

各段は成果物を out/silence-cut/ に置き、既にあれば作り直さない（--force で再実行）。
文字起こしは時間がかかるので、カットの詰め具合を調整するときにこの作り置きが効く。

書き出した音声を input/audio/audio.mp3 に置いて `npm run transcribe` を回すと、
カット済みの時間軸そのままで transcript.json ができる。
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

from . import probe as probe_module
from . import render as render_module
from .cutlist import DEFAULT_FILLERS, build_cutlist, cutlist_duration

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "out" / "silence-cut"
INPUT_AUDIO = ROOT / "input" / "audio" / "audio.mp3"
INPUT_TRANSCRIPT = ROOT / "input" / "transcript.json"
INPUT_IMAGE_TIMELINE = ROOT / "input" / "image-timeline.json"


def log(message: str) -> None:
    print(f"[cut] {message}", file=sys.stderr)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def mmss(seconds: float) -> str:
    seconds = int(round(seconds or 0))
    return f"{seconds // 60}分{seconds % 60:02d}秒"


def stage_probe(args, out: Path) -> dict:
    path = out / "probe.json"
    if path.exists() and not args.force:
        return read_json(path)
    log("元の素材を調べています")
    info = probe_module.probe(args.input)
    write_json(path, info)
    shape = "縦型" if info["is_portrait"] else "横型"
    log(f"{info['display_width']}x{info['display_height']}（{shape}） {mmss(info['duration'])}")
    return info


def stage_audio(args, out: Path) -> Path:
    path = out / "audio.wav"
    if path.exists() and not args.force:
        return path
    log("音声を抜き出しています")
    probe_module.extract_audio(args.input, str(path))
    log(f"音声: {path.stat().st_size / 1e6:.1f}MB")
    return path


def stage_transcribe(args, out: Path, audio_path: Path):
    path = out / "words.json"
    if path.exists() and not args.force:
        return read_json(path)
    log(f"文字起こし中（{args.model}）。17分の素材で数分から十数分かかります")
    from .transcribe import transcribe

    words = transcribe(
        str(audio_path),
        model_size=args.model,
        language=args.language,
        initial_prompt=args.prompt,
    )
    write_json(path, words)
    log(f"{len(words)}語を認識しました")
    return words


def stage_cut(args, out: Path, words, info: dict):
    path = out / "cutlist.json"
    if path.exists() and not args.force:
        return read_json(path)
    log("無音とフィラーを落としています")
    segments = build_cutlist(
        words,
        total_duration=info.get("duration"),
        min_silence=args.min_silence,
        lead_pad=args.lead_pad,
        tail_pad=args.tail_pad,
        drop_fillers=not args.keep_fillers,
    )
    write_json(path, segments)

    original = info.get("duration") or 0.0
    kept = cutlist_duration(segments)
    summary = f"{len(segments)}区間を採用。"
    if original:
        saved = original - kept
        summary += (
            f"{mmss(original)} → {mmss(kept)}"
            f"（{mmss(saved)}短縮／{saved / original * 100:.0f}%）"
        )
    else:
        summary += mmss(kept)
    log(summary)
    return segments


def stage_audiocut(args, out: Path, segments) -> Path:
    path = out / "audio_cut.mp3"
    if path.exists() and not args.force:
        log(f"作り置きを使います: {path}")
    else:
        log("カット済み音声を書き出しています")
        render_module.render_audio(args.input, segments, str(path), work_dir=str(out))
        log(f"書き出し完了: {path}（{path.stat().st_size / 1e6:.1f}MB）")

    if args.install:
        INPUT_AUDIO.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, INPUT_AUDIO)
        log(f"配置しました: {INPUT_AUDIO}")
        log("次: npm run transcribe")
    else:
        log(f"配置するには --install、または手で: cp {path} {INPUT_AUDIO}")
    return path


def command_image_timeline(args) -> int:
    """transcript.json から、挿絵を差し込む枠を並べた下書きを作る。"""
    from .image_timeline import build_image_timeline, filled_only

    source = Path(args.transcript) if args.transcript else INPUT_TRANSCRIPT
    if not source.exists():
        log(f"{source} がありません。先に npm run transcribe を回してください")
        return 1

    destination = Path(args.out) if args.out else INPUT_IMAGE_TIMELINE
    if destination.exists() and not args.force:
        log(f"{destination} が既にあります。上書きするなら --force を付けてください")
        log(f"（今の中身を消したくない場合は -o で別の場所を指定してください）")
        return 1

    segments = read_json(source).get("segments") or []
    if not segments:
        log(f"{source} に segments がありません")
        return 1

    timeline = build_image_timeline(
        segments,
        gap_threshold=args.gap_threshold,
        target_length=args.target_length,
    )
    write_json(destination, timeline)

    log(f"{len(timeline)}枠を書き出しました: {destination}")
    log(f'うち画像が入っているもの: {len(filled_only(timeline))}枠')
    log('各枠の "file" に画像名を入れてください（suggested が命名例です）')
    log("空のままの枠は Remotion 側で無視されます")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="npm run cut --",
        description="無音カットとフィラー削除（telop-editor の下ごしらえ）",
    )
    parser.add_argument(
        "stage",
        nargs="?",
        default="all",
        choices=["probe", "audio", "transcribe", "cut", "audiocut", "all", "image-timeline"],
        help="ここまでの段を実行する（既定 all）",
    )
    parser.add_argument("input", nargs="?", help="元の動画または音声のパス")
    parser.add_argument("-o", "--out", default=None, help="成果物の置き場所")
    parser.add_argument("--force", action="store_true", help="作り置きや既存ファイルを上書きする")
    parser.add_argument(
        "--install",
        action="store_true",
        help="書き出した音声を input/audio/audio.mp3 に置く",
    )

    parser.add_argument("--model", default="large-v3", help="whisper のモデル")
    parser.add_argument("--language", default="ja")
    parser.add_argument(
        "--prompt", default=None, help="固有名詞のヒント。曲名や専門用語を並べると取り違えが減る"
    )

    parser.add_argument("--min-silence", type=float, default=0.45, help="カットする無音の長さ（秒）")
    parser.add_argument("--lead-pad", type=float, default=0.10)
    parser.add_argument("--tail-pad", type=float, default=0.18)
    parser.add_argument(
        "--keep-fillers",
        action="store_true",
        help=f"フィラーを残す。既定で落とす語: {'／'.join(DEFAULT_FILLERS)}",
    )

    group = parser.add_argument_group("image-timeline 用")
    group.add_argument("--transcript", help="既定 input/transcript.json")
    group.add_argument(
        "--gap-threshold", type=float, default=0.7, help="話題の切れ目とみなす間隔（秒）"
    )
    group.add_argument("--target-length", type=float, default=12.0, help="図1枚あたりの目安の秒数")
    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.stage == "image-timeline":
        return command_image_timeline(args)

    if not args.input:
        parser.error("元の動画または音声のパスを指定してください")

    out = Path(args.out) if args.out else DEFAULT_OUT
    out.mkdir(parents=True, exist_ok=True)

    order = ["probe", "audio", "transcribe", "cut", "audiocut"]
    last = "audiocut" if args.stage == "all" else args.stage
    wanted = order[: order.index(last) + 1]

    info = stage_probe(args, out)
    if "audio" not in wanted:
        return 0

    audio_path = stage_audio(args, out)
    if "transcribe" not in wanted:
        return 0

    words = stage_transcribe(args, out, audio_path)
    if "cut" not in wanted:
        return 0

    segments = stage_cut(args, out, words, info)
    if not segments:
        log("残す区間がありません。--min-silence を大きくして試してください")
        return 1

    if "audiocut" in wanted:
        stage_audiocut(args, out, segments)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
