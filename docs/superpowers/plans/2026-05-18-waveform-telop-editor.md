# 波形テロップエディター 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** subtitle-editor.html に音声波形＋ドラッグ可能テロップブロックを追加し、数値入力なしでタイムスタンプ修正できるUIを実現する

**Architecture:** WaveSurfer.js v7 (ESM) を `<script type="module">` で読み込み、波形上の regions を rows の start/end と双方向同期する。保存は既存の CSV→import パイプラインをそのまま流用する。`window.updateRowTiming()` をブリッジとして、モジュールスコープと通常スコープを繋ぐ。

**Tech Stack:** WaveSurfer.js v7 (ESM CDN), WaveSurfer RegionsPlugin, Node.js http (既存 editor-server.ts 拡張)

---

## ファイル変更マップ

| ファイル | 変更内容 |
|---------|---------|
| `scripts/editor-server.ts` | `/api/audio-files`, `/audio/:file`, `/api/transcript` の3エンドポイントを追加 |
| `subtitle-editor.html` | 波形セクションHTML・CSS追加、モジュールスクリプトで WaveSurfer 初期化、ブリッジ関数を通常スクリプトに追加 |

---

## Task 1: editor-server.ts に音声・transcript エンドポイントを追加

**Files:**
- Modify: `scripts/editor-server.ts`

- [ ] **Step 1: 既存コードを確認**

`scripts/editor-server.ts` を開き、最後の `res.writeHead(404)` の直前に3つのエンドポイントを追加する位置を確認する。

- [ ] **Step 2: `/api/audio-files` エンドポイントを追加**

`res.writeHead(404); res.end('Not found');` の直前に追加：

```typescript
  // GET /api/audio-files → input/audio/ の .mp3 一覧を返す
  if (req.method === 'GET' && url.pathname === '/api/audio-files') {
    const audioDir = path.resolve('input/audio');
    try {
      const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }
```

- [ ] **Step 3: `/audio/:file` エンドポイントを追加**

Step 2 の直後に追加：

```typescript
  // GET /audio/:file → input/audio/ から音声ファイルをストリーム配信
  if (req.method === 'GET' && url.pathname.startsWith('/audio/')) {
    const fileName = decodeURIComponent(url.pathname.slice('/audio/'.length));
    const filePath = path.resolve('input/audio', fileName);
    if (!filePath.startsWith(path.resolve('input/audio'))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      const mime = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(404); res.end('Audio file not found');
    }
    return;
  }
```

- [ ] **Step 4: `/api/transcript` GET/POST エンドポイントを追加**

Step 3 の直後に追加：

```typescript
  // GET /api/transcript → input/transcript.json を返す
  if (req.method === 'GET' && url.pathname === '/api/transcript') {
    const transcriptPath = path.resolve('input/transcript.json');
    try {
      const data = fs.readFileSync(transcriptPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'transcript.json not found' }));
    }
    return;
  }

  // POST /api/transcript → input/transcript.json と public/transcript.json に書き込む
  if (req.method === 'POST' && url.pathname === '/api/transcript') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        JSON.parse(body); // バリデーション
        fs.writeFileSync(path.resolve('input/transcript.json'), body, 'utf-8');
        fs.writeFileSync(path.resolve('public/transcript.json'), body, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('✅ transcript.json 保存完了');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }
```

- [ ] **Step 5: サーバーを再起動して動作確認**

```bash
# 既存サーバーを止める（Ctrl+C）してから
npm run editor
```

別ターミナルで確認：
```bash
curl http://localhost:3001/api/audio-files
# 期待: ["sample_audio.mp3"] のようなJSON配列

curl http://localhost:3001/api/transcript | head -3
# 期待: {"title":"sample_audio","audio":...
```

- [ ] **Step 6: コミット**

```bash
git add scripts/editor-server.ts
git commit -m "feat: 音声・transcript APIエンドポイントを追加"
```

---

## Task 2: 波形セクションの HTML と CSS を追加

**Files:**
- Modify: `subtitle-editor.html`

- [ ] **Step 1: 波形セクションのCSSを追加**

`subtitle-editor.html` の `<style>` ブロック末尾（`</style>` の直前）に追加：

```css
  /* 波形セクション */
  .waveform-section { background: white; margin: 0 32px 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
  .waveform-header { background: #1a56db; color: white; padding: 10px 20px; font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 12px; }
  .waveform-header .btn-audio { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 5px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; }
  .waveform-header .btn-audio:hover { background: rgba(255,255,255,0.3); }
  #waveform-container { padding: 12px 16px 4px; min-height: 90px; position: relative; }
  #waveform-loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #888; font-size: 13px; }
  .shift-controls { padding: 8px 16px 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-top: 1px solid #f0f0f0; }
  .shift-label { font-size: 12px; color: #666; white-space: nowrap; }
  .btn-shift { padding: 5px 12px; border-radius: 6px; border: 1px solid #d1d5db; background: #f9fafb; font-size: 12px; cursor: pointer; font-weight: bold; }
  .btn-shift:hover { background: #e5e7eb; }
  .btn-shift.primary { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
  .shift-amount { width: 60px; border: 1px solid #d1d5db; border-radius: 5px; padding: 4px 6px; font-size: 12px; text-align: center; }
  .overlap-warning { background: #fef2f2; color: #dc2626; font-size: 12px; padding: 6px 16px; display: none; }
  #audio-filename { font-size: 12px; opacity: 0.8; }
```

- [ ] **Step 2: 波形セクションのHTMLを追加**

`<div class="container">` の直前（toolbarの直後）に追加：

```html
<!-- 波形セクション -->
<div class="waveform-section" id="waveform-section">
  <div class="waveform-header">
    🎵 波形エディター
    <span id="audio-filename">音声ファイルを読み込んでください</span>
    <button class="btn-audio" id="btn-open-audio" onclick="document.getElementById('audio-file-input').click()">📂 音声を開く</button>
    <input type="file" id="audio-file-input" accept=".mp3,.wav" style="display:none">
  </div>
  <div id="waveform-container">
    <span id="waveform-loading">音声ファイルを読み込み中...</span>
    <div id="waveform"></div>
  </div>
  <div class="overlap-warning" id="overlap-warning">⚠️ タイムスタンプが重なっているテロップがあります</div>
  <div class="shift-controls">
    <span class="shift-label">全体シフト:</span>
    <button class="btn-shift" onclick="shiftAll(-1)">◀ -1s</button>
    <button class="btn-shift" onclick="shiftAll(+1)">+1s ▶</button>
    <span class="shift-label" style="margin-left:12px">選択シフト:</span>
    <input type="number" id="shift-amount" class="shift-amount" value="0.5" min="0.1" max="5" step="0.1">
    <span class="shift-label">秒</span>
    <button class="btn-shift primary" onclick="shiftSelected(-1)">◀ 選択を戻す</button>
    <button class="btn-shift primary" onclick="shiftSelected(+1)">選択を進める ▶</button>
  </div>
</div>
```

- [ ] **Step 3: テーブルの各行にチェックボックス列を追加**

`renderTable()` 関数内のテーブルヘッダー生成部分を確認して、
`<th>` の最初に追加。`subtitle-editor.html` の `renderTable` 関数（約254行目）で
`thead` を生成しているコードに `<th><input type="checkbox" id="check-all" onchange="toggleAllCheck(this.checked)"></th>` を先頭に追加。

`tbody` の各行生成にも `<td><input type="checkbox" class="row-check" data-i="${i}"></td>` を先頭に追加。

※ renderTable 関数の詳細は以下 Task 3 で実装する。

- [ ] **Step 4: ブラウザで見た目を確認（npm run editor でサーバー起動後）**

```
http://localhost:3001
```

波形セクションが表示されること（まだ音声なしで空の状態）を確認。

- [ ] **Step 5: コミット**

```bash
git add subtitle-editor.html
git commit -m "feat: 波形セクションのHTML/CSSを追加"
```

---

## Task 3: テーブルにチェックボックス列を追加

**Files:**
- Modify: `subtitle-editor.html`（`renderTable` 関数）

- [ ] **Step 1: `renderTable` 関数のテーブルヘッダーにチェックボックス列を追加**

`subtitle-editor.html` の `renderTable` 関数内、`thead` を生成している部分を探す（約258行目付近）。

`thead tr` を生成する部分に、既存の `<th>（削除ボタン用）` の前に以下を追加：

```javascript
// thead の最初のセルとして追加
'<th style="width:36px;text-align:center"><input type="checkbox" id="check-all" onchange="toggleAllCheck(this.checked)" style="cursor:pointer"></th>'
```

- [ ] **Step 2: tbody の各行にチェックボックスを追加**

各 `<tr>` の最初のセルとして追加：

```javascript
'<td class="del-cell"><input type="checkbox" class="row-check" data-i="' + i + '" style="cursor:pointer"></td>'
```

- [ ] **Step 3: チェックボックス全選択トグル関数を追加**

通常スクリプトブロックに追加：

```javascript
function toggleAllCheck(checked) {
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = checked);
}

function getSelectedIndices() {
  return Array.from(document.querySelectorAll('.row-check:checked'))
    .map(cb => parseInt(cb.dataset.i));
}
```

- [ ] **Step 4: ブラウザで確認**

テーブルの各行にチェックボックスが表示されること、全選択チェックが機能することを確認。

- [ ] **Step 5: コミット**

```bash
git add subtitle-editor.html
git commit -m "feat: テーブルにチェックボックス列を追加"
```

---

## Task 4: WaveSurfer.js 初期化と音声読み込み

**Files:**
- Modify: `subtitle-editor.html`（モジュールスクリプト追加）

- [ ] **Step 1: WaveSurfer モジュールスクリプトを追加**

`</body>` の直前に以下を追加：

```html
<script type="module">
import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import RegionsPlugin from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/regions.esm.js';

let ws = null;
let wsRegions = null;
let segments = []; // transcript.json の segments を保持

// WaveSurfer 初期化
function initWaveSurfer() {
  if (ws) { ws.destroy(); }
  wsRegions = RegionsPlugin.create();
  ws = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#93c5fd',
    progressColor: '#1a56db',
    height: 80,
    minPxPerSec: 50,
    plugins: [wsRegions],
  });

  ws.on('ready', () => {
    document.getElementById('waveform-loading').style.display = 'none';
    renderRegions();
  });

  ws.on('click', (relativeX) => {
    ws.seekTo(relativeX);
    ws.play();
  });

  wsRegions.on('region-updated', (region) => {
    const id = parseInt(region.id);
    const seg = segments.find(s => s.id === id);
    if (seg) {
      seg.start = Math.round(region.start * 100) / 100;
      seg.end = Math.round(region.end * 100) / 100;
      if (window.updateRowTiming) window.updateRowTiming(id, seg.start, seg.end);
    }
    checkOverlaps();
  });

  wsRegions.on('region-clicked', (region, e) => {
    e.stopPropagation();
    if (window.highlightRow) window.highlightRow(parseInt(region.id));
  });
}

// 音声を URL から読み込む
function loadAudioUrl(url, filename) {
  document.getElementById('waveform-loading').style.display = '';
  document.getElementById('audio-filename').textContent = filename;
  initWaveSurfer();
  ws.load(url);
}

// サーバーから音声ファイル一覧を取得して自動ロード
async function autoLoadAudio() {
  if (location.hostname !== 'localhost') return;
  try {
    const res = await fetch('/api/audio-files');
    const files = await res.json();
    if (files.length > 0) {
      loadAudioUrl(`/audio/${encodeURIComponent(files[0])}`, files[0]);
    }
  } catch {}
}

// ファイルピッカーからの読み込み
document.getElementById('audio-file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadAudioUrl(url, file.name);
});

// transcript.json をサーバーから読み込む
async function loadTranscript() {
  if (location.hostname !== 'localhost') return;
  try {
    const res = await fetch('/api/transcript');
    if (!res.ok) return;
    const data = await res.json();
    if (data.segments) {
      segments = data.segments.map(s => ({ ...s }));
      if (window.onSegmentsLoaded) window.onSegmentsLoaded(segments);
    }
  } catch {}
}

// regions を再描画
function renderRegions() {
  if (!wsRegions || !ws) return;
  wsRegions.clearRegions();
  segments.forEach((seg, idx) => {
    const hue = (idx * 47) % 360;
    wsRegions.addRegion({
      id: String(seg.id),
      start: seg.start,
      end: seg.end,
      content: seg.text.length > 10 ? seg.text.slice(0, 10) + '…' : seg.text,
      color: `hsla(${hue}, 70%, 60%, 0.35)`,
      drag: true,
      resize: true,
    });
  });
}

// 重なりチェック
function checkOverlaps() {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  let hasOverlap = false;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end > sorted[i + 1].start) { hasOverlap = true; break; }
  }
  document.getElementById('overlap-warning').style.display = hasOverlap ? '' : 'none';
}

// 全体シフト
window.shiftAll = function(sec) {
  segments.forEach(seg => {
    seg.start = Math.max(0, Math.round((seg.start + sec) * 100) / 100);
    seg.end = Math.max(0.1, Math.round((seg.end + sec) * 100) / 100);
    if (window.updateRowTiming) window.updateRowTiming(seg.id, seg.start, seg.end);
  });
  renderRegions();
};

// 選択行シフト
window.shiftSelected = function(direction) {
  const amount = parseFloat(document.getElementById('shift-amount').value) || 0.5;
  const sec = direction * amount;
  const selectedIds = window.getSelectedIndices ? window.getSelectedIndices().map(i => {
    // rows の i 番目の id を取得
    const idCol = window._headers ? window._headers.indexOf('id') : -1;
    return idCol >= 0 ? parseInt(window._rows[i][idCol]) : -1;
  }) : [];
  segments.filter(s => selectedIds.includes(s.id)).forEach(seg => {
    seg.start = Math.max(0, Math.round((seg.start + sec) * 100) / 100);
    seg.end = Math.max(seg.start + 0.1, Math.round((seg.end + sec) * 100) / 100);
    if (window.updateRowTiming) window.updateRowTiming(seg.id, seg.start, seg.end);
  });
  renderRegions();
};

// segments を外部から取得できるようにする（保存時に使用）
window.getSegments = () => segments;
window.renderRegions = renderRegions;

// 起動時に自動ロード
await loadTranscript();
await autoLoadAudio();
</script>
```

- [ ] **Step 2: ブラウザで確認**

`npm run editor` でサーバー起動後、`http://localhost:3001` を開く。
- 波形セクションに音声が読み込まれること
- 波形上にテロップブロックが表示されること

- [ ] **Step 3: コミット**

```bash
git add subtitle-editor.html
git commit -m "feat: WaveSurfer.js 初期化・音声自動ロード・region表示を実装"
```

---

## Task 5: 双方向同期（テーブル ↔ 波形）

**Files:**
- Modify: `subtitle-editor.html`（通常スクリプトブロック）

- [ ] **Step 1: ブリッジ関数を通常スクリプトに追加**

既存の `</script>` 閉じタグの直前に追加：

```javascript
// 波形→テーブル同期ブリッジ
window.updateRowTiming = function(segId, start, end) {
  const idCol = headers.indexOf('id');
  const startCol = headers.indexOf('start');
  const endCol = headers.indexOf('end');
  const i = rows.findIndex(r => parseInt(r[idCol]) === segId);
  if (i < 0) return;
  rows[i][startCol] = String(start);
  rows[i][endCol] = String(end);
  // テーブルの入力欄も更新
  const startInput = document.querySelector(`input[data-col="start"][data-i="${i}"]`);
  const endInput = document.querySelector(`input[data-col="end"][data-i="${i}"]`);
  if (startInput) startInput.value = start;
  if (endInput) endInput.value = end;
};

// 行ハイライト（波形クリック時）
window.highlightRow = function(segId) {
  const idCol = headers.indexOf('id');
  const i = rows.findIndex(r => parseInt(r[idCol]) === segId);
  if (i < 0) return;
  const allRows = document.querySelectorAll('tbody tr');
  allRows.forEach(tr => tr.style.background = '');
  if (allRows[i]) {
    allRows[i].style.background = '#dbeafe';
    allRows[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

// テーブル→波形同期（start/end 入力変更時）
window.onRowTimingChange = function(i, col, val) {
  const idCol = headers.indexOf('id');
  const segId = parseInt(rows[i][idCol]);
  if (window.getSegments) {
    const seg = window.getSegments().find(s => s.id === segId);
    if (seg) {
      if (col === 'start') seg.start = parseFloat(val);
      if (col === 'end') seg.end = parseFloat(val);
      if (window.renderRegions) window.renderRegions();
    }
  }
};

// _rows と _headers を外部（モジュール）からアクセス可能にする
Object.defineProperty(window, '_rows', { get: () => rows });
Object.defineProperty(window, '_headers', { get: () => headers });

// transcript.json ロード時にテーブルも更新
window.onSegmentsLoaded = function(segments) {
  // transcript.json のデータでテーブルを初期化（start/end のみ更新）
  if (rows.length > 0) return; // CSV がすでに読み込まれていれば上書きしない
  const csvHeaders = ['id','start','end','text','fontSize','color','strokeColor','fontWeight','bgColor','bgOpacity','sound','posY'];
  headers = csvHeaders;
  rows = segments.map(seg => [
    String(seg.id),
    String(seg.start),
    String(seg.end),
    seg.text || '',
    '68',
    '#ffffff',
    '#000000',
    '900',
    '',
    '80',
    seg.sound || '',
    String(seg.posY || 360),
  ]);
  renderTable();
};
```

- [ ] **Step 2: テーブルの start/end 入力欄に data 属性と onchange を追加**

`renderTable()` 関数内で start/end の `<input>` を生成している部分を探し、
`data-i` と `data-col` 属性、および `onchange` を追加する。

既存の start/end 入力の生成コード（約280行目付近）で：
```javascript
// 変更前のイメージ（実際のコードに合わせる）
`<input type="number" class="time-input" value="${startVal}" ...>`

// 変更後
`<input type="number" class="time-input" data-i="${i}" data-col="start" value="${startVal}" 
  onchange="rows[${i}][headers.indexOf('start')]=this.value; onRowTimingChange(${i},'start',this.value); validateTimes(${i},this)" ...>`
```

※ 既存の `oninput`/`onchange` ハンドラーに `onRowTimingChange(${i},'start',this.value)` の呼び出しを追記するだけでよい。

- [ ] **Step 3: 動作確認**

1. 波形でブロックをドラッグ → テーブルの数値が更新されることを確認
2. テーブルの数値を変更 → 波形ブロックが移動することを確認

- [ ] **Step 4: コミット**

```bash
git add subtitle-editor.html
git commit -m "feat: 波形とテーブルの双方向同期を実装"
```

---

## Task 6: 保存フローの確認・調整

**Files:**
- Modify: `subtitle-editor.html`（`saveAndImport` 関数）

- [ ] **Step 1: `saveAndImport` を確認**

既存の `saveAndImport()` は：
1. `saveCSV()` → POST /api/csv → input/subtitles.csv を保存
2. POST /api/import → import-csv.ts → transcript.json を生成

波形で編集した start/end は `window.updateRowTiming` で `rows` に反映済みなので、**既存フローをそのまま使えばよい**。

`saveCSV()` の直前に segments 同期コードを追加：

```javascript
async function saveAndImport() {
  // 波形 segments から rows の start/end を最終同期
  if (window.getSegments) {
    const segs = window.getSegments();
    const idCol = headers.indexOf('id');
    const startCol = headers.indexOf('start');
    const endCol = headers.indexOf('end');
    segs.forEach(seg => {
      const i = rows.findIndex(r => parseInt(r[idCol]) === seg.id);
      if (i >= 0) {
        rows[i][startCol] = String(seg.start);
        rows[i][endCol] = String(seg.end);
      }
    });
  }
  // 以下は既存コード（変更なし）
  const btn = document.getElementById('btn-update');
  // ... 既存の保存処理 ...
```

- [ ] **Step 2: エンドツーエンドで動作確認**

1. `npm run editor` でサーバー起動
2. ブラウザで波形を開く
3. テロップブロックをドラッグして位置を調整
4. 「⚡️ 保存して更新」を押す
5. `public/transcript.json` の start/end が更新されていることを確認：

```bash
cat public/transcript.json | grep -A3 '"id": 0'
```

- [ ] **Step 3: コミット**

```bash
git add subtitle-editor.html
git commit -m "feat: 保存時に波形 segments を rows に最終同期"
```

---

## Task 4.5: 再生中テロップの自動ハイライト・キーボードショートカット

**Files:**
- Modify: `subtitle-editor.html`（WaveSurfer モジュールスクリプト内）

- [ ] **Step 1: `timeupdate` で再生位置のテロップをハイライト**

WaveSurfer モジュールスクリプトの `initWaveSurfer()` 内、`ws.on('ready', ...)` の後に追加：

```javascript
let activeRegionId = null;
ws.on('timeupdate', (currentTime) => {
  const seg = segments.find(s => s.start <= currentTime && currentTime < s.end);
  const newId = seg ? String(seg.id) : null;
  if (newId === activeRegionId) return;
  if (activeRegionId) {
    const prev = regionMap.get(activeRegionId);
    if (prev) prev.element.style.outline = '';
  }
  if (newId) {
    const cur = regionMap.get(newId);
    if (cur) cur.element.style.outline = '3px solid #ef4444';
    if (window.highlightRow) window.highlightRow(parseInt(newId));
  }
  activeRegionId = newId;
});
```

- [ ] **Step 2: regionMap を管理（renderRegions 内で構築）**

`regionMap` を let で宣言し、`renderRegions()` 内の `wsRegions.addRegion()` 呼び出し後に `regionMap.set(String(seg.id), region)` を追加する。

- [ ] **Step 3: キーボードショートカットを追加**

モジュールスクリプトに追加：

```javascript
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (!ws) return;
  if (e.code === 'Space') { e.preventDefault(); ws.playPause(); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); ws.skip(-0.033); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); ws.skip(0.033); }
});
```

- [ ] **Step 4: コミット**

```bash
git add subtitle-editor.html
git commit -m "feat: 再生中テロップの自動ハイライトとキーボードショートカットを追加"
```

---

## Task 6.5: 保存前に transcript.json を自動バックアップ

**Files:**
- Modify: `scripts/editor-server.ts`（POST /api/import ハンドラー）

- [ ] **Step 1: POST /api/import でバックアップを生成**

`runImport()` を呼ぶ直前に追加：

```typescript
// transcript.json のバックアップを作成
const inputTranscript = path.resolve('input/transcript.json');
if (fs.existsSync(inputTranscript)) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const backupPath = path.resolve(`input/transcript.backup-${stamp}.json`);
  fs.copyFileSync(inputTranscript, backupPath);
  console.log(`📦 バックアップ: transcript.backup-${stamp}.json`);
}
```

- [ ] **Step 2: コミット**

```bash
git add scripts/editor-server.ts
git commit -m "feat: 保存前に transcript.json を自動バックアップ"
```

---

## Task 7: 最終調整・UI ポリッシュ

**Files:**
- Modify: `subtitle-editor.html`

- [ ] **Step 1: 波形の横スクロールを有効にする**

WaveSurfer の `minPxPerSec` を上げると波形が広くなりスクロール可能になる。
波形コンテナにスクロール設定を追加：

```css
#waveform-container { overflow-x: auto; }
#waveform { min-width: 100%; }
```

WaveSurfer の `interact: true` オプションを確認（デフォルトで有効）。

- [ ] **Step 2: 音声なし状態のフォールバック**

transcript.json または音声が読み込まれない場合、波形セクションを折りたたんだ状態で表示：

```javascript
// autoLoadAudio() が失敗した後
if (!ws) {
  document.getElementById('waveform-loading').textContent = '音声ファイルが見つかりません。「📂 音声を開く」から選択してください';
}
```

- [ ] **Step 3: 動作の最終確認チェックリスト**

- [ ] 音声自動検出（input/audio/ に .mp3 があれば自動ロード）
- [ ] 「📂 音声を開く」でファイル選択して読み込める
- [ ] 波形上にテロップブロックが表示される
- [ ] ブロックを左右にドラッグ → テーブルの数値が更新される
- [ ] ブロックの端をドラッグ → start または end だけ変わる
- [ ] ブロックをクリック → 対応するテーブル行がハイライト
- [ ] 「全体 -1s / +1s」で全テロップが移動する
- [ ] チェックボックスで選択 → 「選択シフト」で選択行のみ移動する
- [ ] 重なりがあると警告が表示される
- [ ] 「⚡️ 保存して更新」で transcript.json が更新される

- [ ] **Step 4: 最終コミット**

```bash
git add subtitle-editor.html scripts/editor-server.ts
git commit -m "feat: 波形テロップエディター v2 完成"
```

---

## 実装完了の確認コマンド

```bash
# サーバー起動
npm run editor

# 別ターミナルで API 確認
curl http://localhost:3001/api/audio-files
curl http://localhost:3001/api/transcript | python3 -m json.tool | head -20
```
