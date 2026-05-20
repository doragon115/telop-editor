import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Segment } from '../types/transcript';
import type { InsertEntry } from './InsertLayer';

const FALLBACK_COLORS = ['#4A90D9', '#E57373', '#81C784', '#FFB74D'];

// キャラ: 字幕ゾーン(下から360px)より下に収まるサイズ
// 下端60px + 高さ280px = 上端340px from bottom → 字幕下端360pxより下 ✓
const CHAR_WIDTH = 200;
const CHAR_HEIGHT = 280;
const CHAR_BOTTOM = 60;
const CHAR_LEFT = 24;

interface CharacterProps {
  src: string | null;
  characterIndex: number;
  /** 挿入画像エントリー（アクティブかどうかの判定に使用） */
  insertEntries: InsertEntry[];
  fps: number;
  /** Sequence の絶対開始フレーム（相対フレームと合算して絶対時刻を算出） */
  segmentStartFrame: number;
  /** charAlign は将来対応用（現在は左下固定） */
  charAlign: 'left' | 'center' | 'right';
}

const Character: React.FC<CharacterProps> = ({
  src,
  characterIndex,
}) => {
  const relFrame = useCurrentFrame();
  const opacity = interpolate(relFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  // フォールバック（画像なし）
  if (!src) {
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            bottom: CHAR_BOTTOM,
            left: CHAR_LEFT,
            width: CHAR_WIDTH,
            height: CHAR_HEIGHT,
            borderRadius: 18,
            background: FALLBACK_COLORS[characterIndex % FALLBACK_COLORS.length],
            opacity,
          }}
        />
      </AbsoluteFill>
    );
  }

  // 常に左下固定・サイズ固定
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          bottom: CHAR_BOTTOM,
          left: CHAR_LEFT,
          width: CHAR_WIDTH,
          height: CHAR_HEIGHT,
          opacity,
          overflow: 'hidden',
          borderRadius: 18,
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          border: '2px solid rgba(255,255,255,0.10)',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            display: 'block',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

interface Props {
  segments: Segment[];
  characterImages: string[];
  insertEntries?: InsertEntry[];
  charAlign?: 'left' | 'center' | 'right';
}

export const CharacterLayer: React.FC<Props> = ({
  segments,
  characterImages,
  insertEntries = [],
  charAlign = 'left',
}) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {segments.map(seg => {
        const startFrame = Math.round(seg.start * fps);
        const endFrame = Math.round(seg.end * fps);
        const duration = endFrame - startFrame;
        if (duration <= 0) return null;

        const rawPath = characterImages[seg.character] ?? characterImages[0];
        const imgSrc = rawPath ? staticFile(rawPath) : null;
        return (
          <Sequence key={seg.id} from={startFrame} durationInFrames={duration}>
            <Character
              src={imgSrc}
              characterIndex={seg.character}
              insertEntries={insertEntries}
              fps={fps}
              segmentStartFrame={startFrame}
              charAlign={charAlign}
            />
          </Sequence>
        );
      })}
    </>
  );
};
