
import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download, Video, Settings2, Layout, Palette, Zap, Image as ImageIcon, Upload, Trash2, ArrowLeft } from 'lucide-react';
import { VisualizerConfig } from '../types';

interface AudioVisualizerProps {
  audioUrl: string;
  config: VisualizerConfig;
  onBack: () => void;
}

// Particle Class
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;

  constructor(w: number, h: number, color: string, speed: number) {
    this.x = w / 2;
    this.y = h / 2;
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * speed + 1;
    this.vx = Math.cos(angle) * velocity;
    this.vy = Math.sin(angle) * velocity;
    this.size = Math.random() * 3 + 1;
    this.color = color;
    this.maxLife = Math.random() * 50 + 50;
    this.life = this.maxLife;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    this.size *= 0.98; // Shrink
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioUrl, config: initialConfig, onBack }) => {
  // State
  const [config, setConfig] = useState<VisualizerConfig>(initialConfig);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'layout' | 'color' | 'effects' | 'assets'>('layout');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();
  const streamDestRef = useRef<MediaStreamAudioDestinationNode>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Image Element Refs (kept in memory, not DOM)
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const centerImageRef = useRef<HTMLImageElement | null>(null);

  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  const particlesRef = useRef<Particle[]>([]);

  // Initialize Audio
  useEffect(() => {
    if (!audioRef.current) return;

    const initAudio = () => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = config.smoothing || 0.8;
      
      const source = ctx.createMediaElementSource(audioRef.current!);
      const streamDest = ctx.createMediaStreamDestination();
      
      source.connect(analyser);
      analyser.connect(ctx.destination);
      source.connect(streamDest);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamDestRef.current = streamDest;
    };

    const handleFirstClick = () => {
      if (!audioContextRef.current) initAudio();
      else if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
    };

    document.addEventListener('click', handleFirstClick, { once: true });
    return () => {
        document.removeEventListener('click', handleFirstClick);
        if (audioContextRef.current) audioContextRef.current.close();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Update Analyser smoothing
  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.smoothingTimeConstant = config.smoothing;
    }
  }, [config.smoothing]);

  // Handle Image Loading
  useEffect(() => {
    if (config.backgroundImage && (!bgImageRef.current || bgImageRef.current.src !== config.backgroundImage)) {
        const img = new Image();
        img.src = config.backgroundImage;
        bgImageRef.current = img;
    } else if (!config.backgroundImage) {
        bgImageRef.current = null;
    }

    if (config.centerImage && (!centerImageRef.current || centerImageRef.current.src !== config.centerImage)) {
        const img = new Image();
        img.src = config.centerImage;
        centerImageRef.current = img;
    } else if (!config.centerImage) {
        centerImageRef.current = null;
    }
  }, [config.backgroundImage, config.centerImage]);

  // Main Render Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize
    if (!ctx) return;

    canvas.width = 1920;
    canvas.height = 1080;

    let rotationAngle = 0;

    const render = () => {
      if (!analyserRef.current) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const cfg = configRef.current;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      // --- 1. Background Color ---
      ctx.fillStyle = cfg.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- 2. Background Image ---
      if (bgImageRef.current && bgImageRef.current.complete) {
        ctx.save();
        if (cfg.bgImageBlur > 0) {
            ctx.filter = `blur(${cfg.bgImageBlur}px)`;
        }
        ctx.globalAlpha = cfg.bgImageOpacity;
        
        // Draw cover logic
        const imgRatio = bgImageRef.current.width / bgImageRef.current.height;
        const canvasRatio = canvas.width / canvas.height;
        let dw, dh, dx, dy;
        if (imgRatio > canvasRatio) {
            dh = canvas.height;
            dw = dh * imgRatio;
            dx = (canvas.width - dw) / 2;
            dy = 0;
        } else {
            dw = canvas.width;
            dh = dw / imgRatio;
            dy = (canvas.height - dh) / 2;
            dx = 0;
        }
        ctx.drawImage(bgImageRef.current, dx, dy, dw, dh);
        ctx.restore();
      }

      // --- 3. Beat Detection ---
      let bassSum = 0;
      for (let i = 0; i < 20; i++) bassSum += dataArray[i];
      const bassAvg = bassSum / 20;
      const isBeat = bassAvg > 200;

      // --- 4. Particles ---
      if (cfg.showParticles) {
        if (isBeat && particlesRef.current.length < cfg.particleCount) {
           for(let i=0; i<5; i++) {
               particlesRef.current.push(new Particle(canvas.width, canvas.height, i%2===0 ? cfg.primaryColor : cfg.secondaryColor, cfg.particleSpeed));
           }
        }
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.update();
          p.draw(ctx);
          if (p.life <= 0) particlesRef.current.splice(i, 1);
        }
      }

      // --- 5. Spectrum / Bars ---
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 200; 

      rotationAngle += cfg.rotationSpeed * 0.01;

      // Apply Bloom for Elements
      ctx.save();
      ctx.shadowBlur = cfg.bloomStrength;
      ctx.shadowColor = cfg.primaryColor;

      if (cfg.showBars) {
        const barsToRender = Math.min(cfg.barCount, bufferLength);
        const step = Math.floor(bufferLength / barsToRender);

        if (cfg.mode === 'circular') {
            ctx.translate(cx, cy);
            ctx.rotate(rotationAngle);

            for (let i = 0; i < barsToRender; i++) {
                const value = dataArray[i * step] * cfg.sensitivity;
                const h = value * cfg.barHeightScale;
                const angle = (i / barsToRender) * Math.PI * 2;
                
                const x1 = Math.cos(angle) * radius;
                const y1 = Math.sin(angle) * radius;
                const x2 = Math.cos(angle) * (radius + h);
                const y2 = Math.sin(angle) * (radius + h);

                ctx.strokeStyle = i % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor;
                ctx.lineWidth = cfg.barWidth;
                ctx.lineCap = 'round';
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            // Undo rotation for next elements if needed
            ctx.setTransform(1, 0, 0, 1, 0, 0); 
        } 
        else { // Linear
            const barW = (canvas.width / barsToRender);
            const centerY = canvas.height / 2;

            for (let i = 0; i < barsToRender; i++) {
                const value = dataArray[i * step] * cfg.sensitivity;
                const h = value * cfg.barHeightScale * 2;
                const x = i * barW;

                ctx.fillStyle = i % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor;

                if (cfg.mirror) {
                    const centerOffset = Math.abs((barsToRender/2) - i);
                    const mirroredH = dataArray[centerOffset * step] * cfg.sensitivity * cfg.barHeightScale * 2;
                    ctx.fillRect(x, centerY - mirroredH / 2, barW - 1, mirroredH);
                } else {
                     ctx.fillRect(x, canvas.height - h, barW - 1, h);
                }
            }
        }
      }
      ctx.restore(); // End Bloom

      // --- 6. Center Image (Logo) ---
      if (centerImageRef.current && centerImageRef.current.complete) {
        const size = 300 * cfg.centerImageSize;
        ctx.save();
        ctx.translate(cx, cy);
        
        if (cfg.centerImageCircular) {
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
        }
        
        ctx.drawImage(centerImageRef.current, -size/2, -size/2, size, size);
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Handlers
  const startRecording = () => {
    if (!canvasRef.current || !streamDestRef.current) return;
    const canvasStream = canvasRef.current.captureStream(30);
    const audioTrack = streamDestRef.current.stream.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    const mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9' });
    mediaRecorderRef.current = mediaRecorder;
    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setDownloadUrl(URL.createObjectURL(blob));
    };

    mediaRecorder.start();
    setIsRecording(true);
    if (audioRef.current?.paused) {
        audioRef.current.play();
        setIsPlaying(true);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'bg' | 'center') => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            if(type === 'bg') setConfig({...config, backgroundImage: evt.target?.result as string});
            else setConfig({...config, centerImage: evt.target?.result as string});
        };
        reader.readAsDataURL(file);
    }
  };

  // Helper Components
  const Slider = ({ label, value, min, max, step, onChange }: any) => (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>{label}</span>
        <span className="font-mono text-zinc-500">{typeof value === 'number' ? value.toFixed(1) : value}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
      />
    </div>
  );

  const ColorPicker = ({ label, value, onChange }: any) => (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <div className="flex items-center gap-2 p-1 bg-zinc-800 rounded-lg border border-zinc-700">
        <input 
            type="color" value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-6 rounded cursor-pointer border-none bg-transparent p-0" 
        />
        <input 
            type="text" value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-zinc-300 font-mono focus:ring-0"
        />
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-[#09090b]">
      
      {/* LEFT: Canvas Stage */}
      <div className="flex-1 relative flex flex-col bg-black overflow-hidden group">
         
         <div className="relative flex-1 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
            <canvas ref={canvasRef} className="w-full h-full object-contain max-h-[85vh] shadow-2xl" />
            
            {/* Play Button Overlay */}
            {!isRecording && (
                <button
                    onClick={togglePlay}
                    className={`absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-all duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
                >
                    <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:scale-110 hover:bg-white/20 transition-all border border-white/10 shadow-2xl">
                        {isPlaying ? <Pause className="fill-white text-white" size={40} /> : <Play className="fill-white text-white ml-2" size={40} />}
                    </div>
                </button>
            )}

            {/* Recording Badge */}
            {isRecording && (
                <div className="absolute top-6 right-6 flex items-center gap-3 bg-red-500/10 border border-red-500/50 backdrop-blur-md px-4 py-2 rounded-full shadow-lg z-10 animate-pulse">
                    <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                    <span className="text-xs font-bold text-red-400 tracking-wider">RECORDING</span>
                </div>
            )}
            
            <audio ref={audioRef} src={audioUrl} onEnded={() => { setIsPlaying(false); if(isRecording) stopRecording(); }} />
         </div>

         {/* Bottom Control Bar */}
         <div className="h-16 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="h-5 w-px bg-zinc-800"></div>
                <div className="text-sm text-zinc-300">
                   Preset: <span className="text-purple-400 font-semibold">{config.presetName}</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                 {!downloadUrl ? (
                     !isRecording ? (
                        <button onClick={startRecording} className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-red-900/20">
                            <div className="p-1 bg-white/20 rounded-full"><div className="w-2 h-2 bg-white rounded-full" /></div> Record
                        </button>
                     ) : (
                        <button onClick={stopRecording} className="flex items-center gap-2 px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold rounded-lg border border-zinc-700">
                            <div className="w-3 h-3 bg-red-500 rounded-sm" /> Stop Recording
                        </button>
                     )
                 ) : (
                    <a href={downloadUrl} download="visualizer.webm" className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-900/20 animate-in slide-in-from-bottom-2">
                        <Download size={18} /> Download Video
                    </a>
                 )}
            </div>
         </div>
      </div>

      {/* RIGHT: Editor Sidebar */}
      <div className="w-full md:w-96 bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0 z-30 shadow-2xl">
         <div className="p-5 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
            <h2 className="text-white font-semibold flex items-center gap-2 text-sm tracking-wide uppercase text-zinc-400">
                <Settings2 size={16} /> Configuration
            </h2>
         </div>
         
         {/* Tabs */}
         <div className="flex border-b border-zinc-800">
            {[
                { id: 'layout', icon: Layout, label: 'Layout' },
                { id: 'assets', icon: ImageIcon, label: 'Assets' },
                { id: 'color', icon: Palette, label: 'Colors' },
                { id: 'effects', icon: Zap, label: 'Effects' }
            ].map((tab: any) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-4 text-[10px] uppercase tracking-wider font-semibold flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'bg-zinc-900 text-purple-400 border-b-2 border-purple-500' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
                >
                    <tab.icon size={16} strokeWidth={2} />
                    {tab.label}
                </button>
            ))}
         </div>

         {/* Controls Area */}
         <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-900/30">
            
            {activeTab === 'layout' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-3 uppercase tracking-wider font-bold">Visual Mode</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setConfig({...config, mode: 'circular'})}
                                className={`py-3 text-xs font-medium rounded-lg border transition-all ${config.mode === 'circular' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
                            >
                                Circular
                            </button>
                            <button 
                                onClick={() => setConfig({...config, mode: 'linear'})}
                                className={`py-3 text-xs font-medium rounded-lg border transition-all ${config.mode === 'linear' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
                            >
                                Linear
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider font-bold">Visibility</label>
                        <label className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-800 hover:border-zinc-700 transition-all">
                            <span className="text-sm text-zinc-300">Show Spectrum Bars</span>
                            <input type="checkbox" checked={config.showBars} onChange={e => setConfig({...config, showBars: e.target.checked})} className="w-4 h-4 rounded accent-purple-500 bg-zinc-700 border-transparent focus:ring-0" />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-800 hover:border-zinc-700 transition-all">
                            <span className="text-sm text-zinc-300">Show Particles</span>
                            <input type="checkbox" checked={config.showParticles} onChange={e => setConfig({...config, showParticles: e.target.checked})} className="w-4 h-4 rounded accent-purple-500 bg-zinc-700 border-transparent focus:ring-0" />
                        </label>
                        {config.mode === 'linear' && (
                            <label className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-800 hover:border-zinc-700 transition-all">
                                <span className="text-sm text-zinc-300">Mirror Layout</span>
                                <input type="checkbox" checked={config.mirror} onChange={e => setConfig({...config, mirror: e.target.checked})} className="w-4 h-4 rounded accent-purple-500 bg-zinc-700 border-transparent focus:ring-0" />
                            </label>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-4 uppercase tracking-wider font-bold">Dimensions</label>
                        <Slider label="Bar Count" min={32} max={256} step={32} value={config.barCount} onChange={(v: number) => setConfig({...config, barCount: v})} />
                        <Slider label="Bar Width" min={1} max={30} step={1} value={config.barWidth} onChange={(v: number) => setConfig({...config, barWidth: v})} />
                        <Slider label="Height Scale" min={0.5} max={3} step={0.1} value={config.barHeightScale} onChange={(v: number) => setConfig({...config, barHeightScale: v})} />
                    </div>
                </div>
            )}

            {activeTab === 'assets' && (
                 <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Background Image */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Background Image</label>
                            {config.backgroundImage && (
                                <button onClick={() => setConfig({...config, backgroundImage: null})} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                    <Trash2 size={12} /> Remove
                                </button>
                            )}
                        </div>
                        
                        {!config.backgroundImage ? (
                             <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-800 hover:border-zinc-600 transition-all group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 text-zinc-500 group-hover:text-purple-400 mb-2 transition-colors" />
                                    <p className="text-xs text-zinc-400">Click to upload background</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'bg')} />
                            </label>
                        ) : (
                            <div className="space-y-4">
                                <div className="w-full h-32 rounded-lg bg-cover bg-center border border-zinc-700 relative overflow-hidden group">
                                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                         <label className="cursor-pointer bg-zinc-900/80 px-3 py-1.5 rounded text-xs text-white hover:bg-black">Change</label>
                                         <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'bg')} />
                                     </div>
                                     <img src={config.backgroundImage} className="w-full h-full object-cover" alt="bg-preview" />
                                </div>
                                <Slider label="Opacity" min={0} max={1} step={0.05} value={config.bgImageOpacity} onChange={(v: number) => setConfig({...config, bgImageOpacity: v})} />
                                <Slider label="Blur (px)" min={0} max={20} step={1} value={config.bgImageBlur} onChange={(v: number) => setConfig({...config, bgImageBlur: v})} />
                            </div>
                        )}
                    </div>

                    <hr className="border-zinc-800" />

                    {/* Center Image */}
                    <div>
                         <div className="flex items-center justify-between mb-3">
                            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Center Logo / Image</label>
                            {config.centerImage && (
                                <button onClick={() => setConfig({...config, centerImage: null})} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                    <Trash2 size={12} /> Remove
                                </button>
                            )}
                        </div>

                        {!config.centerImage ? (
                             <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-800 hover:border-zinc-600 transition-all group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-2 group-hover:bg-zinc-700 transition-colors">
                                       <ImageIcon className="w-6 h-6 text-zinc-500 group-hover:text-purple-400" />
                                    </div>
                                    <p className="text-xs text-zinc-400">Upload logo</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'center')} />
                            </label>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="w-20 h-20 shrink-0 bg-black rounded border border-zinc-700 flex items-center justify-center overflow-hidden">
                                        <img src={config.centerImage} className="max-w-full max-h-full object-contain" alt="center-preview" />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <label className="flex items-center justify-between p-2 bg-zinc-800/50 rounded cursor-pointer hover:bg-zinc-800">
                                            <span className="text-xs text-zinc-300">Circular Mask</span>
                                            <input type="checkbox" checked={config.centerImageCircular} onChange={e => setConfig({...config, centerImageCircular: e.target.checked})} className="accent-purple-500" />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-zinc-500 block mb-1">Upload New</span>
                                            <input type="file" className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700" accept="image/*" onChange={(e) => handleImageUpload(e, 'center')} />
                                        </label>
                                    </div>
                                </div>
                                <Slider label="Size Scale" min={0.2} max={2.0} step={0.1} value={config.centerImageSize} onChange={(v: number) => setConfig({...config, centerImageSize: v})} />
                            </div>
                        )}
                    </div>
                 </div>
            )}

            {activeTab === 'color' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                         <label className="block text-xs text-zinc-400 mb-4 uppercase tracking-wider font-bold">Palette</label>
                         <ColorPicker label="Primary Color" value={config.primaryColor} onChange={(v: string) => setConfig({...config, primaryColor: v})} />
                         <ColorPicker label="Secondary Color" value={config.secondaryColor} onChange={(v: string) => setConfig({...config, secondaryColor: v})} />
                         <ColorPicker label="Background Color" value={config.backgroundColor} onChange={(v: string) => setConfig({...config, backgroundColor: v})} />
                    </div>
                </div>
            )}

            {activeTab === 'effects' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                     <div>
                        <label className="block text-xs text-zinc-400 mb-4 uppercase tracking-wider font-bold">Audio Reactivity</label>
                        <Slider label="Sensitivity" min={0.1} max={3} step={0.1} value={config.sensitivity} onChange={(v: number) => setConfig({...config, sensitivity: v})} />
                        <Slider label="Smoothing" min={0.1} max={0.95} step={0.05} value={config.smoothing} onChange={(v: number) => setConfig({...config, smoothing: v})} />
                     </div>

                     <div>
                        <label className="block text-xs text-zinc-400 mb-4 uppercase tracking-wider font-bold">Post Processing</label>
                        <Slider label="Bloom Strength" min={0} max={50} step={1} value={config.bloomStrength} onChange={(v: number) => setConfig({...config, bloomStrength: v})} />
                        {config.mode === 'circular' && (
                            <Slider label="Rotation Speed" min={-5} max={5} step={0.1} value={config.rotationSpeed} onChange={(v: number) => setConfig({...config, rotationSpeed: v})} />
                        )}
                     </div>

                     {config.showParticles && (
                         <div>
                            <label className="block text-xs text-zinc-400 mb-4 uppercase tracking-wider font-bold">Particles</label>
                            <Slider label="Max Count" min={10} max={300} step={10} value={config.particleCount} onChange={(v: number) => setConfig({...config, particleCount: v})} />
                            <Slider label="Speed" min={0.5} max={10} step={0.5} value={config.particleSpeed} onChange={(v: number) => setConfig({...config, particleSpeed: v})} />
                         </div>
                     )}
                </div>
            )}

         </div>
      </div>
    </div>
  );
};
