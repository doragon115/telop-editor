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

  // POST /api/import → import-csv のロジックを直接実行
  if (req.method === 'POST' && url.pathname === '/api/import') {
    try {
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
