import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const ROOT = path.join(__dirname, '..');

async function main(): Promise<void> {
  const entryPoint = path.join(ROOT, 'src', 'index.tsx');
  const publicDir = path.join(ROOT, 'public');
  const outputDir = path.join(ROOT, 'output');

  fs.mkdirSync(outputDir, { recursive: true });

  console.log('📦 バンドル中...');
  const bundleLocation = await bundle({
    entryPoint,
    publicDir,
  });

  console.log('🎬 コンポジション情報を取得中...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'ShortVideo',
    inputProps: {},
  });

  const timestamp = new Date()
    .toISOString()
    .replace('T', '_')
    .replace(/:/g, '')
    .replace(/\..+/, '');
  const outputPath = path.join(outputDir, `short-video-${timestamp}.mp4`);

  console.log(`🎥 レンダリング中 (${composition.durationInFrames} フレーム)...`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  進捗: ${(progress * 100).toFixed(1)}%`);
    },
  });

  console.log(`\n✅ 書き出し完了: output/${path.basename(outputPath)}`);
}

main().catch(err => {
  console.error('\n❌ レンダリングエラー:', err);
  process.exit(1);
});
