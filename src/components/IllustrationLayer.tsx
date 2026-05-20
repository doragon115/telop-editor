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
import type { SceneMapEntry } from '../types/transcript';

const Illustration: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 15], [0.85, 1.0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 80,
      }}
    >
      <Img
        src={src}
        style={{
          width: '55%',
          objectFit: 'contain',
          transform: `scale(${scale})`,
          opacity,
          borderRadius: 16,
        }}
      />
    </AbsoluteFill>
  );
};

interface Props {
  sceneMap: SceneMapEntry[];
}

export const IllustrationLayer: React.FC<Props> = ({ sceneMap }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {sceneMap.map((entry, i) => {
        const startFrame = Math.round(entry.start * fps);
        const endFrame = Math.round(entry.end * fps);
        const duration = endFrame - startFrame;
        if (duration <= 0) return null;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={duration}>
            <Illustration src={staticFile(`illustrations/${entry.illustration}`)} />
          </Sequence>
        );
      })}
    </>
  );
};
