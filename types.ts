export enum AppStep {
  UPLOAD = 'UPLOAD',
  ANALYZING = 'ANALYZING',
  VISUALIZER = 'VISUALIZER', // Replaces PROMPT_EDIT and GENERATING
}

export interface AudioFile {
  file: File;
  url: string;
  base64: string;
  mimeType: string;
}

export interface VisualizerConfig {
  style: 'bars' | 'wave' | 'orb' | 'particles';
  primaryColor: string;
  secondaryColor: string;
  sensitivity: number; // 0.5 to 2.0
  moodDescription: string;
}
