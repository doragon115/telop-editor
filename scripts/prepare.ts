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

// 音声ファイルを最適化して public/sounds/ に出力
// 手順: ① コンプレッサーで動的レンジを縮める → ② +20dB 増幅 → ③ alimiter で-0.3dBFS に制限
// 効果: 割れなし・声が大きくクリア・どんな収録レベルでも安定
function normalizeAudio(srcPath: string, destPath: string): void {
  ensureDir(path.dirname(destPath));
  try {
    execFileSync('ffmpeg', [
      '-y', '-i', srcPath,
      '-filter:a',
      'acompressor=threshold=-25dB:ratio=4:attack=5:release=100:makeup=10dB,volume=10dB,alimiter=level_in=1:level_out=1:limit=0.944:attack=7:release=100:level=disabled',
      '-codec:a', 'libmp3lame', '-q:a', '2',
      destPath,
    ], { stdio: 'pipe' });
    console.log(`  🔊 音声最適化完了（コンプレッサー + 増幅 + リミッター）: ${path.basename(destPath)}`);
  } catch (e) {
    console.warn(`  ⚠️  音声最適化失敗。元ファイルをそのままコピーします: ${e}`);
    fs.copyFileSync(srcPath, destPath);
  }
}

function main(): void {
  console.log('📦 input/ と assets/ を public/ にコピー中...');
  ensureDir(PUBLIC);

  // 音声ファイルは正規化しながら public/audio/ と public/sounds/ 両方に配置
  const inputAudioDir = path.join(INPUT, 'audio');
  const publicAudioDir = path.join(PUBLIC, 'audio');
  const publicSoundsDir = path.join(PUBLIC, 'sounds');
  if (fs.existsSync(inputAudioDir)) {
    ensureDir(publicAudioDir);
    ensureDir(publicSoundsDir);
    for (const file of fs.readdirSync(inputAudioDir)) {
      if (!/\.(mp3|wav|m4a|aac)$/i.test(file)) continue;
      const src = path.join(inputAudioDir, file);
      // public/audio/ には原本をコピー
      fs.copyFileSync(src, path.join(publicAudioDir, file));
      // public/sounds/ には正規化+増幅版を配置（transcript.json の audio フィールドが参照する）
      const outName = file.replace(/\.(wav|m4a|aac)$/i, '.mp3');
      normalizeAudio(src, path.join(publicSoundsDir, outName));
    }
  }

  copyDir(path.join(INPUT, 'images'), path.join(PUBLIC, 'images'));
  copyDir(path.join(ASSETS, 'sounds'), path.join(PUBLIC, 'sounds'));
  copyDir(path.join(ASSETS, 'illustrations'), path.join(PUBLIC, 'illustrations'));

  // 挿入画像（image-timeline.json 参照の画像群）
  const inputInsertsDir = path.join(INPUT, 'images', 'inserts');
  const publicInsertsDir = path.join(PUBLIC, 'images', 'inserts');
  if (fs.existsSync(inputInsertsDir)) {
    copyDir(inputInsertsDir, publicInsertsDir);
    console.log('  ✅ images/inserts/');
  }

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

  const imageTimelineSrc = path.join(INPUT, 'image-timeline.json');
  const imageTimelineDest = path.join(PUBLIC, 'image-timeline.json');
  if (fs.existsSync(imageTimelineSrc)) {
    fs.copyFileSync(imageTimelineSrc, imageTimelineDest);
    console.log('  ✅ image-timeline.json');
  }

  // brand.json を config/ から public/config/ にコピー
  const brandSrc = path.join(ROOT, 'config', 'brand.json');
  const publicConfigDir = path.join(PUBLIC, 'config');
  if (fs.existsSync(brandSrc)) {
    ensureDir(publicConfigDir);
    fs.copyFileSync(brandSrc, path.join(publicConfigDir, 'brand.json'));
    console.log('  ✅ config/brand.json');
  }

  console.log('✅ public/ への準備が完了しました\n');
}

main();
