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
  audio: string;       // path relative to public/ e.g. "audio/episode.m4a"
  duration: number;    // total seconds
  segments: Segment[];
}
