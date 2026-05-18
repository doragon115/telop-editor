import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { runImport } from './import-csv';

// Remotion Studio の起動状態管理
let studioProcess: ReturnType<typeof spawn> | null = null;

const PORT = 3001;
const CSV_PATH = path.resolve('input/subtitles.csv');
const HTML_PATH = path.resolve('subtitle-editor.html');

const server = http.createServer((req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);

  // CORS ヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  // GET /api/csv → CSVを返す
  if (req.method === 'GET' && url.pathname === '/api/csv') {
    try {
      const csv = fs.readFileSync(CSV_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
      res.end(csv);
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'subtitles.csv not found. Run export:csv first.' }));
    }
    return;
  }

  // POST /api/csv → CSVを保存
  if (req.method === 'POST' && url.pathname === '/api/csv') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        fs.writeFileSync(CSV_PATH, body, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log(`💾 保存: ${CSV_PATH}`);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // POST /api/import → import-csv のロジックを直接実行（保存前に transcript.json をバックアップ）
  if (req.method === 'POST' && url.pathname === '/api/import') {
    try {
      // バックアップ作成
      const inputTranscript = path.resolve('input/transcript.json');
      if (fs.existsSync(inputTranscript)) {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
        const backupPath = path.resolve(`input/transcript.backup-${stamp}.json`);
        fs.copyFileSync(inputTranscript, backupPath);
        console.log(`📦 バックアップ: transcript.backup-${stamp}.json`);
      }
      const result = runImport();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, log: result.log }));
      console.log(`✅ import完了:\n${result.log}`);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
      console.error(`❌ import失敗: ${e}`);
    }
    return;
  }

  // GET / → HTMLを返す
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    try {
      const html = fs.readFileSync(HTML_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(404); res.end('subtitle-editor.html not found');
    }
    return;
  }

  // GET /api/audio-files → input/audio/ を優先、なければ input/ 直下も返す
  if (req.method === 'GET' && url.pathname === '/api/audio-files') {
    const isAudio = (f: string) => f.endsWith('.mp3') || f.endsWith('.wav');
    const candidates: Array<{ file: string; dir: string }> = [];
    // input/audio/ を優先スキャン
    try {
      const d = path.resolve('input/audio');
      fs.readdirSync(d).filter(isAudio).forEach(f => candidates.push({ file: f, dir: 'audio' }));
    } catch {}
    // input/ 直下もスキャン（フォールバック）
    try {
      const d = path.resolve('input');
      fs.readdirSync(d).filter(isAudio).forEach(f => candidates.push({ file: f, dir: 'input' }));
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(candidates));
    return;
  }

  // GET /audio/:file → input/audio/ または input/ から音声ファイルをストリーム配信
  if (req.method === 'GET' && url.pathname.startsWith('/audio/')) {
    const fileName = decodeURIComponent(url.pathname.slice('/audio/'.length));
    // input/audio/ を優先、なければ input/ 直下も探す
    const searchDirs = [path.resolve('input/audio'), path.resolve('input')];
    let found: string | null = null;
    for (const dir of searchDirs) {
      const candidate = path.resolve(dir, fileName);
      if (candidate.startsWith(dir) && fs.existsSync(candidate)) {
        found = candidate; break;
      }
    }
    if (!found) { res.writeHead(404); res.end('Audio file not found'); return; }
    try {
      const stat = fs.statSync(found);
      const ext = path.extname(fileName).toLowerCase();
      const mime = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
      fs.createReadStream(found).pipe(res);
    } catch {
      res.writeHead(404); res.end('Audio file not found');
    }
    return;
  }

  // GET /api/transcript → input/transcript.json を返す（なければ input/ を自動スキャン）
  if (req.method === 'GET' && url.pathname === '/api/transcript') {
    const transcriptPath = path.resolve('input/transcript.json');
    // transcript.json が存在すればそのまま返す
    if (fs.existsSync(transcriptPath)) {
      try {
        const data = fs.readFileSync(transcriptPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'read error' }));
      }
      return;
    }
    // なければ input/ 内の *.json を自動スキャンして segments があるものを使用
    try {
      const inputDir = path.resolve('input');
      const jsonFiles = fs.readdirSync(inputDir).filter(f =>
        f.endsWith('.json') &&
        f !== 'scene-map.json' &&
        !f.startsWith('transcript.backup')
      );
      for (const f of jsonFiles) {
        const fp = path.resolve(inputDir, f);
        try {
          const content = fs.readFileSync(fp, 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed.segments && Array.isArray(parsed.segments)) {
            fs.copyFileSync(fp, transcriptPath);
            console.log(`🔍 自動検出: ${f} → transcript.json にコピー`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(content);
            return;
          }
        } catch {}
      }
    } catch {}
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'transcript.json not found' }));
    return;
  }

  // POST /api/transcript → transcript.json を保存し、subtitles.csv も自動生成
  if (req.method === 'POST' && url.pathname === '/api/transcript') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (!json.segments || !Array.isArray(json.segments)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'segments が見つかりません' }));
          return;
        }
        // transcript.json 保存
        const transcriptPath = path.resolve('input/transcript.json');
        fs.writeFileSync(transcriptPath, JSON.stringify(json, null, 2), 'utf-8');
        // subtitles.csv 自動生成
        const csvHeaders = ['id','start','end','text','fontSize','color','strokeColor','fontWeight','bgColor','bgOpacity','sound','posY'];
        const csvRows: (string | number)[][] = [csvHeaders];
        for (const seg of json.segments) {
          csvRows.push([
            seg.id ?? '',
            seg.start ?? 0,
            seg.end ?? 0,
            seg.text ?? '',
            seg.style?.fontSize ?? 68,
            seg.style?.color ?? '#ffffff',
            seg.style?.strokeColor ?? '#000000',
            seg.style?.fontWeight ?? 900,
            seg.style?.bgColor ?? '',
            seg.style?.bgOpacity ?? 80,
            seg.sound ?? '',
            seg.posY ?? '',
          ]);
        }
        const esc = (v: string | number) => {
          const s = String(v);
          return (s.includes(',') || s.includes('\n') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = csvRows.map(r => r.map(esc).join(',')).join('\n');
        fs.writeFileSync(CSV_PATH, csv, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: json.segments.length }));
        console.log(`✅ transcript.json + subtitles.csv 自動生成: ${json.segments.length} セグメント`);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // GET /api/bgm-files → public/sounds/ の bgm_*.mp3|wav 一覧を返す
  if (req.method === 'GET' && url.pathname === '/api/bgm-files') {
    const soundsDir = path.resolve('public/sounds');
    let bgmFiles: string[] = [];
    try {
      bgmFiles = fs.readdirSync(soundsDir).filter(f =>
        /^bgm_.*\.(mp3|wav)$/i.test(f)
      ).sort();
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(bgmFiles));
    return;
  }

  // GET /sounds/:file → public/sounds/ から効果音ファイルを配信
  if (req.method === 'GET' && url.pathname.startsWith('/sounds/')) {
    const fileName = decodeURIComponent(url.pathname.slice('/sounds/'.length));
    const soundsDir = path.resolve('public/sounds');
    const filePath = path.resolve(soundsDir, fileName);
    if (!filePath.startsWith(soundsDir) || !fs.existsSync(filePath)) {
      res.writeHead(404); res.end('Sound not found'); return;
    }
    const ext = path.extname(fileName).toLowerCase();
    const mime = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
    const stat = fs.statSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

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
      // projects/ が存在しない場合は空配列
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(projects));
    return;
  }

  // POST /api/save-images → 16枚のPNGをprojects/配下に保存
  // Body: { projectName, imageType: 'portraits'|'inserts', images: [{filename, dataUrl, label}] }
  if (req.method === 'POST' && url.pathname === '/api/save-images') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
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
        // パストラバーサル防止
        const safeName = projectName.trim().replace(/[/\\:*?"<>|]/g, '_');
        const dir = path.resolve('projects', safeName, 'images', imageType);
        fs.mkdirSync(dir, { recursive: true });
        for (const { filename, dataUrl } of images) {
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
          fs.writeFileSync(path.join(dir, filename), Buffer.from(base64, 'base64'));
        }
        // image-list.txt
        const listLines = images.map(({ filename, label }) =>
          `${filename}：${label && label.trim() ? label.trim() : '（説明を記入）'}`
        );
        fs.writeFileSync(path.join(dir, 'image-list.txt'), listLines.join('\n'), 'utf-8');
        const relativePath = `projects/${safeName}/images/${imageType}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: relativePath, count: images.length }));
        console.log(`✅ 画像保存: ${relativePath} (${images.length}枚)`);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // GET /api/studio-status → port 3000 が応答中か確認
  if (req.method === 'GET' && url.pathname === '/api/studio-status') {
    const check = http.get({ hostname: 'localhost', port: 3000, path: '/', timeout: 1000 }, (r) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running: true, statusCode: r.statusCode }));
    });
    check.on('error', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running: false }));
    });
    check.on('timeout', () => {
      check.destroy();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running: false }));
    });
    return;
  }

  // POST /api/studio-start → Remotion Studio を起動
  if (req.method === 'POST' && url.pathname === '/api/studio-start') {
    if (studioProcess && !studioProcess.killed) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'すでに起動中' }));
      return;
    }
    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      studioProcess = spawn(npmCmd, ['run', 'studio'], {
        cwd: path.resolve('.'),
        stdio: 'ignore',
        detached: false,
      });
      studioProcess.on('exit', () => { studioProcess = null; });
      console.log('🎬 Remotion Studio 起動中...');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: '起動しました（数秒お待ちください）' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🎬 テロップエディター起動中`);
  console.log(`👉 ブラウザで開く: http://localhost:${PORT}`);
  console.log(`📄 CSV: ${CSV_PATH}`);
  console.log(`\nCtrl+C で停止\n`);

  // 自動でブラウザを開く
  execFile('open', [`http://localhost:${PORT}`]);
});
