export type Viseme = 'aa' | 'ih' | 'ou' | 'ee' | 'oh';

export interface LipSyncAnalyzeResult {
  volume: number;
  viseme: Viseme;
}
