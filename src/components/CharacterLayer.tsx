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

const FALLBACK_COLORS = ['#4A90D9', '#E57373', '#81C784', '#FFB74D'];

interface CharacterProps {
  src: string | null;
  characterIndex: number;
}

const Character: React.FC<CharacterProps> = ({ src, characterIndex }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

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
}

export const CharacterLayer: React.FC<Props> = ({ segments, characterImages }) => {
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
            <Character src={imgSrc} characterIndex={seg.character} />
          </Sequence>
        );
      })}
    </>
  );
};
