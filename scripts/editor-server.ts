import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { runImport } from './import-csv';

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

  // GET /api/audio-files → input/audio/ または input/ の .mp3/.wav 一覧を返す
  if (req.method === 'GET' && url.pathname === '/api/audio-files') {
    const isAudio = (f: string) => f.endsWith('.mp3') || f.endsWith('.wav');
    const candidates: Array<{ file: string; dir: string }> = [];
    // input/audio/ を優先スキャン
    try {
      const d = path.resolve('input/audio');
      fs.readdirSync(d).filter(isAudio).forEach(f => candidates.push({ file: f, dir: 'audio' }));
    } catch {}
    // input/ 直下もスキャン（input/audio/ が空 or 存在しない場合の fallback）
    if (candidates.length === 0) {
      try {
        const d = path.resolve('input');
        fs.readdirSync(d).filter(isAudio).forEach(f => candidates.push({ file: f, dir: 'input' }));
      } catch {}
    }
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
