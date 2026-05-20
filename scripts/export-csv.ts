import fs from 'fs';
import path from 'path';

const transcriptPath = path.join('public', 'transcript.json');
const outputPath = path.join('input', 'subtitles.csv');

const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));

const rows = [
  ['id', 'start', 'end', 'text', 'fontSize', 'color', 'strokeColor', 'fontWeight', 'bgColor', 'bgOpacity', 'sound', 'posY'],
];

for (const seg of transcript.segments) {
  rows.push([
    seg.id,
    seg.start,
    seg.end,
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

const csv = rows
  .map(row =>
    row.map(v => {
      const str = String(v);
      return str.includes(',') || str.includes('\n') || str.includes('"')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  )
  .join('\n');

fs.writeFileSync(outputPath, csv, 'utf-8');
console.log(`✅ エクスポート完了: ${outputPath}`);
console.log(`📊 ${transcript.segments.length} 件のテロップを書き出しました`);
