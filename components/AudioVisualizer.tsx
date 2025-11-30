import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download, Video, Loader2 } from 'lucide-react';
import { VisualizerConfig } from '../types';

interface AudioVisualizerProps {
  audioUrl: string;
  config: VisualizerConfig;
  onBack: () => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioUrl, config, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();
  
  // Recorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode>();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Initialize Audio Context
  useEffect(() => {
    if (!audioRef.current) return;

    const initAudio = () => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      
      const source = ctx.createMediaElementSource(audioRef.current!);
      
      // Create a destination for recording audio
      const streamDest = ctx.createMediaStreamDestination();
      
      // Connect: Source -> Analyser -> Speakers
      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      // Also connect: Source -> Recorder Destination
      source.connect(streamDest);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamDestRef.current = streamDest;
    };

    // Browsers require user interaction to start AudioContext
    const handleFirstClick = () => {
      if (!audioContextRef.current) {
        initAudio();
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    document.addEventListener('click', handleFirstClick, { once: true });
    return () => {
        document.removeEventListener('click', handleFirstClick);
        if (audioContextRef.current) audioContextRef.current.close();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Drawing Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for HD
    canvas.width = 1280;
    canvas.height = 720;

    const render = () => {
      if (!analyserRef.current) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Clear Canvas
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      // VISUALIZER STYLES
      if (config.style === 'bars') {
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i] * config.sensitivity * 1.5;
          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
          gradient.addColorStop(0, config.primaryColor);
          gradient.addColorStop(1, config.secondaryColor);
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      } 
      else if (config.style === 'wave') {
        ctx.lineWidth = 4;
        ctx.strokeStyle = config.primaryColor;
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }
      else if (config.style === 'orb') {
        // Average frequency for radius
        let sum = 0;
        for(let i=0; i<bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        const radius = 50 + (average * config.sensitivity);

        ctx.beginPath();
        ctx.arc(width/2, height/2, radius, 0, 2 * Math.PI);
        ctx.fillStyle = config.primaryColor + '40'; // Transparent
        ctx.fill();
        ctx.strokeStyle = config.secondaryColor;
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      else { // particles (default fallback)
        const centerX = width / 2;
        const centerY = height / 2;
        for (let i = 0; i < 50; i++) {
            const val = dataArray[i * 4]; // sample sparsely
            const rad = 200 + (val * config.sensitivity * 0.5);
            const angle = (i / 50) * Math.PI * 2;
            const px = centerX + Math.cos(angle) * rad;
            const py = centerY + Math.sin(angle) * rad;
            
            ctx.beginPath();
            ctx.arc(px, py, val * 0.1, 0, 2*Math.PI);
            ctx.fillStyle = i % 2 === 0 ? config.primaryColor : config.secondaryColor;
            ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [config]);

  // Recording Logic
  const startRecording = () => {
    if (!canvasRef.current || !streamDestRef.current) return;
    
    // 1. Capture Canvas Stream (30 FPS)
    const canvasStream = canvasRef.current.captureStream(30);
    
    // 2. Add Audio Track to the stream
    const audioTrack = streamDestRef.current.stream.getAudioTracks()[0];
    if (audioTrack) {
        canvasStream.addTrack(audioTrack);
    }

    // 3. Init Recorder
    const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorderRef.current = mediaRecorder;
    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
    };

    mediaRecorder.start();
    setIsRecording(true);
    
    // Auto-play audio if not playing
    if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        // Also pause audio
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        if (isRecording) stopRecording(); // Stop recording if pause is hit
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in zoom-in duration-500">
      
      {/* Visualizer Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="aspect-video bg-black relative flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
            
            {/* Hidden Audio Element */}
            <audio 
                ref={audioRef} 
                src={audioUrl} 
                onEnded={() => {
                    setIsPlaying(false);
                    if (isRecording) stopRecording();
                }} 
            />

            {/* Controls Overlay */}
            <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPlaying && !isRecording ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
               {!isRecording && (
                    <button
                    onClick={togglePlay}
                    className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all hover:scale-105"
                    >
                    {isPlaying ? <Pause size={32} className="text-white fill-current" /> : <Play size={32} className="text-white fill-current ml-1" />}
                    </button>
               )}
            </div>

            {/* Recording Indicator */}
            {isRecording && (
                <div className="absolute top-6 right-6 flex items-center gap-2 bg-red-500/90 text-white px-4 py-2 rounded-full animate-pulse shadow-lg shadow-red-900/50">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                    <span className="font-bold text-sm tracking-wide">RECORDING</span>
                </div>
            )}
        </div>

        {/* Action Bar */}
        <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: config.primaryColor}}></span>
                    {config.moodDescription}
                </h3>
                <p className="text-zinc-500 text-sm">Gemini chose the '{config.style}' style for this track.</p>
            </div>

            <div className="flex items-center gap-3">
                 <button onClick={onBack} className="text-zinc-400 hover:text-white text-sm px-4">
                    Back
                 </button>

                 {!downloadUrl ? (
                     !isRecording ? (
                        <button 
                            onClick={startRecording}
                            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all"
                        >
                            <Video size={18} />
                            Start Recording Video
                        </button>
                     ) : (
                        <button 
                            onClick={stopRecording}
                            className="flex items-center gap-2 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-all border border-zinc-600"
                        >
                            <div className="w-4 h-4 bg-white rounded-sm"></div>
                            Stop Recording
                        </button>
                     )
                 ) : (
                    <a 
                        href={downloadUrl}
                        download="my-music-visualizer.webm"
                        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all animate-in slide-in-from-right-4"
                    >
                        <Download size={18} />
                        Download Video
                    </a>
                 )}
            </div>
        </div>
      </div>
      
      <div className="mt-6 text-center text-zinc-500 text-sm">
        <p>Instructions: Click <strong>Start Recording</strong> to play the song and capture the visuals. Click <strong>Stop</strong> when done to download.</p>
      </div>

    </div>
  );
};
