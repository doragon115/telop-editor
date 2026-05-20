#!/usr/bin/env python3
"""
音声ファイル → transcript.json + scene-map.json を自動生成するスクリプト。

使い方:
  python3 scripts/generate-transcript.py

音源ファイルは input/audio/audio.mp3 のみ使用。
他のファイル名・複数ファイルはエラー。
"""

from __future__ import annotations

import json
import os
import sys
import re
from typing import Optional

try:
    import whisper
except ImportError:
    print("❌ openai-whisper が未インストールです: pip3 install openai-whisper")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DIR = os.path.join(ROOT, "input")
AUDIO_DIR = os.path.join(INPUT_DIR, "audio")
AUDIO_DEFAULT = os.path.join(AUDIO_DIR, "audio.mp3")
TRANSCRIPT_OUT = os.path.join(INPUT_DIR, "transcript.json")
SCENE_MAP_OUT = os.path.join(INPUT_DIR, "scene-map.json")

# シーン → キャラクター番号の対応
SCENE_MAP: dict[str, int] = {
    "surprised": 0,   # person_01_surprised.jpg
    "pointing":  1,   # person_02_pointing.jpg
    "thinking":  2,   # person_03_thinking.jpg
    "smile":     3,   # person_04_smile.jpg
}

# ---------------------------------------------------------------------------
# シーン分類ルール
# キーワードが多くヒットしたシーンを選ぶ。どれもなければ位置ベースのフォールバック。
# ---------------------------------------------------------------------------

SCENE_KEYWORDS: dict[str, list[str]] = {
    "surprised": [
        "実は", "気づ", "わかっ", "全部", "つながっ", "えっ", "なんと",
        "衝撃", "驚", "まさか", "信じられ", "すごい", "ヤバい", "びっくり",
        "判明", "発覚", "明らか", "実態", "秘密", "真実", "初めて",
    ],
    "pointing": [
        "お金持ち", "成功", "頭のいい", "億万長者", "富裕層", "一流",
        "これが", "それが", "つまり", "ポイント", "重要", "大事",
        "理由", "原因", "仕組み", "方法", "やり方", "コツ", "秘訣",
        "実際", "具体的", "例えば", "たとえば", "要するに",
    ],
    "thinking": [
        "脳", "老け", "疲れ", "なぜ", "どうして", "考え", "思考",
        "ストレス", "負担", "消耗", "エネルギー", "限界", "集中",
        "記憶", "神経", "認知", "メカニズム", "研究", "科学",
        "実は", "意外", "深い", "本質", "根本", "構造",
    ],
    "smile": [
        "若返", "元気", "健康", "明るく", "楽しく", "幸せ", "豊か",
        "できる", "ましょう", "しましょう", "ください", "大丈夫",
        "ありがとう", "おわり", "まとめ", "最後", "一緒に", "未来",
        "改善", "回復", "アップ", "向上", "成長", "チャンス",
    ],
}


def classify_scene(text: str, segment_index: int, total_segments: int) -> str:
    """テキスト内容と位置からシーンを決定する。"""
    scores: dict[str, int] = {scene: 0 for scene in SCENE_KEYWORDS}
    for scene, keywords in SCENE_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                scores[scene] += 1

    best_scene = max(scores, key=lambda s: scores[s])
    if scores[best_scene] > 0:
        return best_scene

    # キーワードなし → 位置ベースのフォールバック
    ratio = segment_index / max(total_segments - 1, 1)
    if ratio < 0.2:
        return "surprised"
    elif ratio < 0.5:
        return "pointing"
    elif ratio < 0.8:
        return "thinking"
    else:
        return "smile"


# ---------------------------------------------------------------------------
# 強調テロップ抽出
# ---------------------------------------------------------------------------

EMPHASIS_PATTERNS = [
    r"「([^」]{2,12})」",          # 「〜」
    r"『([^』]{2,12})』",          # 『〜』
    (r"([^\s、。！？]{2,10})[！!]{1,}", lambda m: m.group(1) + "！"),
]


def extract_emphasis(text: str) -> Optional[str]:
    for pat in EMPHASIS_PATTERNS:
        if isinstance(pat, tuple):
            pattern, formatter = pat
            m = re.search(pattern, text)
            if m:
                return formatter(m)
        else:
            m = re.search(pat, text)
            if m:
                return m.group(1)
    return None


# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------

def main() -> None:
    # --- 音源ファイル検証 ---
    audio_extensions = (".mp3", ".wav", ".m4a", ".aac")
    os.makedirs(AUDIO_DIR, exist_ok=True)
    audio_files = [
        f for f in os.listdir(AUDIO_DIR)
        if os.path.splitext(f)[1].lower() in audio_extensions
    ]

    if len(audio_files) == 0:
        print("❌ input/audio/ に音源ファイルがありません。")
        print("   audio.mp3 という名前で1つだけ配置してください。")
        sys.exit(1)

    if len(audio_files) > 1:
        print("❌ input/audio/ に複数の音源ファイルが見つかりました:")
        for f in audio_files:
            print(f"   - {f}")
        print("   audio.mp3 だけ残して、他のファイルは削除してください。")
        sys.exit(1)

    if audio_files[0] != "audio.mp3":
        print(f"❌ 音源ファイルの名前が正しくありません: {audio_files[0]}")
        print("   ファイル名を「audio.mp3」に変更してください。")
        sys.exit(1)

    # --- 既存 transcript 検証 ---
    if os.path.exists(TRANSCRIPT_OUT):
        print("⚠️  transcript.json がすでに存在します。")
        print("   上書きする場合は「y」、中止する場合は「n」を入力してください。")
        answer = input("   上書きしますか？ [y/N]: ").strip().lower()
        if answer != "y":
            print("   中止しました。エディターの「🗑️ 新規動画の準備」で古いデータを削除してから実行してください。")
            sys.exit(0)

    if not os.path.exists(audio_path):
        print(f"❌ 音声ファイルが見つかりません: {audio_path}")
        sys.exit(1)

    rel_audio = os.path.relpath(audio_path, INPUT_DIR)
    audio_for_json = rel_audio.replace("\\", "/")

    print(f"🎙️  Whisper で文字起こし中: {os.path.basename(audio_path)}")
    print("   モデル: small (日本語特化)")

    model = whisper.load_model("small")
    result = model.transcribe(
        audio_path,
        language="ja",
        word_timestamps=False,
        verbose=False,
    )

    raw_segments: list[dict] = result.get("segments", [])
    total = len(raw_segments)

    if total == 0:
        print("⚠️  セグメントが検出されませんでした")
        sys.exit(1)

    print(f"   {total} セグメント検出")

    # scene-map.json を書き出し
    os.makedirs(INPUT_DIR, exist_ok=True)
    with open(SCENE_MAP_OUT, "w", encoding="utf-8") as f:
        json.dump(SCENE_MAP, f, ensure_ascii=False, indent=2)
    print(f"✅ scene-map.json → {os.path.relpath(SCENE_MAP_OUT, ROOT)}")

    # transcript.json のセグメントを構築
    segments = []
    for i, seg in enumerate(raw_segments):
        text: str = seg["text"].strip()
        scene = classify_scene(text, i, total)
        character = SCENE_MAP[scene]
        emphasis = extract_emphasis(text)

        segments.append({
            "id": i,
            "start": round(seg["start"], 3),
            "end": round(seg["end"], 3),
            "text": text,
            "scene": scene,
            "character": character,
            "emphasis": emphasis,
            "illustration": None,
            "sound": None,
        })

    duration = round(raw_segments[-1]["end"], 3)

    transcript = {
        "title": os.path.splitext(os.path.basename(audio_path))[0],
        "audio": audio_for_json,
        "duration": duration,
        "segments": segments,
    }

    with open(TRANSCRIPT_OUT, "w", encoding="utf-8") as f:
        json.dump(transcript, f, ensure_ascii=False, indent=2)
    print(f"✅ transcript.json → {os.path.relpath(TRANSCRIPT_OUT, ROOT)}")

    # 結果サマリー
    print("\n📊 シーン分布:")
    for scene in SCENE_MAP:
        count = sum(1 for s in segments if s["scene"] == scene)
        bar = "█" * count
        print(f"   {scene:12s} {bar} ({count})")

    print("\n📝 セグメント一覧:")
    for seg in segments:
        em = f"  [{seg['emphasis']}]" if seg["emphasis"] else ""
        print(f"   [{seg['start']:6.1f}s-{seg['end']:6.1f}s] {seg['scene']:12s} {seg['text'][:30]}{em}")

    print(f"\n🎬 合計: {duration:.1f}秒 / {total}セグメント")


if __name__ == "__main__":
    main()
