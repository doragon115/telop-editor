"""単語単位のタイムスタンプ付き文字起こしを作る。

scripts/generate-transcript.py と同じ openai-whisper を使う。モデルの置き場所
（~/.cache/whisper）を共有するので、追加のダウンロードは発生しない。

ここで欲しいのは単語ごとの時刻だけで、テロップの文面は作らない。文面は、
カット済み音声に対して generate-transcript.py がもう一度作る。二度手間に見えるが、
向こうはカット済み音声をそのまま読むため、時刻のズレが原理的に起きない。
"""


def transcribe(
    audio_path: str,
    *,
    model_size: str = "large-v3",
    language: str = "ja",
    initial_prompt: str = None,
):
    """{"text", "start", "end", "prob"} のリストを時刻順で返す。

    initial_prompt に固有名詞（曲名・専門用語など）を渡しておくと、
    その語の取り違えがかなり減る。
    """
    try:
        import whisper
    except ImportError as exc:  # pragma: no cover - 環境依存
        raise RuntimeError(
            "openai-whisper が未インストールです: pip3 install openai-whisper"
        ) from exc

    model = whisper.load_model(model_size)
    result = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,
        initial_prompt=initial_prompt,
        verbose=False,
    )

    words = []
    for segment in result.get("segments", []):
        for word in segment.get("words") or []:
            text = (word.get("word") or "").strip()
            if not text:
                continue
            words.append(
                {
                    "text": text,
                    "start": float(word["start"]),
                    "end": float(word["end"]),
                    "prob": float(word.get("probability", 0.0)),
                }
            )
    return words
