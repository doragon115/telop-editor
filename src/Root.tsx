import React from 'react';
import { Composition, staticFile } from 'remotion';
import { ShortVideo, type ShortVideoProps } from './compositions/ShortVideo';
import type { Transcript } from './types/transcript';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const DEFAULT_DURATION_FRAMES = FPS * 60;

const defaultProps: Required<ShortVideoProps> = {
  characterImages: [
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
  ],
  transcriptFile: 'transcript.json',
  sceneMapFile: 'scene-map.json',
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="ShortVideo"
      component={ShortVideo}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={DEFAULT_DURATION_FRAMES}
      defaultProps={defaultProps}
      calculateMetadata={async () => {
        try {
          const res = await fetch(staticFile('transcript.json'));
          const t: Transcript = await res.json();
          const duration = t.duration ?? Math.max(...t.segments.map((s: { end: number }) => s.end));
          return { durationInFrames: Math.ceil(duration * FPS) };
        } catch {
          return { durationInFrames: DEFAULT_DURATION_FRAMES };
        }
      }}
    />
  );
};
