
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

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsConfig {
  enabled: boolean;
  content: string; // Raw string with newlines
  syncData: LyricLine[]; // Array of timestamps and text
  fontFamily: string;
  fontSize: number;
  color: string;
  animationStyle: 'static' | 'highlight' | 'scroll' | 'karaoke';
  opacity: number;
  yOffset: number;
}

export interface CenterTextConfig {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  glowColor: string;
  glowStrength: number;
}

export interface VisualizerConfig {
  // Global / Scene
  presetName: string;
  mode: 'circular' | 'linear';
  rotationSpeed: number;
  cinematicBars: boolean;
  vignette: number;
  shakeStrength: number;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  colorMode: 'solid' | 'gradient'; 
  rainbowMode: boolean;
  colorCycleSpeed: number;

  // Assets
  backgroundImage: string | null;
  bgImageOpacity: number;
  bgImageBlur: number;
  
  centerType: 'image' | 'text'; // New
  centerImage: string | null;
  centerImageSize: number;
  centerImageCircular: boolean;
  centerTextConfig: CenterTextConfig; // New

  // Typography
  text: TextConfig;
  lyrics: LyricsConfig; 

  // Audio Reactivity
  sensitivity: number;
  smoothing: number;
  
  // Spectrum
  showBars: boolean;
  spectrumStyle: 'bars' | 'wave' | 'curve'; 
  spectrumScale: number; 
  barCount: number;
  barWidth: number;
  barHeightScale: number;
  barRoundness: number;
  fillOpacity: number;
  mirror: boolean;
  bloomStrength: number;

  // Particles
  showParticles: boolean;
  particleCount: number;
  particleSpeed: number;
  particleStyle: 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'snowflake';
  particleDirection: 'outwards' | 'up' | 'down' | 'random';
}