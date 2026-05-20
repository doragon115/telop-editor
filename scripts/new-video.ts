import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'input');
const PROJECTS = path.join(ROOT, 'projects');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('\n🎬 新しい動画プロジェクトを開始します\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // 作品名の入力
  const projectName = (await ask(rl, '📝 作品名を入力してください（例：AI動画の作り方）: ')).trim();
  if (!projectName) {
    console.log('❌ 作品名が入力されていません。終了します。');
    rl.close();
    process.exit(1);
  }

  rl.close();

  // 既存 input/ を archive
  const archiveDir = path.join(PROJECTS, projectName, 'archive');
  const hasExistingTranscript = fs.existsSync(path.join(INPUT, 'transcript.json'));
  const hasExistingAudio = fs.existsSync(path.join(INPUT, 'audio'));

  if (hasExistingTranscript || hasExistingAudio) {
    console.log('\n📦 既存の input/ データをアーカイブ中...');
    ensureDir(archiveDir);

    if (hasExistingTranscript) {
      fs.copyFileSync(
        path.join(INPUT, 'transcript.json'),
        path.join(archiveDir, 'transcript.json'),
      );
      console.log('  ✅ transcript.json をアーカイブ');
    }

    const imageTimelineSrc = path.join(INPUT, 'image-timeline.json');
    if (fs.existsSync(imageTimelineSrc)) {
      fs.copyFileSync(imageTimelineSrc, path.join(archiveDir, 'image-timeline.json'));
      console.log('  ✅ image-timeline.json をアーカイブ');
    }

    const sceneMapSrc = path.join(INPUT, 'scene-map.json');
    if (fs.existsSync(sceneMapSrc)) {
      fs.copyFileSync(sceneMapSrc, path.join(archiveDir, 'scene-map.json'));
      console.log('  ✅ scene-map.json をアーカイブ');
    }

    if (hasExistingAudio) {
      const destAudio = path.join(archiveDir, 'audio');
      ensureDir(destAudio);
      for (const f of fs.readdirSync(path.join(INPUT, 'audio'))) {
        fs.copyFileSync(path.join(INPUT, 'audio', f), path.join(destAudio, f));
      }
      console.log('  ✅ audio/ をアーカイブ');
    }

    console.log(`  📁 保存先: projects/${projectName}/archive/`);
  }

  // 既存 transcript.json / image-timeline.json を削除（public/ 含む）
  const filesToClear = [
    path.join(INPUT, 'transcript.json'),
    path.join(INPUT, 'image-timeline.json'),
    path.join(INPUT, 'scene-map.json'),
    path.join(ROOT, 'public', 'transcript.json'),
    path.join(ROOT, 'public', 'image-timeline.json'),
    path.join(ROOT, 'public', 'scene-map.json'),
  ];
  for (const f of filesToClear) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  }

  // subtitles.csv も削除
  const csvPath = path.join(INPUT, 'subtitles.csv');
  if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

  // input/audio/ をクリア（ファイルのみ削除、フォルダは残す）
  const audioDir = path.join(INPUT, 'audio');
  if (fs.existsSync(audioDir)) {
    for (const f of fs.readdirSync(audioDir)) {
      fs.unlinkSync(path.join(audioDir, f));
    }
  }

  // 必要なフォルダを確認
  ensureDir(path.join(INPUT, 'audio'));
  ensureDir(path.join(INPUT, 'images'));

  console.log('\n✅ input/ をリセットしました\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 次のステップ:');
  console.log('');
  console.log('  1️⃣  音声ファイルを input/audio/ に入れる');
  console.log('      例: audio.mp3 または voice.wav');
  console.log('');
  console.log('  2️⃣  文字起こしを実行する');
  console.log('      $ npm run transcribe');
  console.log('');
  console.log('  3️⃣  アセットを準備する');
  console.log('      $ npm run prepare:assets');
  console.log('');
  console.log('  4️⃣  エディターを起動してテロップを編集');
  console.log('      $ npm run editor');
  console.log('      → ブラウザで http://localhost:3001 を開く');
  console.log('');
  console.log('  5️⃣  動画をレンダリング');
  console.log('      $ npm run render');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => {
  console.error('エラー:', e);
  process.exit(1);
});
