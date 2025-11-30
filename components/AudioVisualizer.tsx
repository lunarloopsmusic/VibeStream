
import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, Pause, Download, Settings, Layers, 
  Image as ImageIcon, Type, Activity, ChevronLeft, 
  Video, Monitor, Volume2, VolumeX, Square, 
  RefreshCcw, Check, X, Film, Clock, FileVideo,
  Sparkles, Zap
} from 'lucide-react';
import { VisualizerConfig } from '../types';

interface AudioVisualizerProps {
  audioUrl: string;
  config: VisualizerConfig;
  onBack: () => void;
}

// --- CONSTANTS ---
// Base resolution for logic calculations (1080p). 
// All drawing commands scale relative to this.
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

// --- TYPES FOR EDITOR STATE ---
type LayerType = 'scene' | 'spectrum' | 'particles' | 'background' | 'foreground' | 'text';

interface LayerItem {
    id: LayerType;
    label: string;
    icon: React.ElementType;
}

const LAYERS: LayerItem[] = [
    { id: 'scene', label: 'Global Scene', icon: Monitor },
    { id: 'spectrum', label: 'Audio Spectrum', icon: Activity },
    { id: 'particles', label: 'Particle System', icon: Sparkles },
    { id: 'background', label: 'Background Layer', icon: ImageIcon },
    { id: 'foreground', label: 'Center Asset', icon: Layers },
    { id: 'text', label: 'Text Overlay', icon: Type },
];

interface ExportSettings {
    resolution: '720p' | '1080p' | '2k' | '4k';
    fps: 30 | 60;
    quality: 'high' | 'medium' | 'low';
}

const RESOLUTIONS = {
    '720p': { w: 1280, h: 720, label: '720p (HD)' },
    '1080p': { w: 1920, h: 1080, label: '1080p (FHD)' },
    '2k': { w: 2560, h: 1440, label: '2K (QHD)' },
    '4k': { w: 3840, h: 2160, label: '4K (UHD)' },
};

// --- HELPER COMPONENTS ---

interface ControlGroupProps {
    title: string;
    children?: React.ReactNode;
}

const ControlGroup: React.FC<ControlGroupProps> = ({ title, children }) => (
    <div className="mb-6 border-b border-zinc-800 pb-6 last:border-0">
        <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{title}</h3>
        </div>
        <div className="space-y-4 px-1">{children}</div>
    </div>
);

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (val: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, onChange }) => (
    <div>
        <div className="flex justify-between text-xs mb-2">
            <span className="text-zinc-300 font-medium">{label}</span>
            <span className="text-zinc-500 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 min-w-[3rem] text-center">
                {value.toFixed(step < 0.1 ? 2 : 1)}
            </span>
        </div>
        <div className="relative h-6 flex items-center">
            <input 
                type="range" min={min} max={max} step={step} value={value} 
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-indigo-500 hover:accent-indigo-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
            />
        </div>
    </div>
);

interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between p-2 bg-zinc-900 rounded-lg border border-zinc-800">
        <span className="text-xs text-zinc-300 font-medium ml-1">{label}</span>
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-mono uppercase">{value}</span>
            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-zinc-700 shadow-sm">
                <input 
                    type="color" 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 p-0 m-0 cursor-pointer border-none" 
                />
            </div>
        </div>
    </div>
);

// --- PARTICLE CLASS ---
class Particle {
  x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; maxLife: number;
  
  constructor(w: number, h: number, color: string, speed: number, scale: number) {
    this.x = w / 2;
    this.y = h / 2;
    const angle = Math.random() * Math.PI * 2;
    const velocity = ((Math.random() * speed) + 0.5) * scale;
    this.vx = Math.cos(angle) * velocity;
    this.vy = Math.sin(angle) * velocity;
    this.size = (Math.random() * 4 + 1) * scale;
    this.color = color;
    this.maxLife = Math.random() * 60 + 40;
    this.life = this.maxLife;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    this.size *= 0.98; // Shrink over time
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioUrl, config: initialConfig, onBack }) => {
  // State
  const [config, setConfig] = useState<VisualizerConfig>(initialConfig);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeLayer, setActiveLayer] = useState<LayerType>('scene');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Export Settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
      resolution: '1080p',
      fps: 60,
      quality: 'high'
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Image Refs
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const centerImageRef = useRef<HTMLImageElement | null>(null);
  
  // Keep config current for render loop
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  const exportSettingsRef = useRef(exportSettings);
  useEffect(() => { exportSettingsRef.current = exportSettings; }, [exportSettings]);

  // Particles Ref
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);

  // --- INITIALIZATION ---
  
  useEffect(() => {
    if (config.backgroundImage) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = config.backgroundImage;
        img.onload = () => { bgImageRef.current = img; };
    } else { bgImageRef.current = null; }
  }, [config.backgroundImage]);

  useEffect(() => {
    if (config.centerImage) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = config.centerImage;
        img.onload = () => { centerImageRef.current = img; };
    } else { centerImageRef.current = null; }
  }, [config.centerImage]);

  useEffect(() => {
    const initAudio = () => {
      if (audioContextRef.current) return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = config.smoothing;

      if (audioRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        const streamDest = ctx.createMediaStreamDestination();
        
        source.connect(analyser);
        analyser.connect(ctx.destination);
        source.connect(streamDest); 

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        streamDestRef.current = streamDest;
      }
    };

    const handleInteraction = () => {
        initAudio();
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    };

    document.addEventListener('click', handleInteraction, { once: true });
    
    return () => {
        document.removeEventListener('click', handleInteraction);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  useEffect(() => {
      if (analyserRef.current) analyserRef.current.smoothingTimeConstant = config.smoothing;
  }, [config.smoothing]);


  // --- RENDER LOOP ---
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let rotationAngle = 0;

    const render = () => {
      if (!ctx || !canvas) return;
      const cfg = configRef.current;
      
      // Determine Dimensions based on mode
      // If Exporting, we rely on the canvas width set by startExport()
      // If Editing, we force 1080p for consistent preview
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
          canvas.width = BASE_WIDTH;
          canvas.height = BASE_HEIGHT;
      }
      
      const w = canvas.width;
      const h = canvas.height;
      const scaleFactor = w / BASE_WIDTH; // Scaling logic for 4K support
      
      let cx = w / 2;
      let cy = h / 2;

      timeRef.current += 0.01 * (cfg.colorCycleSpeed || 0.5);

      // Audio Data
      let dataArray = new Uint8Array(0);
      let isBeat = false;
      let bassAvg = 0;
      
      if (analyserRef.current) {
          const bufferLength = analyserRef.current.frequencyBinCount;
          dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);
          let bassSum = 0;
          for(let i=0; i<10; i++) bassSum += dataArray[i];
          bassAvg = bassSum / 10;
          isBeat = bassAvg > 210;
      }

      let shakeX = 0;
      let shakeY = 0;
      if (cfg.shakeStrength > 0 && bassAvg > 100) {
          const shakeAmt = (bassAvg / 255) * cfg.shakeStrength * 10 * scaleFactor;
          shakeX = (Math.random() - 0.5) * shakeAmt;
          shakeY = (Math.random() - 0.5) * shakeAmt;
      }

      // 1. Background
      ctx.fillStyle = cfg.backgroundColor;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // 2. BG Image
      if (bgImageRef.current && cfg.backgroundImage) {
        ctx.save();
        if (cfg.bgImageBlur > 0) ctx.filter = `blur(${cfg.bgImageBlur * scaleFactor}px)`;
        ctx.globalAlpha = cfg.bgImageOpacity;
        const img = bgImageRef.current;
        const imgRatio = img.width / img.height;
        const canvasRatio = w / h;
        let dw, dh, dx, dy;
        if (imgRatio > canvasRatio) {
            dh = h; dw = dh * imgRatio; dx = (w - dw) / 2; dy = 0;
        } else {
            dw = w; dh = dw / imgRatio; dy = (h - dh) / 2; dx = 0;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      }
      ctx.restore(); // End BG shake

      // 3. Particles
      if (cfg.showParticles) {
          if (isBeat && particlesRef.current.length < cfg.particleCount) {
             const pColor = cfg.rainbowMode 
                ? `hsl(${Math.random() * 360}, 100%, 60%)`
                : (Math.random() > 0.5 ? cfg.primaryColor : cfg.secondaryColor);
             for(let i=0; i<3; i++) {
                 particlesRef.current.push(new Particle(w, h, pColor, cfg.particleSpeed, scaleFactor));
             }
          }
          for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.update();
            p.draw(ctx);
            if (p.life <= 0) particlesRef.current.splice(i, 1);
          }
      }

      // 4. Spectrum
      if (cfg.showBars) {
        ctx.save();
        ctx.translate(shakeX, shakeY);
        ctx.shadowBlur = cfg.bloomStrength * scaleFactor;
        ctx.shadowColor = cfg.rainbowMode ? 'white' : cfg.primaryColor;
        rotationAngle += cfg.rotationSpeed * 0.005;

        const radius = (300 * (cfg.spectrumScale || 1.0)) * scaleFactor;
        
        let fillStyle: string | CanvasGradient = cfg.primaryColor;
        if (!cfg.rainbowMode && cfg.colorMode === 'gradient') {
            const grad = ctx.createLinearGradient(0, h/2 - 200, 0, h/2 + 200);
            grad.addColorStop(0, cfg.primaryColor);
            grad.addColorStop(1, cfg.secondaryColor);
            fillStyle = grad;
        }

        const barsToRender = Math.min(cfg.barCount, dataArray.length || 64);
        const scaledBarWidth = cfg.barWidth * scaleFactor;
        
        if (cfg.mode === 'circular') {
            ctx.translate(cx, cy);
            ctx.rotate(rotationAngle);
            if (isBeat) ctx.scale(1.02, 1.02);
            const step = Math.floor((dataArray.length || 64) / barsToRender);
            
            if (cfg.spectrumStyle === 'wave' || cfg.spectrumStyle === 'curve') {
                ctx.beginPath();
                ctx.strokeStyle = fillStyle;
                ctx.fillStyle = fillStyle;
                ctx.lineWidth = scaledBarWidth;
                
                for (let i = 0; i <= barsToRender; i++) {
                    const index = i === barsToRender ? 0 : i; 
                    const val = dataArray.length ? dataArray[index * step] : 10;
                    const barH = (val * cfg.sensitivity * cfg.barHeightScale * 0.5 * scaleFactor);
                    const angle = (i / barsToRender) * Math.PI * 2;
                    
                    const r = radius + barH;
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                if (cfg.spectrumStyle === 'curve') {
                   ctx.closePath();
                   ctx.arc(0, 0, radius, 0, Math.PI * 2, true); 
                   ctx.globalAlpha = cfg.fillOpacity || 0.5;
                   if (cfg.rainbowMode) ctx.fillStyle = `hsl(${timeRef.current * 50}, 80%, 60%)`;
                   ctx.fill();
                   ctx.globalAlpha = 1.0;
                   if (cfg.rainbowMode) ctx.strokeStyle = `hsl(${timeRef.current * 50}, 80%, 60%)`;
                   ctx.stroke();
                } else {
                    ctx.closePath();
                    if (cfg.rainbowMode) ctx.strokeStyle = `hsl(${timeRef.current * 50}, 80%, 60%)`;
                    ctx.stroke();
                }
            } else {
                for (let i = 0; i < barsToRender; i++) {
                    const val = dataArray.length ? dataArray[i * step] : 10;
                    const barH = (val * cfg.sensitivity * cfg.barHeightScale * scaleFactor) + (5 * scaleFactor);
                    const angle = (i / barsToRender) * Math.PI * 2;
                    const x1 = Math.cos(angle) * radius;
                    const y1 = Math.sin(angle) * radius;
                    const x2 = Math.cos(angle) * (radius + barH);
                    const y2 = Math.sin(angle) * (radius + barH);

                    if (cfg.rainbowMode) {
                        ctx.strokeStyle = `hsl(${(i / barsToRender) * 360 + (timeRef.current * 100)}, 100%, 60%)`;
                    } else {
                        ctx.strokeStyle = cfg.colorMode === 'solid' 
                         ? (i % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor)
                         : fillStyle;
                    }
                    ctx.lineWidth = scaledBarWidth;
                    ctx.lineCap = cfg.barRoundness > 0.5 ? 'round' : 'butt';
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            }
        } else {
            // LINEAR
            const barW = w / barsToRender;
            const step = Math.floor((dataArray.length || 64) / barsToRender);

            if (cfg.spectrumStyle === 'wave' || cfg.spectrumStyle === 'curve') {
                 ctx.beginPath();
                 ctx.strokeStyle = fillStyle;
                 ctx.fillStyle = fillStyle;
                 ctx.lineWidth = scaledBarWidth;
                 for (let i = 0; i <= barsToRender; i++) {
                    const index = Math.min(i, barsToRender - 1);
                    const val = dataArray.length ? dataArray[index * step] : 10;
                    const barH = (val * cfg.sensitivity * cfg.barHeightScale * 2 * (cfg.spectrumScale || 1.0) * scaleFactor);
                    const x = i * barW;
                    const y = h - barH;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                 }
                 if (cfg.spectrumStyle === 'curve') {
                     ctx.lineTo(w, h);
                     ctx.lineTo(0, h);
                     ctx.closePath();
                     ctx.globalAlpha = cfg.fillOpacity || 0.6;
                     if (cfg.rainbowMode) ctx.fillStyle = `hsl(${timeRef.current * 50}, 80%, 60%)`;
                     ctx.fill();
                     ctx.globalAlpha = 1.0;
                 } else {
                     if (cfg.rainbowMode) ctx.strokeStyle = `hsl(${timeRef.current * 50}, 80%, 60%)`;
                     ctx.stroke();
                 }
            } else {
                for (let i = 0; i < barsToRender; i++) {
                    const val = dataArray.length ? dataArray[i * step] : 10;
                    const barH = (val * cfg.sensitivity * cfg.barHeightScale * 3 * (cfg.spectrumScale || 1.0) * scaleFactor);
                    const x = i * barW;
                    if (cfg.rainbowMode) {
                        ctx.fillStyle = `hsl(${(i / barsToRender) * 360 + (timeRef.current * 100)}, 100%, 60%)`;
                    } else {
                        ctx.fillStyle = cfg.colorMode === 'solid' 
                         ? (i % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor)
                         : fillStyle;
                    }
                    const r = cfg.barRoundness > 0.5 ? Math.min(barW, barH) / 2 : 0;
                    if (cfg.mirror) {
                        const centerOffset = Math.abs((barsToRender/2) - i);
                        const mirrorVal = dataArray.length ? dataArray[centerOffset * step] : 10;
                        const mirrorH = (mirrorVal * cfg.sensitivity * cfg.barHeightScale * 3 * (cfg.spectrumScale || 1.0) * scaleFactor);
                        const y = (h / 2) - (mirrorH / 2);
                        ctx.beginPath();
                        ctx.roundRect(x, y, barW - 1, mirrorH, r);
                        ctx.fill();
                    } else {
                        const y = h - barH;
                        ctx.beginPath();
                        ctx.roundRect(x, y, barW - 1, barH, [r, r, 0, 0]);
                        ctx.fill();
                    }
                }
            }
        }
        ctx.restore();
      }

      // 5. Center Image
      if (centerImageRef.current && cfg.centerImage) {
          const baseSize = (350 * cfg.centerImageSize) * scaleFactor;
          const pulse = isBeat ? 1.03 : 1.0;
          const size = baseSize * pulse;
          ctx.save();
          ctx.translate(cx + shakeX, cy + shakeY);
          if (cfg.centerImageCircular) {
              ctx.beginPath();
              ctx.arc(0, 0, size/2, 0, Math.PI * 2);
              ctx.clip();
          }
          ctx.drawImage(centerImageRef.current, -size/2, -size/2, size, size);
          ctx.restore();
      }

      // 6. Text
      if (cfg.text.enabled) {
          ctx.save();
          ctx.translate(shakeX, shakeY);
          ctx.fillStyle = cfg.text.color;
          ctx.globalAlpha = cfg.text.opacity;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Apply Spacing (Modern Canvas API)
          if ('letterSpacing' in ctx) {
              (ctx as any).letterSpacing = `${cfg.text.letterSpacing * scaleFactor}px`;
          }

          if (cfg.text.shadow) {
              ctx.shadowColor = 'black';
              ctx.shadowBlur = 15 * scaleFactor;
          }
          const textY = cfg.mode === 'circular' ? h - (150 * scaleFactor) : (200 * scaleFactor);
          const scaledFontSize = cfg.text.fontSize * scaleFactor;
          
          ctx.font = `bold ${scaledFontSize}px "${cfg.text.fontFamily}"`;
          ctx.fillText(cfg.text.topText.toUpperCase(), cx, textY);
          
          ctx.font = `normal ${scaledFontSize * 0.5}px "${cfg.text.fontFamily}"`;
          ctx.fillText(cfg.text.bottomText, cx, textY + (scaledFontSize * 1.2));
          ctx.restore();
      }

      // 7. Cinematic Overlay
      if (cfg.vignette > 0) {
          ctx.save();
          const grad = ctx.createRadialGradient(cx, cy, h/2, cx, cy, h);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
      }
      if (cfg.cinematicBars) {
          ctx.fillStyle = 'black';
          const barH = h * 0.12; 
          ctx.fillRect(0, 0, w, barH);
          ctx.fillRect(0, h - barH, w, barH);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);


  // --- EXPORT LOGIC ---

  const handleStartExport = async () => {
      setShowExportModal(false);
      setIsExporting(true);
      setExportProgress(0);
      
      const resConfig = RESOLUTIONS[exportSettings.resolution];
      const targetWidth = resConfig.w;
      const targetHeight = resConfig.h;
      
      if (canvasRef.current) {
          canvasRef.current.width = targetWidth;
          canvasRef.current.height = targetHeight;
      }

      // 1. Setup Stream
      // We assume browser supports at least one webm codec.
      const mimeType = "video/webm;codecs=vp9";
      let recorder: MediaRecorder | null = null;
      try {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            // Fallback
            if (MediaRecorder.isTypeSupported("video/webm")) {
                // simple webm
            } else {
                alert("Browser doesn't support WebM export. Please use Chrome/Firefox.");
                setIsExporting(false);
                return;
            }
        }

        const stream = canvasRef.current!.captureStream(exportSettings.fps);
        const audioTrack = streamDestRef.current!.stream.getAudioTracks()[0];
        stream.addTrack(audioTrack);

        // Bitrate calc: Mbps -> bps
        let bits = 8000000; // 8Mbps default
        if (exportSettings.quality === 'low') bits = 4000000;
        if (exportSettings.quality === 'high') bits = 25000000; // 4K/25Mbps
        
        recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: bits
        });

      } catch (e) {
          console.error("Recorder Setup Failed", e);
          setIsExporting(false);
          return;
      }

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setIsExporting(false);
          
          // Disconnect monitor for better performance
          if (audioContextRef.current && analyserRef.current) {
             analyserRef.current.connect(audioContextRef.current.destination);
          }
          
          // Reset UI state
          if (audioRef.current) audioRef.current.volume = volume;
          if (canvasRef.current) {
              canvasRef.current.width = BASE_WIDTH;
              canvasRef.current.height = BASE_HEIGHT;
          }
      };

      // 2. Play & Record
      // Mute speakers during render, but keep stream active
      if (analyserRef.current && audioContextRef.current) {
         analyserRef.current.disconnect(audioContextRef.current.destination);
      }
      
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
      }
      
      recorder.start();

      // 3. Watch for end
      const checkProgress = setInterval(() => {
          if (!audioRef.current) return;
          const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setExportProgress(Math.min(p, 99));

          if (audioRef.current.ended) {
              clearInterval(checkProgress);
              recorder?.stop();
          }
      }, 100);
  };

  const cancelExport = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
      }
      setIsExporting(false);
      // restore audio
      if (analyserRef.current && audioContextRef.current) {
          analyserRef.current.connect(audioContextRef.current.destination);
      }
  };


  // --- UI ACTIONS ---
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
        audioRef.current.pause();
    } else {
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // --- RENDER COMPONENT ---
  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col overflow-hidden font-sans selection:bg-indigo-500/30">
        
        {/* EXPORT MODAL */}
        {showExportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-8 w-[400px] shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Export Settings</h2>
                        <button onClick={() => setShowExportModal(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                    </div>

                    <div className="space-y-6">
                        {/* Resolution */}
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Resolution</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['720p', '1080p', '2k', '4k'] as const).map(res => (
                                    <button 
                                        key={res}
                                        onClick={() => setExportSettings({...exportSettings, resolution: res})}
                                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${exportSettings.resolution === res ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
                                    >
                                        {RESOLUTIONS[res].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* FPS */}
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Frame Rate</label>
                            <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                                <button onClick={() => setExportSettings({...exportSettings, fps: 30})} className={`flex-1 py-2 text-sm font-medium rounded ${exportSettings.fps===30 ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>30 FPS</button>
                                <button onClick={() => setExportSettings({...exportSettings, fps: 60})} className={`flex-1 py-2 text-sm font-medium rounded ${exportSettings.fps===60 ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>60 FPS</button>
                            </div>
                        </div>

                        {/* Quality */}
                        <div>
                             <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Quality (Bitrate)</label>
                             <div className="flex gap-2">
                                {(['low', 'medium', 'high'] as const).map(q => (
                                     <button key={q} onClick={() => setExportSettings({...exportSettings, quality: q})} className={`flex-1 py-2 rounded text-xs uppercase font-bold border ${exportSettings.quality === q ? 'bg-indigo-900/30 border-indigo-500 text-indigo-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                         {q}
                                     </button>
                                ))}
                             </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-800">
                             <div className="flex justify-between text-xs text-zinc-500 mb-4 font-mono">
                                 <span>EST. FILE SIZE</span>
                                 <span>~{(duration * (exportSettings.quality === 'high' ? 25 : 8) / 8).toFixed(1)} MB</span>
                             </div>
                             <button onClick={handleStartExport} className="w-full py-4 bg-white text-black font-bold text-lg rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                                 Start Export <ArrowRight size={20} />
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* RENDERING OVERLAY */}
        {isExporting && (
             <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                 <div className="w-24 h-24 mb-8 relative">
                     <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
                     <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                     <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-white">
                         {Math.round(exportProgress)}%
                     </div>
                 </div>
                 <h2 className="text-3xl font-bold text-white mb-2">Rendering Video...</h2>
                 <p className="text-zinc-500 mb-8">Do not close this tab. Audio is muted during render.</p>
                 <button onClick={cancelExport} className="px-6 py-2 rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-900 text-sm">
                     Cancel
                 </button>
             </div>
        )}

        {/* --- TOP HEADER --- */}
        <header className="h-14 border-b border-zinc-900 bg-[#0a0a0a] flex items-center justify-between px-4 z-20 shrink-0">
             <div className="flex items-center gap-4">
                 <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium">
                     <ChevronLeft size={16} /> Back
                 </button>
                 <div className="h-4 w-px bg-zinc-800" />
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    <span className="text-sm font-semibold text-zinc-200">VibeStream</span>
                 </div>
             </div>

             <div className="flex items-center gap-3">
                 <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded transition-all">
                    <FileVideo size={14} /> EXPORT VIDEO
                 </button>
             </div>
        </header>

        {/* --- MAIN EDITOR --- */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* 1. LAYERS PANEL (LEFT) */}
            <div className="w-64 bg-[#0a0a0a] border-r border-zinc-900 flex flex-col shrink-0 z-10">
                <div className="p-4 border-b border-zinc-900">
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Layers</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {LAYERS.map(layer => (
                        <button
                            key={layer.id}
                            onClick={() => setActiveLayer(layer.id)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all
                            ${activeLayer === layer.id 
                                ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700/50' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
                        >
                            <layer.icon size={16} className={activeLayer === layer.id ? 'text-indigo-400' : ''} />
                            <span className="font-medium">{layer.label}</span>
                            {activeLayer === layer.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. VIEWPORT (CENTER) */}
            <div className="flex-1 bg-[#050505] relative flex items-center justify-center p-8 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                
                <div className="relative shadow-2xl shadow-black border border-zinc-900 aspect-video w-full max-h-full max-w-[1280px] bg-black">
                    <canvas ref={canvasRef} className="w-full h-full object-contain block" />

                    {/* Download Modal */}
                    {downloadUrl && (
                        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 text-center max-w-sm shadow-2xl">
                                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Render Complete</h3>
                                <p className="text-zinc-400 text-sm mb-6">Your video is ready. Download it now.</p>
                                <div className="flex flex-col gap-3">
                                    <a href={downloadUrl} download={`vibestream_${exportSettings.resolution}.webm`} className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 flex items-center justify-center gap-2">
                                        <Download size={16} /> Download File
                                    </a>
                                    <button onClick={() => setDownloadUrl(null)} className="text-zinc-500 hover:text-white text-sm hover:underline">Discard & Close</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. INSPECTOR (RIGHT) */}
            <div className="w-80 bg-[#0a0a0a] border-l border-zinc-900 flex flex-col shrink-0 z-10">
                <div className="p-4 border-b border-zinc-900 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Properties</h2>
                    <span className="text-[10px] text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 font-mono">
                        {LAYERS.find(l => l.id === activeLayer)?.label}
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    
                    {/* SCENE CONFIG */}
                    {activeLayer === 'scene' && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                             <ControlGroup title="Camera & Stage">
                                <Slider label="Rotation Speed" min={0} max={2} step={0.1} value={config.rotationSpeed} onChange={(v) => setConfig({...config, rotationSpeed: v})} />
                                <div className="mt-4 flex items-center justify-between text-xs p-2 bg-zinc-900 rounded border border-zinc-800">
                                    <span className="text-zinc-300">Cinematic Bars</span>
                                    <input type="checkbox" checked={config.cinematicBars} onChange={e => setConfig({...config, cinematicBars: e.target.checked})} className="accent-indigo-500 w-4 h-4" />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs p-2 bg-zinc-900 rounded border border-zinc-800">
                                    <span className="text-zinc-300">Vignette</span>
                                    <input type="checkbox" checked={config.vignette > 0} onChange={e => setConfig({...config, vignette: e.target.checked ? 0.4 : 0})} className="accent-indigo-500 w-4 h-4" />
                                </div>
                             </ControlGroup>
                             <ControlGroup title="Audio Reactivity">
                                <Slider label="Sensitivity" min={0.5} max={3} step={0.1} value={config.sensitivity} onChange={(v) => setConfig({...config, sensitivity: v})} />
                                <Slider label="Smoothing" min={0.1} max={0.95} step={0.05} value={config.smoothing} onChange={(v) => setConfig({...config, smoothing: v})} />
                                <div className="mt-4">
                                     <Slider label="Bass Shake" min={0} max={5} step={0.5} value={config.shakeStrength || 0} onChange={(v) => setConfig({...config, shakeStrength: v})} />
                                </div>
                             </ControlGroup>
                        </div>
                    )}

                    {/* SPECTRUM CONFIG */}
                    {activeLayer === 'spectrum' && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                             <ControlGroup title="Mode">
                                <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 mb-4">
                                    <button onClick={() => setConfig({...config, mode: 'circular'})} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${config.mode==='circular' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Circular</button>
                                    <button onClick={() => setConfig({...config, mode: 'linear'})} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${config.mode==='linear' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Linear</button>
                                </div>
                                
                                <div className="mb-4">
                                    <label className="text-xs text-zinc-300 font-medium mb-2 block">Style</label>
                                    <select 
                                        value={config.spectrumStyle || 'bars'} 
                                        onChange={e => setConfig({...config, spectrumStyle: e.target.value as any})}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                                    >
                                        <option value="bars">Bars (Equalizer)</option>
                                        <option value="wave">Line Wave</option>
                                        <option value="curve">Filled Curve</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between text-xs mb-4 p-2 bg-zinc-900 rounded border border-zinc-800">
                                    <span className="text-zinc-300">Enable Spectrum</span>
                                    <input type="checkbox" checked={config.showBars} onChange={e => setConfig({...config, showBars: e.target.checked})} className="accent-indigo-500 w-4 h-4" />
                                </div>
                             </ControlGroup>

                             <ControlGroup title="Design">
                                <Slider label="Scale / Size" min={0.5} max={2.0} step={0.1} value={config.spectrumScale || 1.0} onChange={(v) => setConfig({...config, spectrumScale: v})} />
                                <Slider label="Bar Count" min={32} max={256} step={16} value={config.barCount} onChange={(v) => setConfig({...config, barCount: v})} />
                                <Slider label="Bar Width" min={1} max={20} step={1} value={config.barWidth} onChange={(v) => setConfig({...config, barWidth: v})} />
                                <Slider label="Amplitude" min={0.5} max={3} step={0.1} value={config.barHeightScale} onChange={(v) => setConfig({...config, barHeightScale: v})} />
                                
                                {config.spectrumStyle === 'bars' && (
                                    <div className="flex items-center justify-between text-xs mt-4 p-2 bg-zinc-900 rounded border border-zinc-800">
                                        <span className="text-zinc-300">Round Caps</span>
                                        <input type="checkbox" checked={(config.barRoundness || 0) > 0.5} onChange={e => setConfig({...config, barRoundness: e.target.checked ? 1 : 0})} className="accent-indigo-500 w-4 h-4" />
                                    </div>
                                )}
                                {config.spectrumStyle === 'curve' && (
                                     <div className="mt-4">
                                        <Slider label="Fill Opacity" min={0} max={1} step={0.1} value={config.fillOpacity ?? 0.5} onChange={(v) => setConfig({...config, fillOpacity: v})} />
                                     </div>
                                )}
                             </ControlGroup>
                             
                             <ControlGroup title="Appearance">
                                <div className="flex items-center justify-between text-xs mb-2 p-2 bg-zinc-900 rounded border border-zinc-800">
                                    <span className="flex items-center gap-2 text-zinc-300"><Zap size={12} className="text-yellow-400" /> Rainbow Mode</span>
                                    <input type="checkbox" checked={config.rainbowMode} onChange={e => setConfig({...config, rainbowMode: e.target.checked})} className="accent-indigo-500 w-4 h-4" />
                                </div>
                                
                                {config.rainbowMode ? (
                                    <div className="mt-2">
                                        <Slider label="Cycle Speed" min={0} max={5} step={0.5} value={config.colorCycleSpeed ?? 0.5} onChange={(v) => setConfig({...config, colorCycleSpeed: v})} />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between text-xs mb-4 p-2 bg-zinc-900 rounded border border-zinc-800">
                                            <span className="text-zinc-300">Gradient Color</span>
                                            <input type="checkbox" checked={config.colorMode === 'gradient'} onChange={e => setConfig({...config, colorMode: e.target.checked ? 'gradient' : 'solid'})} className="accent-indigo-500 w-4 h-4" />
                                        </div>
                                        <div className="space-y-3">
                                            <ColorPicker label="Primary Color" value={config.primaryColor} onChange={(v) => setConfig({...config, primaryColor: v})} />
                                            <ColorPicker label="Secondary Color" value={config.secondaryColor} onChange={(v) => setConfig({...config, secondaryColor: v})} />
                                        </div>
                                    </>
                                )}
                                <div className="mt-4">
                                     <Slider label="Bloom Strength" min={0} max={50} step={5} value={config.bloomStrength} onChange={(v) => setConfig({...config, bloomStrength: v})} />
                                </div>
                             </ControlGroup>
                        </div>
                    )}

                    {/* PARTICLES CONFIG */}
                    {activeLayer === 'particles' && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                             <ControlGroup title="Emission">
                                <div className="flex items-center justify-between text-xs mb-4 p-2 bg-zinc-900 rounded border border-zinc-800">
                                    <span className="text-zinc-300">Enable Emitter</span>
                                    <input type="checkbox" checked={config.showParticles} onChange={e => setConfig({...config, showParticles: e.target.checked})} className="accent-indigo-500 w-4 h-4" />
                                </div>
                                <Slider label="Max Particles" min={10} max={300} step={10} value={config.particleCount} onChange={(v) => setConfig({...config, particleCount: v})} />
                                <Slider label="Velocity" min={0.5} max={5} step={0.5} value={config.particleSpeed} onChange={(v) => setConfig({...config, particleSpeed: v})} />
                             </ControlGroup>
                        </div>
                    )}

                    {/* BACKGROUND CONFIG */}
                    {activeLayer === 'background' && (
                         <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                             <ControlGroup title="Solid Color">
                                 <ColorPicker label="Background" value={config.backgroundColor} onChange={(v) => setConfig({...config, backgroundColor: v})} />
                             </ControlGroup>
                             <ControlGroup title="Image Texture">
                                 <label className="block w-full h-32 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer relative overflow-hidden group transition-colors flex flex-col items-center justify-center">
                                     {config.backgroundImage ? (
                                        <img src={config.backgroundImage} className="w-full h-full object-cover opacity-50" />
                                     ) : (
                                        <>
                                            <ImageIcon size={24} className="mb-2 text-zinc-600 group-hover:text-zinc-400" />
                                            <span className="text-[10px] uppercase font-bold text-zinc-600 group-hover:text-zinc-400">Upload Image</span>
                                        </>
                                     )}
                                     <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                         const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (v) => setConfig({...config, backgroundImage: v.target?.result as string}); r.readAsDataURL(f); }
                                     }} />
                                     {config.backgroundImage && (
                                         <button onClick={(e) => { e.preventDefault(); setConfig({...config, backgroundImage: null}); }} className="absolute top-2 right-2 bg-red-500/20 text-red-400 p-1.5 rounded hover:bg-red-500 hover:text-white transition-colors">
                                             <RefreshCcw size={12} />
                                         </button>
                                     )}
                                 </label>
                                 {config.backgroundImage && (
                                     <div className="mt-4 space-y-4">
                                         <Slider label="Opacity" min={0} max={1} step={0.1} value={config.bgImageOpacity} onChange={(v) => setConfig({...config, bgImageOpacity: v})} />
                                         <Slider label="Blur Amount" min={0} max={20} step={1} value={config.bgImageBlur} onChange={(v) => setConfig({...config, bgImageBlur: v})} />
                                     </div>
                                 )}
                             </ControlGroup>
                         </div>
                    )}

                    {/* FOREGROUND CONFIG */}
                    {activeLayer === 'foreground' && (
                         <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                             <ControlGroup title="Center Asset">
                                <label className="block w-full h-32 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer relative overflow-hidden group transition-colors flex flex-col items-center justify-center">
                                     {config.centerImage ? (
                                        <img src={config.centerImage} className="w-full h-full object-contain p-4" />
                                     ) : (
                                        <>
                                            <Layers size={24} className="mb-2 text-zinc-600 group-hover:text-zinc-400" />
                                            <span className="text-[10px] uppercase font-bold text-zinc-600 group-hover:text-zinc-400">Upload Logo/Art</span>
                                        </>
                                     )}
                                     <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                         const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (v) => setConfig({...config, centerImage: v.target?.result as string}); r.readAsDataURL(f); }
                                     }} />
                                      {config.centerImage && (
                                         <button onClick={(e) => { e.preventDefault(); setConfig({...config, centerImage: null}); }} className="absolute top-2 right-2 bg-red-500/20 text-red-400 p-1.5 rounded hover:bg-red-500 hover:text-white transition-colors">
                                             <RefreshCcw size={12} />
                                         </button>
                                     )}
                                </label>
                                {config.centerImage && (
                                     <div className="mt-4 space-y-4">
                                         <Slider label="Scale" min={0.2} max={2} step={0.1} value={config.centerImageSize} onChange={(v) => setConfig({...config, centerImageSize: v})} />
                                         <div className="flex items-center justify-between text-xs p-2 bg-zinc-900 rounded border border-zinc-800">
                                             <span className="text-zinc-300">Circular Crop</span>
                                             <input type="checkbox" checked={config.centerImageCircular} onChange={e => setConfig({...config, centerImageCircular: e.target.checked})} className="accent-indigo-500 w-4 h-4" />
                                         </div>
                                     </div>
                                 )}
                             </ControlGroup>
                         </div>
                    )}

                    {/* TEXT CONFIG */}
                    {activeLayer === 'text' && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                             <ControlGroup title="Content">
                                <div className="flex items-center justify-between text-xs mb-4 p-2 bg-zinc-900 rounded border border-zinc-800">
                                    <span className="text-zinc-300">Enable Text</span>
                                    <input type="checkbox" checked={config.text.enabled} onChange={e => setConfig({...config, text: {...config.text, enabled: e.target.checked}})} className="accent-indigo-500 w-4 h-4" />
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Line 1</label>
                                        <input type="text" value={config.text.topText} onChange={e => setConfig({...config, text: {...config.text, topText: e.target.value}})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Line 2</label>
                                        <input type="text" value={config.text.bottomText} onChange={e => setConfig({...config, text: {...config.text, bottomText: e.target.value}})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>
                             </ControlGroup>
                             <ControlGroup title="Typography">
                                <div className="space-y-3">
                                    <select value={config.text.fontFamily} onChange={e => setConfig({...config, text: {...config.text, fontFamily: e.target.value}})}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300 outline-none focus:border-indigo-500">
                                        <option value="Inter">Inter (Sans)</option>
                                        <option value="Playfair Display">Playfair (Serif)</option>
                                        <option value="JetBrains Mono">JetBrains (Mono)</option>
                                        <option value="Oswald">Oswald (Condensed)</option>
                                        <option value="Montserrat">Montserrat (Modern)</option>
                                        <option value="Dancing Script">Dancing Script (Cursive)</option>
                                        <option value="Orbitron">Orbitron (Sci-Fi)</option>
                                        <option value="Cinzel">Cinzel (Cinematic)</option>
                                    </select>
                                    <ColorPicker label="Text Color" value={config.text.color} onChange={(v) => setConfig({...config, text: {...config.text, color: v}})} />
                                    <Slider label="Font Size" min={20} max={150} step={5} value={config.text.fontSize} onChange={(v) => setConfig({...config, text: {...config.text, fontSize: v}})} />
                                    <Slider label="Spacing" min={0} max={50} step={1} value={config.text.letterSpacing} onChange={(v) => setConfig({...config, text: {...config.text, letterSpacing: v}})} />
                                </div>
                             </ControlGroup>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* --- BOTTOM TRANSPORT --- */}
        <div className="h-16 bg-[#0a0a0a] border-t border-zinc-900 flex items-center justify-between px-6 z-20 shrink-0">
             
             {/* Left: Info */}
             <div className="w-1/3 flex items-center gap-4">
                 <div className="w-10 h-10 bg-zinc-900 rounded flex items-center justify-center border border-zinc-800 text-zinc-500">
                     <Activity size={20} />
                 </div>
                 <div className="flex flex-col overflow-hidden">
                     <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Now Playing</span>
                     <span className="text-sm text-zinc-100 font-medium truncate w-64">{config.text.topText}</span>
                 </div>
             </div>

             {/* Center: Playback */}
             <div className="w-1/3 flex flex-col items-center justify-center">
                 <div className="flex items-center gap-6">
                     <button onClick={() => { if(audioRef.current){ audioRef.current.currentTime = 0; } }} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                         <RefreshCcw size={14} />
                     </button>
                     <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20">
                         {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-0.5" />}
                     </button>
                     <button 
                        onClick={() => setShowExportModal(true)} 
                        className="text-zinc-600 hover:text-white transition-colors"
                     >
                        <Download size={16} />
                     </button>
                 </div>
             </div>

             {/* Right: Volume & Time */}
             <div className="w-1/3 flex items-center justify-end gap-6">
                 <span className="text-xs font-mono text-zinc-500">
                    {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                 </span>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-500 hover:text-zinc-300">
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input 
                        type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} 
                        onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if(audioRef.current) audioRef.current.volume = v; }}
                        className="w-20 h-1 bg-zinc-800 rounded-full appearance-none accent-zinc-500 hover:accent-zinc-300 cursor-pointer" 
                    />
                 </div>
             </div>
        </div>

        {/* Hidden Audio Element */}
        <audio 
            ref={audioRef} 
            src={audioUrl} 
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setIsPlaying(false)}
        />
        
        {/* Helper for Arrow Right Icon */}
        <div style={{display: 'none'}}>
            <ArrowRight size={20} />
        </div>
    </div>
  );
};

// Helper for ArrowRight that was missing in imports
function ArrowRight({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
