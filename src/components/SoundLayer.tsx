import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import type { Segment } from '../types/transcript';

interface Props {
  segments: Segment[];
}

export const SoundLayer: React.FC<Props> = ({ segments }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {segments
        .filter((seg): seg is Segment & { sound: string } => seg.sound != null)
        .map(seg => {
          const startFrame = Math.round(seg.start * fps);
          const segEndFrame = Math.round(seg.end * fps);
          // 効果音はセグメント長に収める（最大3秒）
          const soundDuration = Math.min(Math.round(fps * 3), segEndFrame - startFrame);
          if (soundDuration <= 0) return null;

          return (
            <Sequence key={`sound-${seg.id}`} from={startFrame} durationInFrames={soundDuration}>
              <Audio src={staticFile(seg.sound)} volume={0.65} />
            </Sequence>
          );
        })}
    </>
  );
};
