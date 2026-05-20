import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import type { InsertEntry } from './InsertLayer';

interface Props {
  entries: InsertEntry[];
}

/**
 * image-timeline.json の各エントリに設定された sfx を
 * 画像が出現するタイミングで再生する
 */
export const InsertSoundLayer: React.FC<Props> = ({ entries }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {entries
        .filter(e => e.sfx)
        .map((entry, i) => {
          const startFrame = Math.round(entry.start * fps);
          const sfxDuration = Math.round(fps * 2.5); // 最大2.5秒
          if (sfxDuration <= 0) return null;

          return (
            <Sequence key={`insert-sfx-${i}`} from={startFrame} durationInFrames={sfxDuration}>
              <Audio src={staticFile(entry.sfx!)} volume={0.6} />
            </Sequence>
          );
        })}
    </>
  );
};
