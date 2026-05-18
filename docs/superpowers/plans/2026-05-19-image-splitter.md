# 4×4画像分割ツール実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GPTで生成した4×4コラージュ画像を、ブラウザ上で16枚に自動分割し `projects/<作品名>/images/<タイプ>/` へ保存できる製品標準機能を追加する。

**Architecture:** ブラウザの Canvas API で画像を16分割→base64でサーバーに送信→Node.js が `projects/` 配下にPNG保存。外部npmパッケージ不要。既存の `editor-server.ts` にルートを追記し、`image-splitter.html` を新規作成する。

**Tech Stack:** Node.js (http モジュール, fs), Browser Canvas API, HTML/CSS/JS (バニラ), TypeScript (editor-server.ts のみ)

---

## ファイル構成

| 操作 | ファイル | 役割 |
|------|----------|------|
| 新規作成 | `image-splitter.html` | 分割ツールのUI（スタンドアロン HTML） |
| 修正 | `scripts/editor-server.ts` | `/image-splitter`, `GET /api/projects`, `POST /api/save-images` を追加 |
| 修正 | `package.json` | `splitter` スクリプトエイリアスを追加 |
| 修正 | `subtitle-editor.html` | ヘッダーに「画像分割ツール」リンクを追加 |
| 自動生成 | `projects/<名前>/images/portraits/portrait_001.png` 〜 `portrait_016.png` | 分割後の人物画像 |
| 自動生成 | `projects/<名前>/images/inserts/insert_001.png` 〜 `insert_016.png` | 分割後の挿絵画像 |
| 自動生成 | `projects/<名前>/images/<タイプ>/image-list.txt` | ファイル名と説明の一覧 |

---

## Task 1: editor-server.ts に3エンドポイントを追加

**Files:**
- Modify: `scripts/editor-server.ts`

- [ ] **Step 1: 現在のファイル末尾の `res.writeHead(404); res.end('Not found');` の直前に3ルートを挿入**

`scripts/editor-server.ts` の最終行付近にある `res.writeHead(404); res.end('Not found');` を見つけ、その直前に以下を追加する：

```typescript
  // GET /image-splitter → image-splitter.html を返す
  if (req.method === 'GET' && url.pathname === '/image-splitter') {
    try {
      const html = fs.readFileSync(path.resolve('image-splitter.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(404); res.end('image-splitter.html not found');
    }
    return;
  }

  // GET /api/projects → projects/ 配下のフォルダ名一覧を返す
  if (req.method === 'GET' && url.pathname === '/api/projects') {
    const projectsDir = path.resolve('projects');
    let projects: string[] = [];
    try {
      projects = fs.readdirSync(projectsDir).filter(f =>
        fs.statSync(path.join(projectsDir, f)).isDirectory()
      );
    } catch {
      // projects/ が存在しない場合は空配列を返す
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(projects));
    return;
  }

  // POST /api/save-images → 16枚のPNGをprojects/配下に保存
  // Body: { projectName: string, imageType: 'portraits'|'inserts',
  //         images: Array<{filename: string, dataUrl: string, label: string}> }
  if (req.method === 'POST' && url.pathname === '/api/save-images') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { projectName, imageType, images } = JSON.parse(body) as {
          projectName: string;
          imageType: 'portraits' | 'inserts';
          images: Array<{ filename: string; dataUrl: string; label: string }>;
        };

        if (!projectName || !projectName.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '作品名が未入力です' }));
          return;
        }
        if (imageType !== 'portraits' && imageType !== 'inserts') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '画像タイプが不正です' }));
          return;
        }
        if (!Array.isArray(images) || images.length !== 16) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '画像が16枚ではありません' }));
          return;
        }

        // パストラバーサル防止: / \ などの危険文字を _ に置換
        const safeName = projectName.trim().replace(/[/\\:*?"<>|]/g, '_');
        const dir = path.resolve('projects', safeName, 'images', imageType);
        fs.mkdirSync(dir, { recursive: true });

        for (const { filename, dataUrl } of images) {
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
          fs.writeFileSync(path.join(dir, filename), Buffer.from(base64, 'base64'));
        }

        // image-list.txt を作成
        const listLines = images.map(({ filename, label }) =>
          `${filename}：${label && label.trim() ? label.trim() : '（説明を記入）'}`
        );
        fs.writeFileSync(path.join(dir, 'image-list.txt'), listLines.join('\n'), 'utf-8');

        const relativePath = `projects/${safeName}/images/${imageType}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: relativePath, count: images.length }));
        console.log(`✅ 画像保存完了: ${relativePath} (${images.length}枚)`);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
        console.error(`❌ save-images 失敗: ${e}`);
      }
    });
    return;
  }
```

- [ ] **Step 2: サーバーを再起動して /api/projects が応答することを確認**

```bash
lsof -ti :3001 | xargs kill -9 2>/dev/null; sleep 1
cd /Users/hiramatsusatoru/yuiko/auto-short-video-maker
npx tsx scripts/editor-server.ts &
sleep 2
curl -s http://localhost:3001/api/projects
```

期待出力: `[]`（projects/ フォルダが未作成の場合）

- [ ] **Step 3: コミット**

```bash
cd /Users/hiramatsusatoru/yuiko/auto-short-video-maker
git add scripts/editor-server.ts
git commit -m "feat: add /image-splitter route, /api/projects, /api/save-images endpoints"
```

---

## Task 2: image-splitter.html を作成する

**Files:**
- Create: `image-splitter.html`（プロジェクトルート直下、`subtitle-editor.html` と同じ階層）

- [ ] **Step 1: ファイルを作成する**

以下の完全なHTMLを `image-splitter.html` として保存する。
DOM操作はすべて `textContent` または `createElement` + `appendChild` を使用し、
`innerHTML` への文字列代入は使わない設計にしている。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>4x4 画像分割ツール</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
  background: #f3f4f6;
  color: #111827;
  margin: 0;
  padding: 0;
}
header {
  background: #1a56db;
  color: white;
  padding: 16px 32px;
  display: flex;
  align-items: center;
  gap: 16px;
}
header h1 { margin: 0; font-size: 20px; font-weight: bold; }
header a {
  color: rgba(255,255,255,0.8);
  text-decoration: none;
  font-size: 13px;
  margin-left: auto;
}
header a:hover { color: white; }
.container { max-width: 900px; margin: 32px auto; padding: 0 24px 80px; }
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  padding: 24px 28px;
  margin-bottom: 20px;
}
.step-label {
  font-size: 11px;
  font-weight: bold;
  color: #1a56db;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.card h2 { font-size: 16px; margin: 0 0 16px; }
.field-label {
  font-size: 13px;
  font-weight: bold;
  color: #374151;
  display: block;
  margin-bottom: 6px;
}
input[type="text"] {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s;
}
input[type="text"]:focus {
  border-color: #1a56db;
  box-shadow: 0 0 0 3px rgba(26,86,219,0.12);
}
.radio-group { display: flex; gap: 16px; }
.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  padding: 10px 20px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.15s;
}
.radio-option.selected {
  border-color: #1a56db;
  background: #eff6ff;
  color: #1a56db;
  font-weight: bold;
}
#drop-zone {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}
#drop-zone:hover, #drop-zone.drag-over {
  border-color: #1a56db;
  background: #eff6ff;
}
#drop-zone .icon { font-size: 40px; margin-bottom: 12px; }
#drop-zone p { margin: 4px 0; font-size: 14px; color: #6b7280; }
#drop-zone strong { font-size: 15px; color: #111827; }
#file-input { display: none; }
.preview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}
.preview-cell { display: flex; flex-direction: column; gap: 4px; }
.preview-cell img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}
.preview-cell input[type="text"] {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 5px;
}
.preview-num {
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
  font-weight: bold;
}
.btn {
  display: inline-block;
  border: none;
  border-radius: 8px;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #1a56db; color: white; }
.btn-primary:hover:not(:disabled) { background: #1447c0; }
.btn-secondary { background: #e5e7eb; color: #374151; }
.btn-secondary:hover { background: #d1d5db; }
.btn-row { display: flex; gap: 12px; align-items: center; }
.result-box {
  background: #f0fdf4;
  border: 2px solid #16a34a;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}
.result-icon { font-size: 48px; margin-bottom: 12px; }
.result-box h3 { margin: 0 0 8px; color: #166534; font-size: 20px; }
.result-path {
  font-family: monospace;
  font-size: 13px;
  background: #dcfce7;
  border-radius: 6px;
  padding: 8px 14px;
  color: #15803d;
  display: inline-block;
  margin: 8px 0 16px;
  word-break: break-all;
}
#toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
}
#toast.show { opacity: 1; }
#preview-section { display: none; }
#result-section { display: none; }
</style>
</head>
<body>

<header>
  <div>🖼️</div>
  <h1>4×4 画像分割ツール</h1>
  <a href="/">← テロップエディターへ</a>
</header>

<div class="container">

  <!-- STEP 1: 作品名 -->
  <div class="card">
    <div class="step-label">STEP 1</div>
    <h2>作品名を入力してください</h2>
    <input type="text" id="project-name" placeholder="例：導入動画" list="project-list" autocomplete="off">
    <datalist id="project-list"></datalist>
    <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">
      既存の作品名を入力すると既存フォルダに追加されます。新しい名前を入力すると新規作成されます。
    </p>
  </div>

  <!-- STEP 2: 画像タイプ -->
  <div class="card">
    <div class="step-label">STEP 2</div>
    <h2>画像タイプを選択してください</h2>
    <div class="radio-group" id="radio-group">
      <div class="radio-option selected" data-value="portraits" onclick="selectType('portraits')">
        🧑 人物画像（portraits）
      </div>
      <div class="radio-option" data-value="inserts" onclick="selectType('inserts')">
        🖼️ 挿絵画像（inserts）
      </div>
    </div>
    <p id="type-desc" style="margin:12px 0 0;font-size:12px;color:#6b7280;"></p>
  </div>

  <!-- STEP 3: 画像選択 -->
  <div class="card">
    <div class="step-label">STEP 3</div>
    <h2>4×4 コラージュ画像を選択</h2>
    <div id="drop-zone">
      <div class="icon">📁</div>
      <strong>クリックして画像を選択</strong>
      <p>またはここにドラッグ＆ドロップ</p>
      <p style="font-size:11px;">対応形式：PNG / JPEG / WebP</p>
    </div>
    <input type="file" id="file-input" accept="image/*">
  </div>

  <!-- STEP 4: プレビュー -->
  <div id="preview-section" class="card">
    <div class="step-label">STEP 4</div>
    <h2>16分割プレビュー <span id="preview-type-badge" style="font-size:12px;font-weight:normal;color:#6b7280;"></span></h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">
      各画像に説明を入力できます（省略可）。入力内容は image-list.txt に保存されます。
    </p>
    <div class="preview-grid" id="preview-grid"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-save" onclick="saveImages()">💾 16枚に分割して保存</button>
      <button class="btn btn-secondary" onclick="resetAll()">やり直す</button>
    </div>
  </div>

  <!-- 完了 -->
  <div id="result-section" class="card">
    <div class="result-box">
      <div class="result-icon">✅</div>
      <h3>保存しました</h3>
      <div>保存場所：</div>
      <div class="result-path" id="result-path"></div>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-primary" onclick="resetAll()">別の画像を分割する</button>
        <a href="/" class="btn btn-secondary">エディターへ戻る</a>
      </div>
    </div>
  </div>

</div>

<div id="toast"></div>

<script>
var splitDataUrls = [];
var selectedType = 'portraits';

window.addEventListener('DOMContentLoaded', function() {
  loadProjects();
  updateTypeDesc();
  setupDropZone();
  document.getElementById('project-name').addEventListener('input', updateTypeDesc);
  document.getElementById('drop-zone').addEventListener('click', function() {
    document.getElementById('file-input').click();
  });
});

function loadProjects() {
  fetch('/api/projects').then(function(r) {
    return r.json();
  }).then(function(projects) {
    var dl = document.getElementById('project-list');
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    projects.forEach(function(name) {
      var opt = document.createElement('option');
      opt.value = name;
      dl.appendChild(opt);
    });
  }).catch(function() {});
}

function selectType(type) {
  selectedType = type;
  document.querySelectorAll('.radio-option').forEach(function(el) {
    if (el.getAttribute('data-value') === type) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
  updateTypeDesc();
  if (splitDataUrls.length === 16) renderPreview();
}

function getImageType() { return selectedType; }

function updateTypeDesc() {
  var name = document.getElementById('project-name').value.trim() || '作品名';
  var type = getImageType();
  document.getElementById('type-desc').textContent = '保存先：projects/' + name + '/images/' + type + '/';
  var badge = document.getElementById('preview-type-badge');
  if (badge) badge.textContent = type === 'portraits' ? '（人物画像）' : '（挿絵画像）';
}

function setupDropZone() {
  var dz = document.getElementById('drop-zone');
  var fi = document.getElementById('file-input');
  dz.addEventListener('dragover', function(e) {
    e.preventDefault();
    dz.classList.add('drag-over');
  });
  dz.addEventListener('dragleave', function() {
    dz.classList.remove('drag-over');
  });
  dz.addEventListener('drop', function(e) {
    e.preventDefault();
    dz.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    } else {
      showToast('画像ファイルを選択してください');
    }
  });
  fi.addEventListener('change', function() {
    if (fi.files[0]) handleFile(fi.files[0]);
    fi.value = '';
  });
}

function handleFile(file) {
  var projectName = document.getElementById('project-name').value.trim();
  if (!projectName) {
    showToast('先に作品名を入力してください');
    document.getElementById('project-name').focus();
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      splitDataUrls = splitImage(img);
      renderPreview();
      document.getElementById('preview-section').style.display = 'block';
      document.getElementById('result-section').style.display = 'none';
      document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth' });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function splitImage(img) {
  var COLS = 4, ROWS = 4;
  var pw = Math.floor(img.naturalWidth / COLS);
  var ph = Math.floor(img.naturalHeight / ROWS);
  var urls = [];
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var canvas = document.createElement('canvas');
      canvas.width = pw;
      canvas.height = ph;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, c * pw, r * ph, pw, ph, 0, 0, pw, ph);
      urls.push(canvas.toDataURL('image/png'));
    }
  }
  return urls;
}

function renderPreview() {
  var type = getImageType();
  var prefix = type === 'portraits' ? 'portrait' : 'insert';
  var grid = document.getElementById('preview-grid');
  while (grid.firstChild) grid.removeChild(grid.firstChild);

  splitDataUrls.forEach(function(dataUrl, i) {
    var num = String(i + 1).padStart(3, '0');
    var filename = prefix + '_' + num + '.png';

    var cell = document.createElement('div');
    cell.className = 'preview-cell';

    var numEl = document.createElement('div');
    numEl.className = 'preview-num';
    numEl.textContent = num;

    var imgEl = document.createElement('img');
    imgEl.src = dataUrl;
    imgEl.alt = filename;

    var labelEl = document.createElement('input');
    labelEl.type = 'text';
    labelEl.placeholder = '説明（省略可）';
    labelEl.id = 'label-' + i;

    cell.appendChild(numEl);
    cell.appendChild(imgEl);
    cell.appendChild(labelEl);
    grid.appendChild(cell);
  });

  updateTypeDesc();
}

function saveImages() {
  var projectName = document.getElementById('project-name').value.trim();
  if (!projectName) { showToast('作品名を入力してください'); return; }
  if (splitDataUrls.length !== 16) { showToast('画像がまだ選択されていません'); return; }

  var type = getImageType();
  var prefix = type === 'portraits' ? 'portrait' : 'insert';

  var images = splitDataUrls.map(function(dataUrl, i) {
    var num = String(i + 1).padStart(3, '0');
    var labelEl = document.getElementById('label-' + i);
    var label = labelEl ? labelEl.value : '';
    return { filename: prefix + '_' + num + '.png', dataUrl: dataUrl, label: label };
  });

  var btn = document.getElementById('btn-save');
  btn.textContent = '保存中...';
  btn.disabled = true;

  fetch('/api/save-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName: projectName, imageType: type, images: images }),
  }).then(function(res) {
    return res.json();
  }).then(function(data) {
    if (data.ok) {
      document.getElementById('result-path').textContent = data.path;
      document.getElementById('result-section').style.display = 'block';
      document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast('保存失敗: ' + (data.error || '不明なエラー'));
    }
  }).catch(function(e) {
    showToast('サーバーエラー: ' + e.message);
  }).finally(function() {
    btn.textContent = '💾 16枚に分割して保存';
    btn.disabled = false;
  });
}

function resetAll() {
  splitDataUrls = [];
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('result-section').style.display = 'none';
  var grid = document.getElementById('preview-grid');
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  document.getElementById('project-name').value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadProjects();
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 3500);
}
</script>
</body>
</html>
```

- [ ] **Step 2: ブラウザで表示確認**

```bash
open http://localhost:3001/image-splitter
```

確認：STEP 1〜3 のカードが縦並びで表示される

- [ ] **Step 3: コミット**

```bash
cd /Users/hiramatsusatoru/yuiko/auto-short-video-maker
git add image-splitter.html
git commit -m "feat: add image-splitter.html – 4x4 collage splitter UI"
```

---

## Task 3: エンドツーエンド動作テスト

**Files:** テスト用コラージュ画像（Canvas で自動生成）

- [ ] **Step 1: ブラウザコンソールでダミー4×4画像を生成してテスト**

http://localhost:3001/image-splitter を開き、STEP 1 に「テスト作品」と入力してから、コンソールで実行:

```javascript
var c = document.createElement('canvas');
c.width = 800; c.height = 800;
var ctx = c.getContext('2d');
for (var r = 0; r < 4; r++) {
  for (var col = 0; col < 4; col++) {
    var hue = (r * 4 + col) * 22;
    ctx.fillStyle = 'hsl(' + hue + ', 70%, 60%)';
    ctx.fillRect(col * 200, r * 200, 200, 200);
    ctx.fillStyle = 'black';
    ctx.font = '28px sans-serif';
    ctx.fillText(String(r * 4 + col + 1), col * 200 + 80, r * 200 + 115);
  }
}
c.toBlob(function(blob) {
  var file = new File([blob], 'test.png', { type: 'image/png' });
  handleFile(file);
}, 'image/png');
```

- [ ] **Step 2: プレビューが16マスのグリッドで表示されることを確認**

- 色分けされた正方形が 4×4 で表示される
- 各マスに 001〜016 の番号と説明テキスト入力欄がある

- [ ] **Step 3: 001に「笑顔で説明」、002に「Mac操作」と入力して保存**

「16枚に分割して保存」ボタンをクリック。完了メッセージと保存パスが表示されることを確認。

- [ ] **Step 4: 保存先ファイルを確認**

```bash
ls /Users/hiramatsusatoru/yuiko/auto-short-video-maker/projects/テスト作品/images/portraits/
cat /Users/hiramatsusatoru/yuiko/auto-short-video-maker/projects/テスト作品/images/portraits/image-list.txt
```

期待:
```
image-list.txt  portrait_001.png  portrait_002.png  ...  portrait_016.png
portrait_001.png：笑顔で説明
portrait_002.png：Mac操作
portrait_003.png：（説明を記入）
...
portrait_016.png：（説明を記入）
```

- [ ] **Step 5: コミット**

```bash
cd /Users/hiramatsusatoru/yuiko/auto-short-video-maker
git add -A
git commit -m "test: verify image-splitter end-to-end (portraits save flow)"
```

---

## Task 4: subtitle-editor.html のヘッダーにリンクを追加

**Files:**
- Modify: `subtitle-editor.html`

- [ ] **Step 1: ヘッダー内のナビゲーションに「画像分割ツール」リンクを追加する**

`subtitle-editor.html` を Read ツールで確認してヘッダーの構造を把握する。
その後、ヘッダー内の既存ボタン群の末尾に以下を追加する：

```html
<a href="/image-splitter" target="_blank"
   style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(255,255,255,0.15);color:white;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">
  🖼️ 画像分割ツール
</a>
```

- [ ] **Step 2: 確認**

```bash
open http://localhost:3001
```

ヘッダーに「🖼️ 画像分割ツール」が表示され、クリックで `/image-splitter` が新しいタブで開くことを確認。

- [ ] **Step 3: コミット**

```bash
cd /Users/hiramatsusatoru/yuiko/auto-short-video-maker
git add subtitle-editor.html
git commit -m "feat: add image-splitter link to editor header"
```

---

## Task 5: package.json にスクリプトエイリアスを追加

**Files:**
- Modify: `package.json`

- [ ] **Step 1: splitter エイリアスを scripts に追加する**

`package.json` の `"scripts"` に以下を追加する（`"editor"` の次の行）：

```json
"splitter": "tsx scripts/editor-server.ts"
```

`editor` と同じサーバーが `/image-splitter` ルートを提供するため、コマンドは同じ。
`splitter` という別名があると「画像分割ツールを起動したい」ユーザーが迷わない。

- [ ] **Step 2: 確認**

```bash
cd /Users/hiramatsusatoru/yuiko/auto-short-video-maker
cat package.json | grep -A 12 '"scripts"'
```

`"splitter"` 行が含まれることを確認。

- [ ] **Step 3: コミット**

```bash
cd /Users/hiramatsusatoru/yuiko/auto-short-video-maker
git add package.json
git commit -m "feat: add splitter alias to package.json"
```

---

## セルフレビュー

### 1. 仕様カバレッジ

| 要件 | 対応タスク |
|------|----------|
| http://localhost:3001/image-splitter で表示 | Task 1 ルート + Task 2 HTML |
| 作品名入力 | Task 2 STEP 1 |
| 既存プロジェクト候補のdatalist | Task 1 /api/projects + Task 2 datalist |
| 画像タイプ選択 (portraits/inserts) | Task 2 STEP 2 radio |
| ドラッグ&ドロップ対応ファイル選択 | Task 2 setupDropZone |
| 保存前16分割プレビュー | Task 2 renderPreview |
| 各画像に説明テキスト入力欄 | Task 2 label input |
| ファイル名 portrait_001〜016 / insert_001〜016 | Task 2 renderPreview + saveImages |
| 保存先 projects/作品名/images/portraits（または inserts） | Task 1 /api/save-images |
| image-list.txt 自動生成 | Task 1 listLines 書き出し |
| 保存完了後に保存場所を表示 | Task 2 result-section |
| public/, input/, Downloads/ には保存しない | Task 1 path.resolve('projects', ...) |
| パストラバーサル防止 | Task 1 safeName サニタイズ |
| ZIP配布標準機能（追加インストール不要） | Canvas API のみ、外部依存なし |
| 既存エディターと独立 | 独立HTML + 別ルート |
| エディターからリンク | Task 4 |
| package.json スクリプト | Task 5 |

### 2. プレースホルダースキャン: なし（全ステップにコード記載済み）

### 3. 型整合性
- `imageType: 'portraits' | 'inserts'` — Task 1 バリデーション・Task 2 送信値、一致
- `images: Array<{filename, dataUrl, label}>` — Task 1 受け取り・Task 2 送信、一致
- ファイル名生成ロジック: `renderPreview` と `saveImages` で同じ `prefix + '_' + num + '.png'` を使用
