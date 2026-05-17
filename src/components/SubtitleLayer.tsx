import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Segment } from '../types/transcript';

interface SubtitleStyle {
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  fontWeight?: number;
  bgColor?: string;
  bgOpacity?: number;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface SubtitleProps {
  text: string;
  durationInFrames: number;
  style?: SubtitleStyle;
  posY?: number;
}

const Subtitle: React.FC<SubtitleProps> = ({ text, durationInFrames, style, posY }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: `0 56px ${posY ?? 360}px`,
      }}
    >
      <div
        style={{
          opacity,
          maxWidth: 940,
          filter: 'drop-shadow(0 14px 12px rgba(0,0,0,0.55))',
        }}
      >
        <p
          style={{
            fontFamily:
              '"Arial Black", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif',
            fontSize: style?.fontSize ?? 68,
            fontWeight: style?.fontWeight ?? 900,
            color: style?.color ?? '#ffffff',
            textAlign: 'center',
            lineHeight: 1.18,
            margin: 0,
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            WebkitTextStroke: style?.strokeColor === 'transparent'
              ? '0px transparent'
              : `5px ${style?.strokeColor ?? '#000000'}`,
            paintOrder: 'stroke fill',
            textShadow: style?.strokeColor === 'transparent'
              ? '0 12px 18px rgba(0,0,0,0.6)'
              : `0 7px 0 ${style?.strokeColor ?? '#000000'}, 0 12px 18px rgba(0,0,0,0.95), 4px 4px 0 ${style?.strokeColor ?? '#000000'}, -4px 4px 0 ${style?.strokeColor ?? '#000000'}`,
            whiteSpace: 'pre-line',
            ...(style?.bgColor ? {
              background: `rgba(${hexToRgb(style.bgColor)},${((style.bgOpacity ?? 80) / 100).toFixed(2)})`,
              padding: '12px 32px',
              borderRadius: 12,
            } : {}),
          }}
        >
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
};

interface Props {
  segments: Segment[];
}

export const SubtitleLayer: React.FC<Props> = ({ segments }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {segments.map(seg => {
        if (!seg.text.trim()) return null;

        const startFrame = Math.round(seg.start * fps);
        const endFrame = Math.round(seg.end * fps);
        const duration = endFrame - startFrame;
        if (duration <= 0) return null;

        return (
          <Sequence key={seg.id} from={startFrame} durationInFrames={duration}>
            <Subtitle text={seg.text} durationInFrames={duration} style={(seg as any).style} posY={(seg as any).posY} />
          </Sequence>
        );
      })}
    </>
  );
};
