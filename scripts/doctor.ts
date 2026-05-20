import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.join(__dirname, '..');
const REQUIRED_FILES = [
  'input/transcript.json',
  'config/brand.json',
  'src/index.tsx',
  'src/compositions/ShortVideo.tsx',
];
const REQUIRED_DIRS = ['input', 'public', 'assets', 'config'];

let hasError = false;

function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); }
function err(msg: string) { console.log(`  ❌ ${msg}`); hasError = true; }

function runCommand(bin: string, args: string[]): string | null {
  try {
    return execFileSync(bin, args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function isPortOpen(port: number): boolean {
  try {
    execFileSync('lsof', ['-i', `:${port}`, '-t'], { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

console.log('\n🩺 telop-editor 環境チェック\n');

// Node.js
console.log('── Node.js ──────────────────────');
const nodeVersion = process.version;
const major = parseInt(nodeVersion.replace('v', '').split('.')[0]);
if (major >= 18) {
  ok(`Node.js ${nodeVersion}`);
} else {
  err(`Node.js ${nodeVersion} — v18 以上が必要です`);
}

// npm
console.log('\n── npm ──────────────────────────');
const npmOut = runCommand('npm', ['--version']);
if (npmOut) ok(`npm ${npmOut}`);
else err('npm が見つかりません');

// node_modules
console.log('\n── node_modules ─────────────────');
if (fs.existsSync(path.join(ROOT, 'node_modules'))) {
  ok('node_modules 存在');
} else {
  err('node_modules がありません → npm install を実行してください');
}

// ffmpeg
console.log('\n── ffmpeg ───────────────────────');
const ffmpegOut = runCommand('ffmpeg', ['-version']);
if (ffmpegOut) ok('ffmpeg インストール済み');
else err('ffmpeg が見つかりません → brew install ffmpeg');

// Python + Pillow
console.log('\n── Python / Pillow ──────────────');
const pyOut = runCommand('python3', ['--version']);
if (pyOut) {
  ok(pyOut);
  const pillowOut = runCommand('python3', ['-c', 'import PIL; print(PIL.__version__)']);
  if (pillowOut) ok(`Pillow ${pillowOut}`);
  else warn('Pillow が見つかりません → pip3 install Pillow （画像分割ツールに必要）');
} else {
  warn('python3 が見つかりません → brew install python3');
}

// ディレクトリ
console.log('\n── ディレクトリ ──────────────────');
for (const dir of REQUIRED_DIRS) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) ok(dir + '/');
  else err(`${dir}/ がありません`);
}

// ファイル
console.log('\n── 必須ファイル ──────────────────');
for (const file of REQUIRED_FILES) {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) ok(file);
  else warn(`${file} がありません（動画生成前に必要）`);
}

// 音声ファイル
console.log('\n── 音声ファイル ──────────────────');
const audioDir = path.join(ROOT, 'input', 'audio');
if (fs.existsSync(audioDir)) {
  const audioFiles = fs.readdirSync(audioDir).filter(f => /\.(mp3|wav|m4a|aac)$/i.test(f));
  if (audioFiles.length > 0) ok(`input/audio/ に ${audioFiles.length} ファイル: ${audioFiles.join(', ')}`);
  else warn('input/audio/ に音声ファイルがありません');
} else {
  warn('input/audio/ フォルダがありません');
}

// BGM
console.log('\n── BGM ファイル ──────────────────');
const soundsDir = path.join(ROOT, 'public', 'sounds');
if (fs.existsSync(soundsDir)) {
  const bgmFiles = fs.readdirSync(soundsDir).filter(f => f.startsWith('bgm_'));
  if (bgmFiles.length > 0) {
    const preview = bgmFiles.slice(0, 3).join(', ') + (bgmFiles.length > 3 ? ' ...' : '');
    ok(`public/sounds/ に BGM ${bgmFiles.length} 曲: ${preview}`);
  } else {
    warn('public/sounds/ に BGM ファイルがありません（bgm_*.mp3）');
  }
} else {
  warn('public/sounds/ がありません → npm run prepare:assets を実行');
}

// 旧名称ファイル検出
console.log('\n── 旧名称チェック ────────────────');
const BANNED_NAMES: Record<string, string> = {
  'koko.png': 'coco.png',
};
const imagesDir = path.join(ROOT, 'public', 'images');
let bannedFound = false;
if (fs.existsSync(imagesDir)) {
  const walkImages = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkImages(fullPath); continue; }
      if (BANNED_NAMES[entry.name]) {
        const correct = BANNED_NAMES[entry.name];
        err(`旧名称ファイル検出: ${path.relative(ROOT, fullPath)}`);
        console.log(`     → 正しい名前: ${correct} に変更してください`);
        bannedFound = true;
      }
    }
  };
  walkImages(imagesDir);
  if (!bannedFound) ok('旧名称ファイルなし');
} else {
  warn('public/images/ フォルダがありません');
}

// 音源ファイル名チェック
console.log('\n── 音源名チェック ────────────────');
if (fs.existsSync(audioDir)) {
  const audioFiles2 = fs.readdirSync(audioDir).filter(f => /\.(mp3|wav|m4a|aac)$/i.test(f));
  if (audioFiles2.length > 1) {
    err(`input/audio/ に複数の音源ファイルがあります: ${audioFiles2.join(', ')}`);
    console.log('     → audio.mp3 だけ残して他は削除してください');
  } else if (audioFiles2.length === 1 && audioFiles2[0] !== 'audio.mp3') {
    err(`音源ファイル名が不正: ${audioFiles2[0]}`);
    console.log('     → ファイル名を「audio.mp3」に変更してください');
  } else if (audioFiles2.length === 1) {
    ok('音源ファイル: audio.mp3');
  } else {
    warn('input/audio/ に音源ファイルがありません');
  }
}

// ポート確認
console.log('\n── ポート状況 ────────────────────');
if (isPortOpen(3001)) ok('3001 → エディターサーバー起動中');
else warn('3001 未起動 → npm run editor で起動');
if (isPortOpen(3000)) ok('3000 → Remotion Studio 起動中');
else warn('3000 未起動 → npm run studio で起動（必要な場合）');

// 結果
console.log('\n' + '─'.repeat(42));
if (hasError) {
  console.log('❌ エラーがあります。上の内容を確認して修正してください。\n');
  process.exit(1);
} else {
  console.log('✅ すべてのチェック通過。動画制作を始めましょう！\n');
}
