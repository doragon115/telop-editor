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
import { SoundLayer } from '../components/SoundLayer';
import { SubtitleLayer } from '../components/SubtitleLayer';

export interface ShortVideoProps {
  characterImages?: string[];
  transcriptFile?: string;
  sceneMapFile?: string;
}

const DEFAULT_CHAR_IMAGES = [
  'images/char0.jpg',
  'images/char1.jpg',
  'images/char2.jpg',
  'images/char3.jpg',
  'images/char4.jpg',
  'images/char5.jpg',
  'images/char6.jpg',
  'images/char7.jpg',
  'images/char8.jpg',
  'images/char9.jpg',
  'images/char10.jpg',
  'images/char11.jpg',
  'images/char12.jpg',
  'images/char13.jpg',
  'images/char14.jpg',
  'images/char15.jpg',
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
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [sceneMap, setSceneMap] = useState<SceneMapEntry[]>([]);
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

    Promise.all([loadTranscript, loadSceneMap]).then(() => continueRender(handle));
  }, [handle, transcriptFile, sceneMapFile]);

  if (!transcript) return null;

  const totalFrames = Math.ceil(transcript.duration * fps);
  const fadeStartFrame = totalFrames - 3 * fps; // 最後3秒でフェードアウト
  const bgmVolume = interpolate(frame, [fadeStartFrame, totalFrames], [0.08, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      <Audio src={staticFile(transcript.audio)} volume={1.4} />
      {(transcript.bgm || 'sounds/bgm_morning.mp3') && (
        <Audio src={staticFile(transcript.bgm || 'sounds/bgm_morning.mp3')} volume={bgmVolume} />
      )}

      {/* 描画順: キャラ → 挿絵 → 強調テロップ → 字幕 */}
      <CharacterLayer segments={transcript.segments} characterImages={characterImages} />
      <IllustrationLayer sceneMap={sceneMap} />

      <EmphasisLayer segments={transcript.segments} />
      <SubtitleLayer segments={transcript.segments} />
      <BrandingTag />

      <SoundLayer segments={transcript.segments} />
    </AbsoluteFill>
  );
};
