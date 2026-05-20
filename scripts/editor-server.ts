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
        const csvHeaders = ['id','start','end','text','fontSize','color','strokeColor','fontWeight','bgColor','bgOpacity','sound','posY','illustration'];
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
            seg.illustration ?? '',
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

  // POST /api/apply-volume → ffmpegで音量を音源ファイルに焼き込む
  if (req.method === 'POST' && url.pathname === '/api/apply-volume') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { volume } = JSON.parse(body);
        const v = parseFloat(volume);
        if (isNaN(v) || v <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'volume が不正' }));
          return;
        }
        const originalPath = path.resolve('public/audio/audio.mp3');
        const outputPath = path.resolve('public/sounds/audio.mp3');
        if (!fs.existsSync(originalPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'オリジナル音源が見つかりません: public/audio/audio.mp3' }));
          return;
        }
        execFile('ffmpeg', [
          '-y', '-i', originalPath,
          '-filter:a', `volume=${v}`,
          '-codec:a', 'libmp3lame', '-q:a', '2',
          outputPath,
        ], (err, _stdout, stderr) => {
          if (err) {
            console.error('ffmpeg エラー:', stderr);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: stderr }));
            return;
          }
          // transcript.json の volume を 1.0 に統一
          const inputTranscriptPath = path.resolve('input/transcript.json');
          const publicTranscriptPath = path.resolve('public/transcript.json');
          for (const p of [inputTranscriptPath, publicTranscriptPath]) {
            try {
              const t = JSON.parse(fs.readFileSync(p, 'utf-8'));
              t.volume = 1.0;
              fs.writeFileSync(p, JSON.stringify(t, null, 2), 'utf-8');
            } catch (_) {}
          }
          console.log(`✅ 音量焼き込み完了: ×${v} → public/sounds/audio.mp3`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, volume: v }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // GET /api/illustrations → public/illustrations/ の画像ファイル一覧を返す
  if (req.method === 'GET' && url.pathname === '/api/illustrations') {
    const illustDir = path.resolve('public/illustrations');
    try {
      const files = fs.readdirSync(illustDir)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .sort();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // GET /api/image-timeline → input/image-timeline.json を返す
  if (req.method === 'GET' && url.pathname === '/api/image-timeline') {
    const timelinePath = path.resolve('input/image-timeline.json');
    try {
      const data = fs.readFileSync(timelinePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // POST /api/image-timeline → input/image-timeline.json & public/image-timeline.json に保存
  if (req.method === 'POST' && url.pathname === '/api/image-timeline') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '配列形式のJSONが必要です' }));
          return;
        }
        const json = JSON.stringify(parsed, null, 2);
        fs.writeFileSync(path.resolve('input/image-timeline.json'), json, 'utf-8');
        const publicPath = path.resolve('public/image-timeline.json');
        if (fs.existsSync(path.resolve('public'))) {
          fs.writeFileSync(publicPath, json, 'utf-8');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: parsed.length }));
        console.log(`✅ image-timeline.json 保存: ${parsed.length} エントリ`);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // GET /api/insert-files → public/images/inserts/ の画像一覧を返す
  if (req.method === 'GET' && url.pathname === '/api/insert-files') {
    const insertsDir = path.resolve('public/images/inserts');
    let files: string[] = [];
    try {
      files = fs.readdirSync(insertsDir)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort();
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // GET /inserts/:file → public/images/inserts/ から画像を配信
  if (req.method === 'GET' && url.pathname.startsWith('/inserts/')) {
    const fileName = decodeURIComponent(url.pathname.slice('/inserts/'.length));
    const insertsDir = path.resolve('public/images/inserts');
    const filePath = path.resolve(insertsDir, fileName);
    if (!filePath.startsWith(insertsDir) || !fs.existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'image/png' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // GET /illustrations/:file → public/illustrations/ から画像ファイルを配信
  if (req.method === 'GET' && url.pathname.startsWith('/illustrations/')) {
    const fileName = decodeURIComponent(url.pathname.slice('/illustrations/'.length));
    const illustDir = path.resolve('public/illustrations');
    const filePath = path.resolve(illustDir, fileName);
    if (!filePath.startsWith(illustDir) || !fs.existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'image/jpeg' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // GET /api/brand → config/brand.json を返す
  if (req.method === 'GET' && url.pathname === '/api/brand') {
    const brandPath = path.resolve('config/brand.json');
    try {
      const data = fs.readFileSync(brandPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch {
      // デフォルト値を返す
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: '平松悟',
        title: '動画クリエイター',
        petImage: 'images/coco.png',
        petEnabled: true,
        characterPosition: 'left-bottom',
        sfxEnabled: true,
        brandColor: '#1a56db',
        background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }));
    }
    return;
  }

  // POST /api/brand → config/brand.json と public/config/brand.json に保存
  if (req.method === 'POST' && url.pathname === '/api/brand') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        const configDir = path.resolve('config');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'brand.json'), JSON.stringify(json, null, 2), 'utf-8');
        // public/config/ にも同期
        const publicConfigDir = path.resolve('public/config');
        if (!fs.existsSync(publicConfigDir)) fs.mkdirSync(publicConfigDir, { recursive: true });
        fs.writeFileSync(path.join(publicConfigDir, 'brand.json'), JSON.stringify(json, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('✅ brand.json 保存');
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // GET /api/char-images → public/images/ の char*.png|jpg 一覧を返す
  if (req.method === 'GET' && url.pathname === '/api/char-images') {
    const imagesDir = path.resolve('public/images');
    let files: string[] = [];
    try {
      files = fs.readdirSync(imagesDir)
        .filter(f => /^char\d+\.(png|jpg|jpeg)$/i.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)?.[0] || '0');
          const nb = parseInt(b.match(/\d+/)?.[0] || '0');
          return na - nb;
        });
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // POST /api/split-grid → グリッド画像を 4x4(16枚) または 3x3(9枚) に分割して保存
  if (req.method === 'POST' && url.pathname === '/api/split-grid') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      try {
        const { dataUrl, mode, destDir } = JSON.parse(body) as {
          dataUrl: string;
          mode: '4x4' | '3x3';
          destDir: 'inserts' | 'chars';
        };
        const base64 = dataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const imgBuf = Buffer.from(base64, 'base64');

        // Python で分割処理
        const cols = mode === '3x3' ? 3 : 4;
        const rows = mode === '3x3' ? 3 : 4;
        const count = cols * rows;
        const prefix = destDir === 'chars' ? 'char' : 'insert_';
        const ext = 'png';
        const outputDir = destDir === 'chars'
          ? path.resolve('public/images')
          : path.resolve('public/images/inserts');

        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        // 一時ファイルに書き出してPythonで分割
        const tmpInput = path.resolve('input/.tmp_grid.png');
        fs.writeFileSync(tmpInput, imgBuf);

        const { execFileSync } = require('child_process');
        const script = `
import sys
from PIL import Image
img = Image.open(sys.argv[1])
w, h = img.size
cols, rows = int(sys.argv[2]), int(sys.argv[3])
cw, ch = w // cols, h // rows
out_dir = sys.argv[4]
prefix = sys.argv[5]
pad = 3 if cols >= 4 else 1
for i in range(rows):
    for j in range(cols):
        idx = i * cols + j + 1
        cell = img.crop((j*cw, i*ch, (j+1)*cw, (i+1)*ch))
        fname = f"{out_dir}/{prefix}{str(idx).zfill(pad)}.{sys.argv[6]}"
        cell.save(fname)
        print(fname)
`;
        const result = execFileSync('python3', ['-c', script,
          tmpInput, String(cols), String(rows), outputDir, prefix, ext
        ], { encoding: 'utf-8' });

        fs.unlinkSync(tmpInput);
        const saved = result.trim().split('\n').filter(Boolean);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: saved.length, files: saved.map(f => path.basename(f)) }));
        console.log(`✅ グリッド分割 (${mode}): ${saved.length}枚 → ${outputDir}`);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // POST /api/clear-project → 選択したカテゴリのファイルを削除
  if (req.method === 'POST' && url.pathname === '/api/clear-project') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      try {
        const { clearTranscript, clearAudio, clearInserts, clearChars } = JSON.parse(body) as {
          clearTranscript: boolean;
          clearAudio: boolean;
          clearInserts: boolean;
          clearChars: boolean;
        };

        const deleted: string[] = [];

        if (clearTranscript) {
          const targets = [
            path.resolve('input/transcript.json'),
            path.resolve('input/image-timeline.json'),
            path.resolve('input/scene-map.json'),
            path.resolve('input/subtitles.csv'),
            path.resolve('public/transcript.json'),
            path.resolve('public/image-timeline.json'),
            path.resolve('public/scene-map.json'),
          ];
          for (const f of targets) {
            if (fs.existsSync(f)) { fs.unlinkSync(f); deleted.push(path.basename(f)); }
          }
        }

        if (clearAudio) {
          // input/audio/ を全消し
          const audioDir = path.resolve('input/audio');
          if (fs.existsSync(audioDir)) {
            for (const f of fs.readdirSync(audioDir)) {
              if (/\.(mp3|wav|m4a|aac)$/i.test(f)) {
                fs.unlinkSync(path.join(audioDir, f));
                deleted.push('input/audio/' + f);
              }
            }
          }
          // public/sounds/ のうち BGM・SE 以外（ユーザー音声）を削除
          const publicSoundsDir = path.resolve('public/sounds');
          if (fs.existsSync(publicSoundsDir)) {
            for (const f of fs.readdirSync(publicSoundsDir)) {
              if (/\.(mp3|wav|m4a|aac)$/i.test(f) && !/^(bgm_|se_)/.test(f)) {
                fs.unlinkSync(path.join(publicSoundsDir, f));
                deleted.push('public/sounds/' + f);
              }
            }
          }
        }

        if (clearInserts) {
          const insertsDir = path.resolve('public/images/inserts');
          if (fs.existsSync(insertsDir)) {
            for (const f of fs.readdirSync(insertsDir)) {
              if (/\.(png|jpg|jpeg|webp)$/i.test(f)) {
                fs.unlinkSync(path.join(insertsDir, f));
                deleted.push('images/inserts/' + f);
              }
            }
          }
          const inputInsertsDir = path.resolve('input/images/inserts');
          if (fs.existsSync(inputInsertsDir)) {
            for (const f of fs.readdirSync(inputInsertsDir)) {
              if (/\.(png|jpg|jpeg|webp)$/i.test(f)) {
                fs.unlinkSync(path.join(inputInsertsDir, f));
                deleted.push('input/images/inserts/' + f);
              }
            }
          }
        }

        if (clearChars) {
          const imagesDir = path.resolve('public/images');
          if (fs.existsSync(imagesDir)) {
            for (const f of fs.readdirSync(imagesDir)) {
              if (/^char\d+\.(png|jpg|jpeg)$/i.test(f)) {
                fs.unlinkSync(path.join(imagesDir, f));
                deleted.push('images/' + f);
              }
            }
          }
        }

        console.log(`🗑️  クリア完了: ${deleted.length} ファイル削除`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, deleted }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🎬 テロップエディター起動中`);
  console.log(`👉 ブラウザで開く: http://localhost:${PORT}`);
  console.log(`\n📌 ポート一覧:`);
  console.log(`   http://localhost:3001  ← テロップエディター（今ここ）`);
  console.log(`   http://localhost:3000  ← Remotion Studio（npm run studio で起動）`);
  console.log(`\nCtrl+C で停止\n`);

  // 自動でブラウザを開く
  execFile('open', [`http://localhost:${PORT}`]);
});
