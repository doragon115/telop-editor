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
npm run transcribe      # Whisper で文字起こし
npm run prepare:assets  # input/ → public/ にコピー（変更後は必ず実行）
npm run editor          # テロップエディター起動 → http://localhost:3001
npm run studio          # Remotion Studio 起動 → http://localhost:3000
npm run render          # 動画をレンダリング
npm run typecheck       # TypeScript 型チェック
```

---

## transcript.json 構造

```json
{
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
      "fontSize": 68,
      "color": "#ffffff",
      "strokeColor": "#000000",
      "bgColor": "rgba(0,0,0,0.5)",
      "bgOpacity": 0.5,
      "posY": 1400,
      "sound": "sounds/se_pop.wav",
      "illustration": ""
    }
  ]
}
```

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
