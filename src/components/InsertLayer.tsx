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

export interface InsertEntry {
  file: string;   // path relative to public/, e.g. "images/inserts/insert_001.png"
  start: number;  // seconds
  end: number;    // seconds
  note?: string;  // human-readable description (ignored in rendering)
}

const FADE_FRAMES = 6; // 0.2秒 @ 30fps
const ZOOM_THRESHOLD_FRAMES = 90; // 3秒以上の表示でズームイン

interface InsertImageProps {
  src: string;
  durationInFrames: number;
}

const InsertImage: React.FC<InsertImageProps> = ({ src, durationInFrames }) => {
  const frame = useCurrentFrame();

  // フェードイン（最初0.2秒）・フェードアウト（最後0.2秒）
  const fadeIn = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - FADE_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // 長尺ズームイン（3秒超の場合、1.0→1.04 をゆっくり）
  const scale =
    durationInFrames > ZOOM_THRESHOLD_FRAMES
      ? interpolate(frame, [0, durationInFrames], [1.0, 1.04], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1.0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* 上70%を全面使って挿入画像を表示 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '70%',
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          overflow: 'hidden',
          background: '#0d0d1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

interface Props {
  entries: InsertEntry[];
}

export const InsertLayer: React.FC<Props> = ({ entries }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {entries.map((entry, i) => {
        const startFrame = Math.round(entry.start * fps);
        const endFrame = Math.round(entry.end * fps);
        const duration = endFrame - startFrame;
        if (duration <= 0) return null;

        const src = staticFile(entry.file);

        return (
          <Sequence key={i} from={startFrame} durationInFrames={duration}>
            <InsertImage src={src} durationInFrames={duration} />
          </Sequence>
        );
      })}
    </>
  );
};
