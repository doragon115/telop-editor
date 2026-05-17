import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Segment } from '../types/transcript';

const EmphasisText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const isWindow = text.startsWith('window:');
  const displayText = isWindow ? text.replace(/^window:/, '') : text;

  const scale = interpolate(frame, [0, 5, 9], [0.62, 1.08, 1.0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, 8], [48, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: isWindow ? 760 : 0,
        paddingBottom: isWindow ? 0 : 320,
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px) scale(${scale}) rotate(${isWindow ? '-1.5deg' : '0deg'})`,
          opacity,
          fontFamily:
            '"Arial Black", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif',
          fontSize: isWindow ? 96 : 72,
          fontWeight: 900,
          color: isWindow ? '#ffffff' : '#FFE600',
          textShadow: isWindow
            ? '0 8px 0 #000000, 0 16px 22px rgba(0,0,0,0.75), 4px 4px 0 #000000'
            : '0 0 20px rgba(255,120,0,0.9), 3px 3px 0 #c05000',
          letterSpacing: 0,
          padding: isWindow ? '30px 58px 34px' : '12px 32px',
          background: isWindow
            ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,248,255,0.94) 100%)'
            : 'rgba(0,0,0,0.45)',
          border: isWindow ? '5px solid #111111' : 'none',
          borderRadius: isWindow ? 8 : 16,
          boxShadow: isWindow
            ? '0 18px 0 #111111, 0 30px 42px rgba(0,0,0,0.55)'
            : 'none',
          whiteSpace: 'pre-wrap',
          textAlign: 'center',
          maxWidth: '85%',
        }}
      >
        {isWindow ? (
          <span
            style={{
              color: '#ffffff',
              WebkitTextStroke: '5px #000000',
              paintOrder: 'stroke fill',
            }}
          >
            {displayText}
          </span>
        ) : (
          displayText
        )}
      </div>
    </AbsoluteFill>
  );
};

interface Props {
  segments: Segment[];
}

export const EmphasisLayer: React.FC<Props> = ({ segments }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {segments.map(seg => {
        if (!seg.emphasis) return null;

        const startFrame = Math.round(seg.start * fps);
        const endFrame = Math.round(seg.end * fps);
        const duration = endFrame - startFrame;
        if (duration <= 0) return null;

        return (
          <Sequence key={seg.id} from={startFrame} durationInFrames={duration}>
            <EmphasisText text={seg.emphasis} />
          </Sequence>
        );
      })}
    </>
  );
};
