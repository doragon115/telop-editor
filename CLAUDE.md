# telop-editor — Claude Code 作業メモ

## 作業ディレクトリ

```
/Users/hiramatsusatoru/Downloads/telop-editor-main/
```

このプロジェクト内のファイル編集・スクリプト実行は確認不要で進めてください。

---

## プロジェクト概要

Remotion（React ベース）を使った縦型ショート動画（1080×1920）自動生成ツール。
音声ファイル + 人物画像から、テロップ付き動画を自動生成する。

### ポート役割

| ポート | 役割 | 起動コマンド |
|--------|------|------------|
| 3001 | テロップエディター（Node.js HTTP サーバー） | `npm run editor` |
| 3000 | Remotion Studio（プレビュー・レンダリング） | `npm run studio` |

---

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `src/compositions/ShortVideo.tsx` | メイン Remotion コンポーネント |
| `src/components/CharacterLayer.tsx` | 人物画像レイヤー（左下固定） |
| `src/components/SubtitleLayer.tsx` | テロップレイヤー |
| `src/components/SoundLayer.tsx` | 効果音レイヤー |
| `src/components/InsertLayer.tsx` | 挿入画像レイヤー |
| `scripts/silence_cut/` | 無音カット・フィラー削除（`npm run cut`）。docs/SILENCE-CUT.md 参照 |
| `scripts/editor-server.ts` | エディター用 HTTP サーバー |
| `scripts/prepare.ts` | input/ → public/ コピー・音声正規化 |
| `scripts/doctor.ts` | 環境チェック |
| `scripts/new-video.ts` | 新規動画プロジェクト作成 |
| `subtitle-editor.html` | テロップ編集 UI |
| `image-splitter.html` | 4×4 グリッド画像分割 UI |
| `config/brand.json` | ブランド設定（名前・色・ペット画像など） |
| `input/transcript.json` | テロップ・音声データ（作業ファイル） |
| `input/audio/` | 元音声ファイル置き場 |
| `public/` | Remotion が参照するアセット（prepare.ts で生成） |

---

## よく使うコマンド

```bash
npm run doctor          # 環境チェック
npm run new-video       # 新規動画を開始（既存データをアーカイブ）
npm run cut -- 元動画.mp4 --install   # 無音とフィラーを落として input/audio/audio.mp3 に置く
npm run transcribe      # Whisper で文字起こし
npm run image-timeline  # transcript.json から挿絵の枠を並べた下書きを作る
npm run test:cut        # 無音カットのテスト
npm run prepare:assets  # input/ → public/ にコピー（変更後は必ず実行）
npm run editor          # テロップエディター起動 → http://localhost:3001
npm run studio          # Remotion Studio 起動 → http://localhost:3000
npm run render          # 動画をレンダリング
npm run typecheck       # TypeScript 型チェック
```

---

## transcript.json 構造

正本は `src/types/transcript.ts`。見た目の既定値は `src/components/SubtitleLayer.tsx`。

`generate-transcript.py` が作るのは `id` / `start` / `end` / `text` / `scene` /
`character` / `emphasis` / `sound` まで。見た目を変えたいセグメントにだけ
`style` と `posY` を足す（無ければ既定値が使われる）。

**見た目の値は `style` の中に入れる。** セグメント直下に `fontSize` を書いても効かない
（`SubtitleLayer` は `seg.style?.fontSize` を読む）。

```json
{
  "title": "audio",
  "audio": "sounds/audio.mp3",
  "bgm": "sounds/bgm_morning.mp3",
  "bgmVolume": 0.07,
  "volume": 1.0,
  "duration": 60.5,
  "charAlign": "left",
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 3.2,
      "text": "テロップ文字",
      "scene": "pointing",
      "character": 1,
      "emphasis": null,
      "sound": "sounds/se_pop.wav",
      "illustration": null,
      "posY": 360,
      "style": {
        "fontSize": 68,
        "color": "#ffffff",
        "strokeColor": "#000000",
        "bgColor": "#000000",
        "bgOpacity": 50
      }
    }
  ]
}
```

### 値の単位で間違えやすいところ

| キー | 単位・既定 | 補足 |
|---|---|---|
| `posY` | px、既定 **360** | 下からの余白（`padding-bottom`）。大きいほど上へ行く |
| `style.bgOpacity` | **0〜100**、既定 80 | 0〜1 ではない。内部で `/100` される |
| `style.bgColor` | `#rrggbb` | `rgba(...)` ではない。透明度は `bgOpacity` で指定する |
| `style.strokeColor` | `#rrggbb` か `transparent` | `transparent` にすると縁取りと影が消える |
| `character` | 0〜19 | `images/char0.png` 〜 の番号 |

---

## image-timeline.json 構造

挿絵・図の差し込み。`transcript.json` とは別のファイルで、配列をそのまま書く。

```json
[
  { "file": "images/inserts/insert_003.png", "start": 22.14, "end": 34.58, "note": "説明用の図" }
]
```

`note` は人間用のメモで、レンダリングでは無視される。`file` が空の要素は表示されない。
`npm run image-timeline` が枠だけ並べた下書きを作るので、`file` を埋めて使う。

画面の上70%に出て、前後0.2秒でフェードし、3秒を超える枠はゆっくりズームする
（`src/components/InsertLayer.tsx`）。

---

## CharacterLayer の仕様

- 位置: 左下固定（`CHAR_LEFT=24, CHAR_BOTTOM=60`）
- サイズ: `CHAR_WIDTH=200, CHAR_HEIGHT=280`
- 挿絵表示中は `charAlign` に従って左/中央/右に移動
- `objectFit: 'cover'`, `objectPosition: 'top center'`

---

## brand.json の仕様

`config/brand.json` が正本。`prepare:assets` で `public/config/brand.json` に同期される。
エディターの「⚙️ ブランド設定」から GUI で編集可能。

```json
{
  "name": "名前",
  "title": "肩書き",
  "petImage": "images/koko.png",
  "petEnabled": true,
  "characterPosition": "left-bottom",
  "sfxEnabled": true,
  "brandColor": "#1a56db",
  "background": "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)"
}
```

---

## GitHub

https://github.com/doragon115/telop-editor
