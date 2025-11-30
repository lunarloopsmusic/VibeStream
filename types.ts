export enum AppStep {
  UPLOAD = 'UPLOAD',
  ANALYZING = 'ANALYZING',
  PROMPT_EDIT = 'PROMPT_EDIT',
  GENERATING_VIDEO = 'GENERATING_VIDEO',
  RESULT = 'RESULT',
}

export interface AudioFile {
  file: File;
  url: string;
  base64: string;
  mimeType: string;
}

export interface GenerationConfig {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p';
}

export interface VideoResult {
  videoUrl: string;
  expiresAt?: Date;
}
