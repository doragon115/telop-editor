# 🎬 テロップエディター / Telop Editor

**初心者でも使えるAI動画用テロップ編集ツール**

✅ 初心者OK　✅ 5分で起動　✅ コピペだけで動作　✅ 音声波形でタイミング調整

**GitHub:** https://github.com/doragon115/telop-editor

音声ファイルと台本JSONを `input/` フォルダに入れるだけで、波形を見ながらテロップのタイミングをドラッグ調整できるツールです。

---

## 📋 必要な環境（Mac）

- **Node.js v18 以上** — https://nodejs.org/ja/
- **ffmpeg** — `brew install ffmpeg`
- **Python 3 + Pillow**（画像分割ツールを使う場合） — `pip3 install Pillow`

インストール後、以下のコマンドで環境を確認できます：

```bash
npm run doctor
```

---

## 🚀 はじめての起動（5ステップ）

### Step 1: ダウンロードして展開

GitHub からダウンロードして、好きな場所に展開してください。

```
https://github.com/doragon115/telop-editor
```

### Step 2: ターミナルでフォルダを開く

```bash
cd /ダウンロード先/telop-editor-main
```

### Step 3: 依存パッケージをインストール

```bash
npm install
```

### Step 4: 音声ファイルを入れる

`input/audio/` フォルダに音声ファイルを入れます。

```
telop-editor-main/
└── input/
    └── audio/
        └── audio.mp3  ← ここに入れる（名前は何でもOK）
```

対応形式：`.mp3` `.wav` `.m4a` `.aac`

### Step 5: エディターを起動する

```bash
npm run editor
```

ブラウザで http://localhost:3001 を開くとエディター画面が表示されます。

---

## 📖 動画を作る流れ

```
1. 音声を用意する
   └── input/audio/ に .mp3 や .wav を入れる

2. テロップデータを作る（2択）
   ├── A) Whisper で自動生成: npm run transcribe
   └── B) 既存の transcript.json を input/ に入れる

3. アセットを準備する
   └── npm run prepare:assets

4. エディターで編集する
   └── npm run editor → http://localhost:3001

5. 動画を書き出す
   └── npm run render
   └── out/ フォルダに .mp4 が生成されます
```

---

## 🆕 新しい動画を作るとき

前の動画データを残したまま新しい動画を始めたい場合は：

```bash
npm run new-video
```

作品名を入力すると `input/` の既存データが `projects/作品名/archive/` に保存され、
新しい動画用の空の環境が作られます。

---

## 🔧 使えるコマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run doctor` | 環境チェック（初回・トラブル時に実行） |
| `npm run new-video` | 新しい動画プロジェクトを開始 |
| `npm run transcribe` | Whisper で音声を自動文字起こし |
| `npm run prepare:assets` | input/ → public/ にファイルをコピー |
| `npm run editor` | テロップエディターを起動（http://localhost:3001） |
| `npm run studio` | Remotion Studio を起動（http://localhost:3000） |
| `npm run render` | 動画をレンダリングして out/ に出力 |
| `npm run typecheck` | TypeScript の型チェック |

---

## 🖥️ ポートの役割

| ポート | 役割 |
|--------|------|
| **3001** | テロップエディター（`npm run editor` で起動） |
| **3000** | Remotion Studio（`npm run studio` で起動） |

---

## ⚙️ ブランド設定（名前・色・ペット画像）

エディター画面（http://localhost:3001）の「⚙️ ブランド設定」から変更できます。

または `config/brand.json` を直接編集：

```json
{
  "name": "あなたの名前",
  "title": "肩書き",
  "petImage": "images/koko.png",
  "petEnabled": true,
  "sfxEnabled": true,
  "brandColor": "#1a56db",
  "background": "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)"
}
```

変更後は `npm run prepare:assets` を実行してください。

---

## 🖼️ 画像分割ツール（4×4グリッド）

4×4のコラージュ画像を16枚に自動分割するツールです。
エディターのヘッダーにある「🖼️ 画像分割ツール」をクリック、または：

http://localhost:3001/image-splitter

**使い方:**
1. 作品名を入力
2. 画像タイプを選択（人物画像 or 挿絵画像）
3. 4×4のコラージュ画像をドロップ
4. 「16枚に分割して保存」をクリック

---

## 📂 フォルダ構成

```
telop-editor-main/
├── input/              ← 作業ファイル（音声・JSONを入れる）
│   ├── audio/          ← 音声ファイル置き場
│   ├── images/         ← 人物画像置き場
│   └── transcript.json ← テロップデータ（Whisper または手動作成）
├── config/
│   └── brand.json      ← ブランド設定（名前・色など）
├── assets/             ← 固定アセット（効果音・BGMなど）
├── public/             ← Remotion が参照する（prepare:assetsで自動生成）
├── out/                ← レンダリング済み動画の出力先
├── projects/           ← new-video でアーカイブされたデータ
└── scripts/            ← ツールスクリプト
```

---

## ❓ よくあるトラブル

**Q. `npm run editor` でブラウザが開かない**
→ ブラウザで直接 http://localhost:3001 を開いてください。

**Q. 画面が真っ白になった**
→ `npm run typecheck` でエラーを確認。コードを変更したなら元に戻してください。

**Q. 音声・テロップが反映されない**
→ `npm run prepare:assets` を実行してから Remotion Studio をリロードしてください。

**Q. 「3001 already in use」エラーが出る**
→ 前のエディターが残っています。ターミナルで `Ctrl+C` して停止後、再起動してください。

**Q. Whisper が動かない**
→ `pip3 install openai-whisper` を実行してください。

---

## 📄 ライセンス

MIT License

---

**GitHub:** https://github.com/doragon115/telop-editor
