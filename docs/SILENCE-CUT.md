# 無音カット・フィラー削除

撮って出しの長い素材から、**間延びした無音と言い淀みを落とした音声**を作ります。
長尺（10分以上）を扱うときに効きます。

テロップの中身には触りません。ここが吐いた音声を `npm run transcribe` に読ませると、
カット済みの時間軸そのままで `transcript.json` ができます。

## 何が要るか

```bash
brew install ffmpeg
pip3 install openai-whisper     # npm run transcribe と同じもの。既にあれば不要
```

モデルの置き場所（`~/.cache/whisper`）を `generate-transcript.py` と共有するので、
追加のダウンロードは発生しません。

## 使い方

### 1. 無音とフィラーを落とす

```bash
npm run cut -- ~/Movies/VID_20260812_082629.mp4 --install
```

`--install` を付けると、書き出した音声を `input/audio/audio.mp3` に置きます。
付けない場合は `out/silence-cut/audio_cut.mp3` に残るので、中身を確かめてから手で置けます。

途中経過はこう出ます。

```
[cut] 1080x1920（縦型） 17分19秒
[cut] 音声を抜き出しています
[cut] 文字起こし中（large-v3）。17分の素材で数分から十数分かかります
[cut] 1696語を認識しました
[cut] 314区間を採用。17分19秒 → 11分48秒（5分31秒短縮／32%）
[cut] 書き出し完了: out/silence-cut/audio_cut.mp3
```

段階ごとに止めることもできます。**カットの詰め具合を試すときは `cut` まで**を繰り返すと、
文字起こしをやり直さずに何%縮むかだけ見られます。

```bash
npm run cut -- 素材.mp4 cut --min-silence 0.35
npm run cut -- 素材.mp4 cut --min-silence 0.60
```

### 2. 文字起こし

```bash
npm run transcribe
```

**文字起こしは合計2回走ります。** 1回目（`npm run cut` の中）は無音の位置を測るため、
2回目はテロップの文面を作るためです。2回目はカット済み音声をそのまま読むので、
**時刻のズレが原理的に起きません**。カットに合わせて時刻を計算し直す方式より確実です。

### 3. 挿絵の枠を並べる

```bash
npm run image-timeline
```

`input/transcript.json` を読んで、`input/image-timeline.json` の下書きを作ります。
喋りの切れ目で区切るので、話題の変わり目とだいたい一致します。

```json
{
  "file": "",
  "start": 22.14,
  "end": 34.58,
  "note": "このコードボタンを押します。するとダウンロード、ZIPが出るので…",
  "suggested": "images/inserts/insert_003.png"
}
```

`file` に画像名を入れてください。`suggested` は命名例です。
**空のままの枠は表示されません**ので、図を入れたいところだけ埋めれば動きます。

既に `input/image-timeline.json` がある場合は上書きせずに止まります。
作り直すなら `--force`、別の場所に出すなら `-o` を付けてください。

```bash
npm run image-timeline -- -o /tmp/draft.json      # 今の中身を残したまま下書きだけ見る
npm run image-timeline -- --target-length 8       # 枠を細かくする（図を増やす）
```

## 調整のつまみ

| フラグ | 既定 | 効き方 |
|---|---|---|
| `--min-silence` | 0.45 | これ以上の単語間ギャップをカット。小さくするほど詰まってテンポが上がる |
| `--lead-pad` | 0.10 | 各区間の頭の余白。小さすぎると語頭の子音が切れる |
| `--tail-pad` | 0.18 | 各区間の尻の余白。頭より長めのほうが自然に聞こえる |
| `--keep-fillers` | off | 「えー」「あのー」などを残す |
| `--prompt` | なし | 固有名詞のヒント。曲名や専門用語を並べると取り違えが減る |
| `--model` | large-v3 | whisper のモデル |
| `--gap-threshold` | 0.7 | （図）話題の切れ目とみなす間隔 |
| `--target-length` | 12.0 | （図）1枚あたりの目安の秒数。小さくすると枚数が増える |
| `--force` | off | 作り置きや既存ファイルを上書きする |

固有名詞のヒントは、専門用語が多い回で効きます。

```bash
npm run cut -- 素材.mp4 --prompt "ハーモニカ、ベンド、4小節、タンギング"
```

## フィラーの扱い

既定でこれらを落とします。`--keep-fillers` で全部残せます。

```
えー / えーと / えっと / えと / あのー / あの / あー / うー / うーん
んー / んーと / そのー / でー / まー
```

「はい」「まあ」は文意を担うことがあるため、既定では落としていません。
語を足したい場合は `scripts/silence_cut/cutlist.py` の `DEFAULT_FILLERS` を編集してください。

## 仕組み

**無音の判定は音量ではなく、単語と単語の間隔で行っています。** 息継ぎや言い淀みでは
音量が下がりきらず `silencedetect` では拾えませんが、単語間のギャップなら確実に取れます。

```
words.json      "今日" [1.00-1.42]  "えー" [1.55-1.90]  "現場" [3.80-4.31]
                                      ↑フィラー削除      ↑1.9秒の間 → カット
cutlist.json    [0.90-1.60] [3.70-4.49]
audio_cut.mp3   繋いで書き出し
```

音量の正規化はしていません。`prepare.ts` がコンプレッサーとリミッターを掛け直すので、
二重に潰さないためです。

## 出てくるもの

`out/silence-cut/` に残ります（`out/` は .gitignore 済み）。

| ファイル | 中身 |
|---|---|
| `probe.json` | 元素材の縦横・回転角・尺 |
| `audio.wav` | モノラル16kHz。解析用 |
| `words.json` | 単語単位のタイムスタンプ付き文字起こし |
| `cutlist.json` | 残す区間（元素材のタイムライン上の秒） |
| `audio_cut.mp3` | カット済み音声 |

各段は既に成果物があれば作り直しません。やり直すときは `--force` を付けてください。

## テスト

判定ロジックには外部依存が無いので、ffmpeg も whisper も無しで走ります。

```bash
npm run test:cut
```
