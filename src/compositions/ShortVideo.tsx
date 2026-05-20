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
// disabled
// disabled
import { SubtitleLayer } from '../components/SubtitleLayer';

export interface ShortVideoProps {
  characterImages?: string[];
  transcriptFile?: string;
  sceneMapFile?: string;
  imageTimelineFile?: string;
}

export interface BrandConfig {
  name: string;
  title: string;
  petImage: string;
  petEnabled: boolean;
  characterPosition: string;
  sfxEnabled: boolean;
  brandColor: string;
  background: string;
}

const DEFAULT_BRAND: BrandConfig = {
  name: '平松悟',
  title: '動画クリエイター',
  petImage: 'images/coco.png',
  petEnabled: true,
  characterPosition: 'left-bottom',
  sfxEnabled: true,
  brandColor: '#1a56db',
  background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
};

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

interface BrandingTagProps {
  brand: BrandConfig;
}

const BrandingTag: React.FC<BrandingTagProps> = ({ brand }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        right: 36,
        background: '#ffffff',
        borderRadius: 13,
        padding: '28px 48px 28px 48px',
        overflow: 'visible',
      }}
    >
      {brand.petEnabled && brand.petImage && (
        <Img
          src={staticFile(brand.petImage)}
          style={{
            position: 'absolute',
            width: 221,
            height: 240,
            objectFit: 'fill',
            bottom: 110,
            right: -10,
            zIndex: 10,
          }}
        />
      )}
      <span
        style={{
          display: 'block',
          color: brand.brandColor,
          fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif',
          fontWeight: 'bold',
          fontSize: 45,
          letterSpacing: 2,
        }}
      >
        {brand.name}
      </span>
      <span
        style={{
          display: 'block',
          color: brand.brandColor,
          fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif',
          fontWeight: 'bold',
          fontSize: 45,
          letterSpacing: 1,
        }}
      >
        {brand.title}
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
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
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

    const loadBrand = fetch(staticFile('config/brand.json'))
      .then(r => r.json())
      .then((data: Partial<BrandConfig>) => setBrand({ ...DEFAULT_BRAND, ...data }))
      .catch(() => {}); // brand.json がなければデフォルトを使用

    Promise.all([loadTranscript, loadSceneMap, loadImageTimeline, loadBrand]).then(() => continueRender(handle));
  }, [handle, transcriptFile, sceneMapFile, imageTimelineFile]);

  if (!transcript) return null;

  const totalFrames = Math.ceil(transcript.duration * fps);
  const fadeStartFrame = totalFrames - 3 * fps;

  const bgmBaseVolume = transcript.bgmVolume ?? 0.07;
  const bgmVolume = interpolate(frame, [fadeStartFrame, totalFrames], [bgmBaseVolume, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const voiceVolume = transcript.volume ?? 1.0;

  return (
    <AbsoluteFill
      style={{
        background: brand.background,
      }}
    >
      <Audio src={staticFile(transcript.audio)} volume={voiceVolume} />
      {(transcript.bgm || 'sounds/bgm_morning.mp3') && (
        <Audio src={staticFile(transcript.bgm || 'sounds/bgm_morning.mp3')} volume={bgmVolume} />
      )}

      {/* 描画順: 挿入画像 → キャラ → IllustrationLayer → ブランド(字幕より下) → 字幕(最前面) */}
      <InsertLayer entries={insertEntries} />

      <CharacterLayer segments={transcript.segments} characterImages={characterImages} insertEntries={insertEntries} charAlign={transcript.charAlign ?? 'left'} />
      <IllustrationLayer sceneMap={sceneMap} />
      <EmphasisLayer segments={transcript.segments} />
      {/* BrandingTag を SubtitleLayer より前に描画 → 字幕が上に乗り文字を隠さない */}
      <BrandingTag brand={brand} />
      <SubtitleLayer segments={transcript.segments} />

      
    </AbsoluteFill>
  );
};
