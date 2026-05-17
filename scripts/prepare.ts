import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const INPUT = path.join(ROOT, 'input');
const ASSETS = path.join(ROOT, 'assets');

const PLACEHOLDER_COLORS = ['4A90D9', 'E57373', '81C784', 'FFB74D'];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createPlaceholderCharImages(imagesDir: string): void {
  ensureDir(imagesDir);
  for (let i = 0; i < 4; i++) {
    const dest = path.join(imagesDir, `char${i}.jpg`);
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      const color = PLACEHOLDER_COLORS[i];
      try {
        execFileSync('ffmpeg', [
          '-y', '-f', 'lavfi',
          '-i', `color=c=0x${color}:s=540x960:r=1`,
          '-frames:v', '1',
          dest,
        ], { stdio: 'pipe' });
        console.log(`  🎨 プレースホルダー画像を生成: char${i}.jpg`);
      } catch {
        console.warn(`  ⚠️  char${i}.jpg の生成に失敗しました`);
      }
    }
  }
}

function main(): void {
  console.log('📦 input/ と assets/ を public/ にコピー中...');
  ensureDir(PUBLIC);

  copyDir(path.join(INPUT, 'audio'), path.join(PUBLIC, 'audio'));
  copyDir(path.join(INPUT, 'images'), path.join(PUBLIC, 'images'));
  copyDir(path.join(ASSETS, 'sounds'), path.join(PUBLIC, 'sounds'));
  copyDir(path.join(ASSETS, 'illustrations'), path.join(PUBLIC, 'illustrations'));

  const publicImagesDir = path.join(PUBLIC, 'images');
  createPlaceholderCharImages(publicImagesDir);

  const sceneMapSrc = path.join(INPUT, 'scene-map.json');
  const sceneMapDest = path.join(PUBLIC, 'scene-map.json');
  if (fs.existsSync(sceneMapSrc)) {
    fs.copyFileSync(sceneMapSrc, sceneMapDest);
    console.log('  ✅ scene-map.json');
  }

  const transcriptSrc = path.join(INPUT, 'transcript.json');
  const transcriptDest = path.join(PUBLIC, 'transcript.json');
  if (fs.existsSync(transcriptSrc)) {
    fs.copyFileSync(transcriptSrc, transcriptDest);
    console.log('  ✅ transcript.json');
  } else {
    console.warn('  ⚠️  input/transcript.json が見つかりません');
  }

  console.log('✅ public/ への準備が完了しました\n');
}

main();
