
export enum AppStep {
  UPLOAD = 'UPLOAD',
  ANALYZING = 'ANALYZING',
  VISUALIZER = 'VISUALIZER',
}

export interface AudioFile {
  file: File;
  url: string;
  base64: string;
  mimeType: string;
  name: string;
}

export interface TextConfig {
  enabled: boolean;
  topText: string;
  bottomText: string;
  fontFamily: string; // 'Inter', 'Playfair Display', 'Monospace'
  fontSize: number;
  color: string;
  opacity: number;
  letterSpacing: number;
  shadow: boolean;
}

export interface VisualizerConfig {
  // General
  presetName: string;
  mode: 'circular' | 'linear';
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;

  // Assets
  backgroundImage: string | null;
  bgImageOpacity: number;
  bgImageBlur: number;
  
  centerImage: string | null;
  centerImageSize: number;
  centerImageCircular: boolean;

  // Typography (New)
  text: TextConfig;

  // Audio Reactivity
  sensitivity: number;
  smoothing: number;
  
  // Spectrum
  showBars: boolean;
  barCount: number;
  barWidth: number;
  barHeightScale: number;
  mirror: boolean;

  // Particles
  showParticles: boolean;
  particleCount: number;
  particleSpeed: number;

  // Effects
  bloomStrength: number;
  rotationSpeed: number;
  cinematicBars: boolean; // New: 16:9 Letterbox effect on top/bottom
  vignette: number; // 0 to 1
}
