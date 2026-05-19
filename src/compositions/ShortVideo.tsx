import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Transcript, SceneMapEntry } from '../types/transcript';
import { CharacterLayer } from '../components/CharacterLayer';
import { EmphasisLayer } from '../components/EmphasisLayer';
import { IllustrationLayer } from '../components/IllustrationLayer';
import { InsertLayer, type InsertEntry } from '../components/InsertLayer';
import { SoundLayer } from '../components/SoundLayer';
import { SubtitleLayer } from '../components/SubtitleLayer';

export interface ShortVideoProps {
  characterImages?: string[];
  transcriptFile?: string;
  sceneMapFile?: string;
  imageTimelineFile?: string;
}

const DEFAULT_CHAR_IMAGES = [
  'images/char0.png',
  'images/char1.png',
  'images/char2.png',
  'images/char3.png',
  'images/char4.png',
  'images/char5.png',
  'images/char6.png',
  'images/char7.png',
  'images/char8.png',
  'images/char9.png',
  'images/char10.png',
  'images/char11.png',
  'images/char12.png',
  'images/char13.png',
  'images/char14.png',
  'images/char15.png',
  'images/char16.jpg',
  'images/char17.jpg',
  'images/char18.jpg',
  'images/char19.jpg',
];

const BrandingTag: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        right: 36,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        background: '#ffffff',
        borderRadius: 13,
        padding: '32px 51px',
        overflow: 'visible',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <span
          style={{
            color: '#1a56db',
            fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif',
            fontWeight: 'bold',
            fontSize: 45,
            letterSpacing: 2,
          }}
        >
          平松悟
        </span>
        <Img
          src={staticFile('images/koko.png')}
          style={{ width: 160, height: 160, objectFit: 'contain', marginTop: -110 }}
        />
      </div>
      <span
        style={{
          color: '#1a56db',
          fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif',
          fontWeight: 'bold',
          fontSize: 45,
          letterSpacing: 1,
        }}
      >
        動画クリエイター
      </span>
    </div>
  </AbsoluteFill>
);


export const ShortVideo: React.FC<ShortVideoProps> = ({
  characterImages = DEFAULT_CHAR_IMAGES,
  transcriptFile = 'transcript.json',
  sceneMapFile = 'scene-map.json',
  imageTimelineFile = 'image-timeline.json',
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [sceneMap, setSceneMap] = useState<SceneMapEntry[]>([]);
  const [insertEntries, setInsertEntries] = useState<InsertEntry[]>([]);
  const [handle] = useState(() => delayRender('データ読み込み中'));

  useEffect(() => {
    const loadTranscript = fetch(staticFile(transcriptFile))
      .then(r => r.json())
      .then((data: Transcript) => setTranscript(data))
      .catch(err => console.error('transcript.json 読み込み失敗:', err));

    const loadSceneMap = fetch(staticFile(sceneMapFile))
      .then(r => r.json())
      .then((data: any) => setSceneMap(Array.isArray(data) ? data : []))
      .catch(() => setSceneMap([]));

    const loadImageTimeline = fetch(staticFile(imageTimelineFile))
      .then(r => r.json())
      .then((data: any) => setInsertEntries(Array.isArray(data) ? data : []))
      .catch(() => setInsertEntries([]));

    Promise.all([loadTranscript, loadSceneMap, loadImageTimeline]).then(() => continueRender(handle));
  }, [handle, transcriptFile, sceneMapFile, imageTimelineFile]);

  if (!transcript) return null;

  const totalFrames = Math.ceil(transcript.duration * fps);
  const fadeStartFrame = totalFrames - 3 * fps; // 最後3秒でフェードアウト

  // BGM音量: 声に対して自動バランス（デフォルト0.07 = 声の約1/14）
  // 最後3秒でフェードアウト
  const bgmBaseVolume = transcript.bgmVolume ?? 0.07;
  const bgmVolume = interpolate(frame, [fadeStartFrame, totalFrames], [bgmBaseVolume, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 声の音量: prepare.ts で自動正規化済みのため 1.0 を基本とする
  // transcript.volume が未設定なら 1.0（正規化+3倍増幅済みファイルをそのまま使う）
  const voiceVolume = transcript.volume ?? 1.0;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      <Audio src={staticFile(transcript.audio)} volume={voiceVolume} />
      {(transcript.bgm || 'sounds/bgm_morning.mp3') && (
        <Audio src={staticFile(transcript.bgm || 'sounds/bgm_morning.mp3')} volume={bgmVolume} />
      )}

      {/* 描画順: キャラ → 挿入画像 → 挿絵 → 強調テロップ → 字幕 */}
      <CharacterLayer segments={transcript.segments} characterImages={characterImages} />
      {/* image-timeline.json からの挿入画像（チュートリアル画像等） */}
      <InsertLayer entries={insertEntries} />
      <IllustrationLayer sceneMap={sceneMap} segments={transcript.segments} />

      <EmphasisLayer segments={transcript.segments} />
      <SubtitleLayer segments={transcript.segments} />
      <BrandingTag />

      <SoundLayer segments={transcript.segments} />
    </AbsoluteFill>
  );
};
