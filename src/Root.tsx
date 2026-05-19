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
    'images/char0.png',
    'images/char1.png',
    'images/char2.png',
    'images/char3.png',
    'images/char4.png',
    'images/char5.png',
    'images/char6.png',
    'images/char7.png',
    'images/char8.png',
    'images/char9.png',
    'images/char10.png',
    'images/char11.png',
    'images/char12.png',
    'images/char13.png',
    'images/char14.png',
    'images/char15.png',
    'images/char16.jpg',
    'images/char17.jpg',
    'images/char18.jpg',
    'images/char19.jpg',
  ],
  transcriptFile: 'transcript.json',
  sceneMapFile: 'scene-map.json',
  imageTimelineFile: 'image-timeline.json',
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
