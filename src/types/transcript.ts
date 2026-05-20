export type CharacterIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;

export type SceneType = 'surprised' | 'pointing' | 'thinking' | 'smile';

export interface Segment {
  id: number;
  start: number;       // seconds
  end: number;         // seconds
  text: string;
  scene?: SceneType;           // generate-transcript.py が自動付与
  character: CharacterIndex;
  emphasis: string | null;       // 強調テロップテキスト
  illustration: string | null;  // path relative to public/ e.g. "illustrations/food.png"
  sound: string | null;         // path relative to public/ e.g. "sounds/ding.mp3"
}

export interface SceneMapEntry {
  start: number;        // seconds
  end: number;          // seconds
  illustration: string; // filename e.g. "illust_01_tokyo_university.jpg"
}

export interface Transcript {
  title: string;
  audio: string;       // path relative to public/ e.g. "sounds/audio.mp3"
  duration: number;    // total seconds
  segments: Segment[];
  bgm?: string;        // path relative to public/ e.g. "sounds/bgm_morning.mp3"
  volume?: number;     // 声の音量倍率（prepare.ts で正規化+3倍済みなら 1.0）
  bgmVolume?: number;  // BGM音量（デフォルト 0.07 = 声の約1/14）
  charAlign?: 'left' | 'center' | 'right'; // 挿絵表示時の顔の横位置（デフォルト left）
}
