
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
  // Global / Scene
  presetName: string;
  mode: 'circular' | 'linear';
  rotationSpeed: number;
  cinematicBars: boolean;
  vignette: number;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  colorMode: 'solid' | 'gradient'; // New

  // Assets
  backgroundImage: string | null;
  bgImageOpacity: number;
  bgImageBlur: number;
  
  centerImage: string | null;
  centerImageSize: number;
  centerImageCircular: boolean;

  // Typography
  text: TextConfig;

  // Audio Reactivity
  sensitivity: number;
  smoothing: number;
  
  // Spectrum
  showBars: boolean;
  spectrumStyle: 'bars' | 'wave' | 'curve'; // New
  spectrumScale: number; // New (Radius or Height multiplier)
  barCount: number;
  barWidth: number;
  barHeightScale: number;
  mirror: boolean;
  bloomStrength: number;

  // Particles
  showParticles: boolean;
  particleCount: number;
  particleSpeed: number;
}
