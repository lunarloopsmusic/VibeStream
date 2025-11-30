
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
}

export interface VisualizerConfig {
  // General
  presetName: string; // e.g., "Neon Pulse"
  mode: 'circular' | 'linear';
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;

  // Assets (New)
  backgroundImage: string | null; // Data URL
  bgImageOpacity: number; // 0 to 1
  bgImageBlur: number; // 0 to 20px
  
  centerImage: string | null; // Data URL (Logo)
  centerImageSize: number; // 0.1 to 2.0 scale
  centerImageCircular: boolean;

  // Audio Reactivity
  sensitivity: number; // 0.1 to 3.0
  smoothing: number; // 0.1 to 0.9
  
  // Spectrum (Bars)
  showBars: boolean;
  barCount: number; // 32 to 256
  barWidth: number; // 1 to 50
  barHeightScale: number; // 0.5 to 3.0
  mirror: boolean; // For linear mode

  // Particles
  showParticles: boolean;
  particleCount: number;
  particleSpeed: number;

  // Effects
  bloomStrength: number; // 0 to 50
  rotationSpeed: number; // -5 to 5 (for circular)
}
