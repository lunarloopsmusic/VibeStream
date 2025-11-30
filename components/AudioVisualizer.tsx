
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Play, Pause, Download, Video, Settings2, Sliders, Palette, Zap, Layout } from 'lucide-react';
import { VisualizerConfig } from '../types';

interface AudioVisualizerProps {
  audioUrl: string;
  config: VisualizerConfig;
  onBack: () => void;
}

// Particle Class for the visualizer
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
  const [activeTab, setActiveTab] = useState<'layout' | 'color' | 'effects'>('layout');

  // Refs for Rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();
  const streamDestRef = useRef<MediaStreamAudioDestinationNode>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Ref for mutable config access inside requestAnimationFrame
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  // Particles Ref
  const particlesRef = useRef<Particle[]>([]);

  // Initialize Audio
  useEffect(() => {
    if (!audioRef.current) return;

    const initAudio = () => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; // High resolution
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
  }, []); // Run once

  // Update Analyser smoothing when config changes
  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.smoothingTimeConstant = config.smoothing;
    }
  }, [config.smoothing]);

  // Main Render Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HD Resolution
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

      // --- Background ---
      ctx.fillStyle = cfg.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- Beat Detection (Simple) ---
      // Calculate average of low frequencies (Bass)
      let bassSum = 0;
      for (let i = 0; i < 20; i++) bassSum += dataArray[i];
      const bassAvg = bassSum / 20;
      const isBeat = bassAvg > 200; // Threshold

      // --- Particles System ---
      if (cfg.showParticles) {
        // Spawn particles on beat
        if (isBeat && particlesRef.current.length < cfg.particleCount) {
           for(let i=0; i<5; i++) {
               particlesRef.current.push(new Particle(canvas.width, canvas.height, i%2===0 ? cfg.primaryColor : cfg.secondaryColor, cfg.particleSpeed));
           }
        }
        
        // Update and draw particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.update();
          p.draw(ctx);
          if (p.life <= 0) particlesRef.current.splice(i, 1);
        }
      }

      // --- Bloom Effect Setup ---
      ctx.shadowBlur = cfg.bloomStrength;
      ctx.shadowColor = cfg.primaryColor;

      // --- Spectrum Drawing ---
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 200; // Initial radius for circular

      rotationAngle += cfg.rotationSpeed * 0.01;

      if (cfg.showBars) {
        const barsToRender = Math.min(cfg.barCount, bufferLength);
        const step = Math.floor(bufferLength / barsToRender);

        if (cfg.mode === 'circular') {
            ctx.save();
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
            ctx.restore();
        } 
        else { // Linear Mode
            const barW = (canvas.width / barsToRender);
            const centerY = canvas.height / 2;

            for (let i = 0; i < barsToRender; i++) {
                const value = dataArray[i * step] * cfg.sensitivity;
                const h = value * cfg.barHeightScale * 2; // Taller for linear
                const x = i * barW;

                ctx.fillStyle = i % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor;

                if (cfg.mirror) {
                    // Mirror from center
                    const centerOffset = Math.abs((barsToRender/2) - i);
                    const mirroredH = dataArray[centerOffset * step] * cfg.sensitivity * cfg.barHeightScale * 2;
                    
                    ctx.fillRect(x, centerY - mirroredH / 2, barW - 1, mirroredH);
                } else {
                    // Standard bottom-up
                     ctx.fillRect(x, canvas.height - h, barW - 1, h);
                }
            }
        }
      }

      ctx.shadowBlur = 0; // Reset bloom for next frame
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []); // Dependencies are handled via refs

  // --- Handlers (Record, Play, etc) ---
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

  // --- Editor UI Components ---
  const Slider = ({ label, value, min, max, step, onChange }: any) => (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
      />
    </div>
  );

  const ColorPicker = ({ label, value, onChange }: any) => (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input 
            type="color" value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" 
        />
        <input 
            type="text" value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 font-mono"
        />
      </div>
    </div>
  );

  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4 animate-in fade-in zoom-in duration-500">
      
      {/* LEFT: Canvas Stage */}
      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden relative flex flex-col shadow-2xl">
         <div className="relative flex-1 bg-black flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain max-h-[80vh]" />
            
            {/* Play Button Overlay */}
            {!isRecording && (
                <button
                    onClick={togglePlay}
                    className={`absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
                >
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform">
                        {isPlaying ? <Pause className="fill-white text-white" size={32} /> : <Play className="fill-white text-white ml-1" size={32} />}
                    </div>
                </button>
            )}

            {/* Recording Badge */}
            {isRecording && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full shadow-lg animate-pulse z-10">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    <span className="text-xs font-bold tracking-wider">REC</span>
                </div>
            )}
            
            <audio ref={audioRef} src={audioUrl} onEnded={() => { setIsPlaying(false); if(isRecording) stopRecording(); }} />
         </div>

         {/* Bottom Action Bar */}
         <div className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-zinc-400 hover:text-white text-sm">Back</button>
                <div className="h-4 w-px bg-zinc-700"></div>
                <div className="text-sm text-zinc-300 font-medium">
                   Preset: <span className="text-purple-400">{config.presetName}</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                 {!downloadUrl ? (
                     !isRecording ? (
                        <button onClick={startRecording} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-md transition-colors shadow-lg shadow-red-900/20">
                            <Video size={16} /> Start Record
                        </button>
                     ) : (
                        <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold rounded-md border border-zinc-600">
                            <div className="w-3 h-3 bg-white rounded-sm" /> Stop
                        </button>
                     )
                 ) : (
                    <a href={downloadUrl} download="visualizer.webm" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-md shadow-lg shadow-green-900/20 animate-in slide-in-from-bottom-2">
                        <Download size={16} /> Download
                    </a>
                 )}
            </div>
         </div>
      </div>

      {/* RIGHT: Editor Sidebar */}
      <div className="w-full md:w-80 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
         <div className="p-4 border-b border-zinc-800 bg-zinc-950">
            <h2 className="text-white font-semibold flex items-center gap-2">
                <Settings2 size={18} className="text-purple-500" /> Editor
            </h2>
         </div>
         
         {/* Tabs */}
         <div className="flex border-b border-zinc-800">
            {[
                { id: 'layout', icon: Layout, label: 'Layout' },
                { id: 'color', icon: Palette, label: 'Colors' },
                { id: 'effects', icon: Zap, label: 'Effects' }
            ].map((tab: any) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'bg-zinc-800 text-white border-b-2 border-purple-500' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
         </div>

         {/* Controls Area */}
         <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            
            {activeTab === 'layout' && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Style Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setConfig({...config, mode: 'circular'})}
                                className={`py-2 text-xs rounded border ${config.mode === 'circular' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                            >
                                Circular
                            </button>
                            <button 
                                onClick={() => setConfig({...config, mode: 'linear'})}
                                className={`py-2 text-xs rounded border ${config.mode === 'linear' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                            >
                                Linear
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Elements</label>
                        <div className="space-y-2">
                            <label className="flex items-center justify-between p-2 bg-zinc-800/50 rounded cursor-pointer hover:bg-zinc-800">
                                <span className="text-sm text-zinc-300">Show Bars</span>
                                <input type="checkbox" checked={config.showBars} onChange={e => setConfig({...config, showBars: e.target.checked})} className="accent-purple-500" />
                            </label>
                            <label className="flex items-center justify-between p-2 bg-zinc-800/50 rounded cursor-pointer hover:bg-zinc-800">
                                <span className="text-sm text-zinc-300">Show Particles</span>
                                <input type="checkbox" checked={config.showParticles} onChange={e => setConfig({...config, showParticles: e.target.checked})} className="accent-purple-500" />
                            </label>
                            {config.mode === 'linear' && (
                                <label className="flex items-center justify-between p-2 bg-zinc-800/50 rounded cursor-pointer hover:bg-zinc-800">
                                    <span className="text-sm text-zinc-300">Mirror Layout</span>
                                    <input type="checkbox" checked={config.mirror} onChange={e => setConfig({...config, mirror: e.target.checked})} className="accent-purple-500" />
                                </label>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Dimensions</label>
                        <Slider label="Bar Count" min={32} max={256} step={32} value={config.barCount} onChange={(v: number) => setConfig({...config, barCount: v})} />
                        <Slider label="Bar Width" min={1} max={30} step={1} value={config.barWidth} onChange={(v: number) => setConfig({...config, barWidth: v})} />
                        <Slider label="Height Scale" min={0.5} max={3} step={0.1} value={config.barHeightScale} onChange={(v: number) => setConfig({...config, barHeightScale: v})} />
                    </div>
                </div>
            )}

            {activeTab === 'color' && (
                <div className="space-y-6">
                    <ColorPicker label="Primary Color" value={config.primaryColor} onChange={(v: string) => setConfig({...config, primaryColor: v})} />
                    <ColorPicker label="Secondary Color" value={config.secondaryColor} onChange={(v: string) => setConfig({...config, secondaryColor: v})} />
                    <ColorPicker label="Background Color" value={config.backgroundColor} onChange={(v: string) => setConfig({...config, backgroundColor: v})} />
                </div>
            )}

            {activeTab === 'effects' && (
                <div className="space-y-6">
                     <div>
                        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Audio Reactivity</label>
                        <Slider label="Sensitivity" min={0.1} max={3} step={0.1} value={config.sensitivity} onChange={(v: number) => setConfig({...config, sensitivity: v})} />
                        <Slider label="Smoothing" min={0.1} max={0.95} step={0.05} value={config.smoothing} onChange={(v: number) => setConfig({...config, smoothing: v})} />
                     </div>

                     <div>
                        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Visual FX</label>
                        <Slider label="Bloom Strength" min={0} max={50} step={1} value={config.bloomStrength} onChange={(v: number) => setConfig({...config, bloomStrength: v})} />
                        {config.mode === 'circular' && (
                            <Slider label="Rotation Speed" min={-5} max={5} step={0.1} value={config.rotationSpeed} onChange={(v: number) => setConfig({...config, rotationSpeed: v})} />
                        )}
                     </div>

                     {config.showParticles && (
                         <div>
                            <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Particles</label>
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
