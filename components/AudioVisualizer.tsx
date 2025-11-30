
import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download, Settings2, Layout, Palette, Zap, Image as ImageIcon, Type, Grid, ArrowLeft, Monitor, Trash2 } from 'lucide-react';
import { VisualizerConfig, TextConfig } from '../types';

interface AudioVisualizerProps {
  audioUrl: string;
  config: VisualizerConfig;
  onBack: () => void;
}

// --- PRESETS LIBRARY ---
const PRESETS: Partial<VisualizerConfig>[] = [
  { presetName: "Neon Pulse", mode: "circular", primaryColor: "#d946ef", secondaryColor: "#4f46e5", backgroundColor: "#0f0518", showParticles: true, bloomStrength: 30, text: { enabled: true, fontFamily: 'Inter', color: '#fff' } as any },
  { presetName: "Deep Zen", mode: "linear", primaryColor: "#2dd4bf", secondaryColor: "#0d9488", backgroundColor: "#041816", showParticles: true, particleSpeed: 0.5, bloomStrength: 10, mirror: true },
  { presetName: "Inferno", mode: "circular", primaryColor: "#ef4444", secondaryColor: "#f97316", backgroundColor: "#1a0505", showParticles: true, particleCount: 150, particleSpeed: 4, bloomStrength: 40 },
  { presetName: "Mono Minimal", mode: "linear", primaryColor: "#ffffff", secondaryColor: "#52525b", backgroundColor: "#000000", showParticles: false, bloomStrength: 0, barWidth: 10, barCount: 32 },
  { presetName: "Cyber Retro", mode: "linear", primaryColor: "#22d3ee", secondaryColor: "#e879f9", backgroundColor: "#110e1c", showParticles: true, mirror: false, barHeightScale: 2.0, cinematicBars: true }
];

// --- PARTICLE SYSTEM ---
class Particle {
  x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; maxLife: number;
  constructor(w: number, h: number, color: string, speed: number) {
    this.x = w / 2;
    this.y = h / 2;
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * speed + 0.5;
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
    this.size *= 0.98;
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
  const [config, setConfig] = useState<VisualizerConfig>(initialConfig);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'layout' | 'color' | 'effects' | 'assets' | 'text' | 'templates'>('templates');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const centerImageRef = useRef<HTMLImageElement | null>(null);
  const configRef = useRef(config);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => { configRef.current = config; }, [config]);

  // Init Audio & Loop
  useEffect(() => {
    if (!audioRef.current) return;
    const initAudio = () => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      
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

    const handleInteract = () => {
      if (!audioContextRef.current) initAudio();
      else if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
    };
    document.addEventListener('click', handleInteract, { once: true });

    return () => {
        document.removeEventListener('click', handleInteract);
        if (audioContextRef.current) audioContextRef.current.close();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Update Analyser
  useEffect(() => {
    if (analyserRef.current) analyserRef.current.smoothingTimeConstant = config.smoothing;
  }, [config.smoothing]);

  // Image Loaders
  useEffect(() => {
    if (config.backgroundImage && bgImageRef.current?.src !== config.backgroundImage) {
        const img = new Image(); img.src = config.backgroundImage; bgImageRef.current = img;
    } else if (!config.backgroundImage) bgImageRef.current = null;
    if (config.centerImage && centerImageRef.current?.src !== config.centerImage) {
        const img = new Image(); img.src = config.centerImage; centerImageRef.current = img;
    } else if (!config.centerImage) centerImageRef.current = null;
  }, [config.backgroundImage, config.centerImage]);

  // --- RENDER LOOP ---
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // High DPI Support
    const dpr = window.devicePixelRatio || 1;
    // We render at 1080p internally but scale for display
    canvas.width = 1920; 
    canvas.height = 1080;

    let rotationAngle = 0;

    const render = () => {
      if (!analyserRef.current) { animationRef.current = requestAnimationFrame(render); return; }
      
      const cfg = configRef.current;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      // 1. Background
      ctx.fillStyle = cfg.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. BG Image
      if (bgImageRef.current && bgImageRef.current.complete) {
        ctx.save();
        if (cfg.bgImageBlur > 0) ctx.filter = `blur(${cfg.bgImageBlur}px)`;
        ctx.globalAlpha = cfg.bgImageOpacity;
        const imgRatio = bgImageRef.current.width / bgImageRef.current.height;
        const canvasRatio = canvas.width / canvas.height;
        let dw, dh, dx, dy;
        if (imgRatio > canvasRatio) { dh = canvas.height; dw = dh * imgRatio; dx = (canvas.width - dw) / 2; dy = 0; } 
        else { dw = canvas.width; dh = dw / imgRatio; dy = (canvas.height - dh) / 2; dx = 0; }
        ctx.drawImage(bgImageRef.current, dx, dy, dw, dh);
        ctx.restore();
      }

      // Beat Detect
      let bassSum = 0; for (let i = 0; i < 20; i++) bassSum += dataArray[i];
      const isBeat = (bassSum / 20) > 180; // High threshold

      // 3. Particles
      if (cfg.showParticles) {
        if (isBeat && particlesRef.current.length < cfg.particleCount) {
           for(let i=0; i<4; i++) particlesRef.current.push(new Particle(canvas.width, canvas.height, i%2===0 ? cfg.primaryColor : cfg.secondaryColor, cfg.particleSpeed));
        }
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.update();
          p.draw(ctx);
          if (p.life <= 0) particlesRef.current.splice(i, 1);
        }
      }

      // 4. Spectrum
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 250; 
      rotationAngle += cfg.rotationSpeed * 0.01;

      ctx.save();
      ctx.shadowBlur = cfg.bloomStrength;
      ctx.shadowColor = cfg.primaryColor;

      const barsToRender = Math.min(cfg.barCount, bufferLength);
      const step = Math.floor(bufferLength / barsToRender);

      if (cfg.mode === 'circular') {
            ctx.translate(cx, cy);
            ctx.rotate(rotationAngle);
            if(isBeat) ctx.scale(1.02, 1.02); // Beat Pulse

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
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            }
      } else {
            const barW = (canvas.width / barsToRender);
            for (let i = 0; i < barsToRender; i++) {
                const value = dataArray[i * step] * cfg.sensitivity;
                const h = value * cfg.barHeightScale * 2.5;
                const x = i * barW;
                ctx.fillStyle = i % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor;
                if (cfg.mirror) {
                    const centerOffset = Math.abs((barsToRender/2) - i);
                    const mirroredH = dataArray[centerOffset * step] * cfg.sensitivity * cfg.barHeightScale * 2.5;
                    ctx.fillRect(x, (canvas.height/2) - mirroredH/2, barW-1, mirroredH);
                } else {
                    ctx.fillRect(x, canvas.height - h, barW-1, h);
                }
            }
      }
      ctx.restore();

      // 5. Center Image
      if (centerImageRef.current && centerImageRef.current.complete) {
        const size = 300 * cfg.centerImageSize * (isBeat ? 1.05 : 1);
        ctx.save();
        ctx.translate(cx, cy);
        if (cfg.centerImageCircular) {
            ctx.beginPath(); ctx.arc(0, 0, size/2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        }
        ctx.drawImage(centerImageRef.current, -size/2, -size/2, size, size);
        ctx.restore();
      }

      // 6. Text Overlay
      if (cfg.text.enabled) {
          ctx.save();
          ctx.font = `bold ${cfg.text.fontSize}px ${cfg.text.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = cfg.text.color;
          ctx.globalAlpha = cfg.text.opacity;
          if (cfg.text.shadow) {
              ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
          }
          
          // Positioning
          const textY = cfg.mode === 'circular' ? canvas.height - 100 : 150;
          
          if (cfg.text.topText) ctx.fillText(cfg.text.topText.toUpperCase(), cx, textY);
          
          ctx.font = `${cfg.text.fontSize * 0.5}px ${cfg.text.fontFamily}`;
          ctx.letterSpacing = `${cfg.text.letterSpacing}px`;
          if (cfg.text.bottomText) ctx.fillText(cfg.text.bottomText, cx, textY + cfg.text.fontSize);
          ctx.restore();
      }

      // 7. Post Processing: Vignette & Bars
      if (cfg.vignette > 0) {
          ctx.save();
          const grad = ctx.createRadialGradient(cx, cy, canvas.height/2, cx, cy, canvas.height);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
      }

      if (cfg.cinematicBars) {
          ctx.fillStyle = '#000';
          const barHeight = canvas.height * 0.1; // 10% top and bottom
          ctx.fillRect(0, 0, canvas.width, barHeight);
          ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
      }

      animationRef.current = requestAnimationFrame(render);
    };
    render();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  // Controls
  const togglePlay = () => {
    if (audioRef.current) { isPlaying ? audioRef.current.pause() : audioRef.current.play(); setIsPlaying(!isPlaying); }
  };
  const startRecording = () => {
    if (!canvasRef.current || !streamDestRef.current) return;
    const canvasStream = canvasRef.current.captureStream(60); // 60FPS
    const audioTrack = streamDestRef.current.stream.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);
    const mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
    mediaRecorderRef.current = mediaRecorder;
    recordedChunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setDownloadUrl(URL.createObjectURL(blob));
    };
    mediaRecorder.start();
    setIsRecording(true);
    if (audioRef.current?.paused) { audioRef.current.play(); setIsPlaying(true); }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop(); setIsRecording(false);
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); }
  };

  // Helper
  const Slider = ({ label, value, min, max, step, onChange }: any) => (
    <div className="mb-5">
      <div className="flex justify-between text-[11px] text-zinc-500 uppercase font-semibold tracking-wider mb-2">
        <span>{label}</span>
        <span>{typeof value === 'number' ? value.toFixed(1) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400" />
    </div>
  );
  
  const ColorInput = ({ label, value, onChange }: any) => (
    <div className="mb-4">
      <label className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider mb-2 block">{label}</label>
      <div className="flex gap-2">
         <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-10 h-10 bg-transparent border border-zinc-700 rounded cursor-pointer" />
         <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded px-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-indigo-500" />
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen flex flex-col md:flex-row bg-[#050505] text-zinc-200 overflow-hidden font-sans">
      
      {/* LEFT: CANVAS AREA */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-[#0a0a0f] overflow-hidden">
         {/* Canvas Wrapper for scaling */}
         <div className="relative w-full h-full p-4 md:p-12 flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain max-h-[80vh] shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm border border-white/5" />
            
            {/* Download Overlay */}
            {downloadUrl && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
                    <div className="bg-[#111] p-8 rounded-2xl border border-zinc-800 shadow-2xl text-center max-w-md">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Download className="text-green-500" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Video Ready</h3>
                        <p className="text-zinc-400 text-sm mb-6">Your visualizer has been rendered. Download it below.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDownloadUrl(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Close</button>
                            <a href={downloadUrl} download="vibestream-render.webm" className="px-6 py-2 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200">Download .WEBM</a>
                        </div>
                    </div>
                </div>
            )}
         </div>

         {/* FLOATING CONTROL BAR */}
         <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-6 px-6 py-3 bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl hover:scale-105 transition-transform duration-300">
            <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-lg">
                {isPlaying ? <Pause className="fill-current" size={20} /> : <Play className="fill-current ml-1" size={20} />}
            </button>
            
            <div className="flex flex-col w-64 gap-1">
                 <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                    <span>{audioRef.current ? (audioRef.current.currentTime / 60).toFixed(2).replace('.',':') : "0:00"}</span>
                    <span>{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
                 </div>
                 <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-pulse" style={{width: '100%'}} /> 
                 </div>
            </div>

            <div className="h-8 w-px bg-white/10" />

            {!isRecording ? (
                <button onClick={startRecording} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-xs font-bold uppercase tracking-wider transition-all">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> REC
                </button>
            ) : (
                <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition-all animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-sm" /> STOP
                </button>
            )}
         </div>

         {/* Back Button */}
         <button onClick={onBack} className="absolute top-6 left-6 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-medium uppercase tracking-wider z-50">
            <ArrowLeft size={16} /> New Project
         </button>
         
         <audio ref={audioRef} src={audioUrl} onEnded={() => { setIsPlaying(false); if(isRecording) stopRecording(); }} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />
      </div>

      {/* RIGHT: PROFESSIONAL SIDEBAR */}
      <div className="w-full md:w-[400px] bg-[#09090b] border-l border-white/5 flex flex-col shrink-0 z-50 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
         <div className="p-6 border-b border-white/5">
            <h2 className="text-white font-bold flex items-center gap-2 tracking-tight">
                <Settings2 size={18} className="text-indigo-500" /> Studio Config
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Customize your render pipeline.</p>
         </div>

         {/* Tabs */}
         <div className="flex border-b border-white/5 overflow-x-auto no-scrollbar">
            {[
                { id: 'templates', icon: Grid, label: 'Presets' },
                { id: 'text', icon: Type, label: 'Text' },
                { id: 'layout', icon: Layout, label: 'Layout' },
                { id: 'color', icon: Palette, label: 'Colors' },
                { id: 'assets', icon: ImageIcon, label: 'Assets' },
            ].map((tab: any) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-none px-5 py-4 text-[10px] uppercase tracking-wider font-semibold flex flex-col items-center gap-2 transition-all border-b-2
                    ${activeTab === tab.id ? 'border-indigo-500 text-white bg-white/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
                    <tab.icon size={16} /> {tab.label}
                </button>
            ))}
         </div>

         {/* Scrollable Content */}
         <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
            
            {/* TEMPLATES TAB */}
            {activeTab === 'templates' && (
                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-right-4 duration-300">
                    {PRESETS.map((p, i) => (
                        <button key={i} onClick={() => setConfig({...config, ...p})}
                            className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02]
                            ${config.presetName === p.presetName ? 'bg-indigo-600 border-indigo-500 ring-2 ring-indigo-500/30' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}`}>
                            <div className="w-full h-12 rounded-lg mb-3" style={{ background: `linear-gradient(45deg, ${p.primaryColor}, ${p.secondaryColor})`}} />
                            <div className="font-semibold text-sm text-white">{p.presetName}</div>
                            <div className="text-[10px] text-zinc-400 mt-1 capitalize">{p.mode} Mode</div>
                        </button>
                    ))}
                </div>
            )}

            {/* TEXT TAB */}
            {activeTab === 'text' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                        <span className="text-sm font-medium">Enable Overlay</span>
                        <input type="checkbox" checked={config.text.enabled} onChange={e => setConfig({...config, text: {...config.text, enabled: e.target.checked}})} className="accent-indigo-500 w-4 h-4" />
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Top Line (Artist)</label>
                            <input type="text" value={config.text.topText} onChange={e => setConfig({...config, text: {...config.text, topText: e.target.value}})} 
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Bottom Line (Title)</label>
                            <input type="text" value={config.text.bottomText} onChange={e => setConfig({...config, text: {...config.text, bottomText: e.target.value}})} 
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                        </div>
                    </div>
                    
                    <hr className="border-white/5" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Font</label>
                            <select value={config.text.fontFamily} onChange={e => setConfig({...config, text: {...config.text, fontFamily: e.target.value}})}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white">
                                <option value="Inter">Modern (Inter)</option>
                                <option value="Playfair Display">Serif (Playfair)</option>
                                <option value="JetBrains Mono">Code (Mono)</option>
                            </select>
                        </div>
                        <ColorInput label="Color" value={config.text.color} onChange={(v: string) => setConfig({...config, text: {...config.text, color: v}})} />
                    </div>

                    <Slider label="Font Size" min={20} max={100} step={1} value={config.text.fontSize} onChange={(v: number) => setConfig({...config, text: {...config.text, fontSize: v}})} />
                    <Slider label="Letter Spacing" min={0} max={20} step={1} value={config.text.letterSpacing} onChange={(v: number) => setConfig({...config, text: {...config.text, letterSpacing: v}})} />
                </div>
            )}

            {/* LAYOUT TAB */}
            {activeTab === 'layout' && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                        <button onClick={() => setConfig({...config, mode: 'circular'})} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${config.mode==='circular' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}>Circular</button>
                        <button onClick={() => setConfig({...config, mode: 'linear'})} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${config.mode==='linear' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}>Linear</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div className={`p-3 rounded-lg border cursor-pointer transition-all ${config.cinematicBars ? 'bg-indigo-500/20 border-indigo-500' : 'bg-zinc-900 border-zinc-800'}`} onClick={() => setConfig({...config, cinematicBars: !config.cinematicBars})}>
                             <Monitor size={20} className="mb-2 text-zinc-400" />
                             <div className="text-xs font-medium">Cinema Bars</div>
                         </div>
                         <div className={`p-3 rounded-lg border cursor-pointer transition-all ${config.mirror ? 'bg-indigo-500/20 border-indigo-500' : 'bg-zinc-900 border-zinc-800'}`} onClick={() => setConfig({...config, mirror: !config.mirror})}>
                             <Layout size={20} className="mb-2 text-zinc-400" />
                             <div className="text-xs font-medium">Mirror</div>
                         </div>
                    </div>
                    
                    <hr className="border-white/5" />
                    <Slider label="Bar Count" min={32} max={256} step={16} value={config.barCount} onChange={(v: number) => setConfig({...config, barCount: v})} />
                    <Slider label="Bar Width" min={1} max={30} step={1} value={config.barWidth} onChange={(v: number) => setConfig({...config, barWidth: v})} />
                    <Slider label="Bar Height" min={0.5} max={3} step={0.1} value={config.barHeightScale} onChange={(v: number) => setConfig({...config, barHeightScale: v})} />
                 </div>
            )}

            {/* COLOR TAB */}
            {activeTab === 'color' && (
                <div className="animate-in slide-in-from-right-4 duration-300">
                    <ColorInput label="Primary" value={config.primaryColor} onChange={(v: string) => setConfig({...config, primaryColor: v})} />
                    <ColorInput label="Secondary" value={config.secondaryColor} onChange={(v: string) => setConfig({...config, secondaryColor: v})} />
                    <ColorInput label="Background" value={config.backgroundColor} onChange={(v: string) => setConfig({...config, backgroundColor: v})} />
                    <hr className="border-white/5 my-6" />
                    <Slider label="Bloom Glow" min={0} max={60} step={1} value={config.bloomStrength} onChange={(v: number) => setConfig({...config, bloomStrength: v})} />
                    <Slider label="Vignette" min={0} max={1} step={0.1} value={config.vignette} onChange={(v: number) => setConfig({...config, vignette: v})} />
                </div>
            )}

            {/* ASSETS TAB */}
            {activeTab === 'assets' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs text-zinc-500 font-bold uppercase">Background</label>
                            {config.backgroundImage && <button onClick={() => setConfig({...config, backgroundImage: null})} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>}
                        </div>
                        <label className="block w-full h-24 border border-dashed border-zinc-700 rounded-xl hover:bg-white/5 cursor-pointer relative overflow-hidden group">
                             {config.backgroundImage ? (
                                <img src={config.backgroundImage} className="w-full h-full object-cover opacity-50" />
                             ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-xs">Click to Upload</div>
                             )}
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                 const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (v) => setConfig({...config, backgroundImage: v.target?.result as string}); r.readAsDataURL(f); }
                             }} />
                        </label>
                        {config.backgroundImage && (
                            <div className="mt-4">
                                <Slider label="Opacity" min={0} max={1} step={0.1} value={config.bgImageOpacity} onChange={(v: number) => setConfig({...config, bgImageOpacity: v})} />
                                <Slider label="Blur" min={0} max={20} step={1} value={config.bgImageBlur} onChange={(v: number) => setConfig({...config, bgImageBlur: v})} />
                            </div>
                        )}
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};
