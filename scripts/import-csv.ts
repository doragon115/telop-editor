import fs from 'fs';
import path from 'path';

const csvPath = path.join('input', 'subtitles.csv');
const transcriptPath = path.join('input', 'transcript.json');

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* skip */ }
      else { cell += ch; }
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function applyStyle(seg: any, row: Record<string, string>) {
  seg.text = row['text'];
  seg.start = Number(row['start']);
  seg.end = Number(row['end']);

  // 効果音: 空文字→null、それ以外はパスをそのまま保存
  const sound = row['sound'] ?? '';
  seg.sound = sound.trim() === '' ? null : sound.trim();

  // 縦位置: 空文字→フィールド削除（デフォルト360px使用）
  const posYRaw = row['posY'] ?? '';
  if (posYRaw.trim() === '') {
    delete seg.posY;
  } else {
    seg.posY = Number(posYRaw);
  }

  const fontSize = Number(row['fontSize']) || 68;
  const color = row['color'] || '#ffffff';
  const strokeColor = row['strokeColor'] || '#000000';
  const fontWeight = Number(row['fontWeight']) || 900;
  const bgColor = row['bgColor'] ?? '';
  const bgOpacity = Number(row['bgOpacity'] ?? 80);

  const isDefault =
    fontSize === 68 && color === '#ffffff' && strokeColor === '#000000' &&
    fontWeight === 900 && bgColor === '';

  if (isDefault) {
    delete seg.style;
  } else {
    seg.style = {
      fontSize, color, strokeColor, fontWeight,
      ...(bgColor ? { bgColor, bgOpacity } : {}),
    };
  }
}

export function runImport(): { log: string } {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(csv);
  const headers = rows[0];

  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));

  const csvMap = new Map<number, Record<string, string>>();
  for (const row of rows.slice(1)) {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    csvMap.set(Number(obj['id']), obj);
  }

  // 既存セグメントのIDセット
  const existingIds = new Set<number>(transcript.segments.map((s: any) => s.id));

  // 既存セグメントを更新
  for (const seg of transcript.segments) {
    const row = csvMap.get(seg.id);
    if (!row) continue;
    applyStyle(seg, row);
  }

  // CSVにあってtranscriptにないIDは新規セグメントとして追加
  let newCount = 0;
  for (const [id, row] of csvMap) {
    if (existingIds.has(id)) continue;
    const seg: any = { id, start: 0, end: 5, text: '', sound: null };
    applyStyle(seg, row);
    transcript.segments.push(seg);
    newCount++;
  }

  // start順にソート
  transcript.segments.sort((a: any, b: any) => a.start - b.start);

  // duration を最大 end 時刻に合わせて自動更新
  const maxEnd = Math.max(...transcript.segments.map((s: any) => s.end));
  transcript.duration = maxEnd;

  // input と public の両方に書き出す
  const publicTranscriptPath = 'public/transcript.json';
  fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), 'utf-8');
  fs.writeFileSync(publicTranscriptPath, JSON.stringify(transcript, null, 2), 'utf-8');

  const lines = [
    '✅ インポート完了: transcript.json を更新しました（input + public）',
    ...(newCount > 0 ? [`➕ 新規セグメント ${newCount} 件を追加しました`] : []),
    `⏱️  動画長: ${maxEnd}s`,
  ];
  return { log: lines.join('\n') };
}

// スクリプトとして直接実行された場合（import されたときは実行しない）
const isMain = process.argv[1]?.endsWith('import-csv.ts') || process.argv[1]?.endsWith('import-csv.js');
if (isMain) {
  const { log } = runImport();
  console.log(log);
  console.log('📝 次は npm run render でレンダリングしてください');
}
