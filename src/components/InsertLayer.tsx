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

  // 長尺ズームイン（3秒超の場合、1.0→1.06 をゆっくり）
  const scale =
    durationInFrames > ZOOM_THRESHOLD_FRAMES
      ? interpolate(frame, [0, durationInFrames], [1.0, 1.06], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1.0;

  return (
    <AbsoluteFill
      style={{
        // 上部エリアに配置。字幕（下部360px）・キャラ顔には干渉しない高さで収める
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 64,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          // 最大幅 78%・最大高さ 45% (1920px基準で864px)
          width: '78%',
          maxHeight: '45%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: 22,
          // 画像が浮き上がって見えるよう背景＋影を付ける
          background: 'rgba(0,0,0,0.18)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: 22,
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
