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

interface CharacterProps {
  src: string | null;
  characterIndex: number;
  /** 挿入画像エントリー（アクティブかどうかの判定に使用） */
  insertEntries: InsertEntry[];
  fps: number;
  /** Sequence の絶対開始フレーム（相対フレームと合算して絶対時刻を算出） */
  segmentStartFrame: number;
  /** 挿絵表示時の顔の横位置 */
  charAlign: 'left' | 'center' | 'right';
}

const Character: React.FC<CharacterProps> = ({
  src,
  characterIndex,
  insertEntries,
  fps,
  segmentStartFrame,
  charAlign,
}) => {
  const relFrame = useCurrentFrame();
  const opacity = interpolate(relFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // 絶対時刻（秒）で挿入画像が表示中かチェック
  const absSec = (segmentStartFrame + relFrame) / fps;
  const isInsertActive = insertEntries.some(e => absSec >= e.start && absSec < e.end);

  if (isInsertActive) {
    // charAlign に応じた横位置スタイル
    const alignStyle: React.CSSProperties =
      charAlign === 'right'
        ? { right: 40 }
        : charAlign === 'center'
        ? { left: '50%', transform: 'translateX(-50%)' }
        : { left: 40 }; // 'left' (デフォルト)

    // 挿入画像表示中: 下30%エリアに小さく前面表示
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            ...alignStyle,
            width: 340,
            height: 430,
            opacity,
            overflow: 'hidden',
            borderRadius: 18,
            boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
            border: '2px solid rgba(255,255,255,0.12)',
          }}
        >
          {src ? (
            <Img
              src={src}
              style={{
                // 横120%に拡大して左右の白い背景をカット、縦は上部(顔)に寄せる
                position: 'absolute',
                width: '120%',
                height: 'auto',
                left: '-10%',   // (120%-100%)/2 = センタリング
                top: '-2%',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: FALLBACK_COLORS[characterIndex % FALLBACK_COLORS.length],
              }}
            />
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // 通常モード: 大きくセンター下部に表示
  if (!src) {
    return (
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
        <div
          style={{
            width: 300,
            height: 450,
            borderRadius: 24,
            background: FALLBACK_COLORS[characterIndex % FALLBACK_COLORS.length],
            opacity,
            marginBottom: 180,
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
      <Img
        src={src}
        style={{
          height: '68%',
          objectFit: 'contain',
          opacity,
          marginBottom: 180,
        }}
      />
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
