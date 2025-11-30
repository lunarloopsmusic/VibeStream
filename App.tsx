import React, { useState } from 'react';
import { AppStep, AudioFile, VisualizerConfig } from './types';
import { AudioUploader } from './components/AudioUploader';
import { AudioVisualizer } from './components/AudioVisualizer';
import { analyzeAudioForVisualizer } from './services/geminiService';
import { Sparkles, Zap, Aperture, CheckCircle2, Music2, Layers, Cpu } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getMimeType = (file: File): string => {
    if (file.type && file.type !== '') return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
      case 'm4a': return 'audio/mp4';
      default: return 'audio/mpeg';
    }
  };

  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = async (file: File) => {
    try {
      if (file.size > 100 * 1024 * 1024) {
        setError("File size too large. Please upload an audio file smaller than 100MB.");
        return;
      }

      const mimeType = getMimeType(file);
      const url = URL.createObjectURL(file);
      setAudioFile({ file, url, base64: '', mimeType, name: file.name });
      setError(null);
      setStep(AppStep.ANALYZING);

      // Slice for analysis to keep payload small for Gemini
      const API_INLINE_LIMIT = 10 * 1024 * 1024;
      let blobForAnalysis: Blob = file;
      if (file.size > API_INLINE_LIMIT) {
        blobForAnalysis = file.slice(0, API_INLINE_LIMIT, mimeType);
      }

      const base64 = await fileToBase64(blobForAnalysis);
      
      const config = await analyzeAudioForVisualizer(base64, mimeType, file.name);
      setVisualizerConfig(config);
      setStep(AppStep.VISUALIZER);

    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError("Failed to analyze audio. Please try again.");
      setStep(AppStep.UPLOAD);
    }
  };

  const handleReset = () => {
    setStep(AppStep.UPLOAD);
    setAudioFile(null);
    setVisualizerConfig(null);
    setError(null);
  };

  // If in Visualizer mode, return just the visualizer to avoid layout nesting issues
  if (step === AppStep.VISUALIZER && audioFile && visualizerConfig) {
      return (
        <AudioVisualizer 
            audioUrl={audioFile.url}
            config={visualizerConfig}
            onBack={handleReset}
        />
      );
  }

  return (
    // Changed overflow-hidden to allow scrolling on landing page if needed, but fixed height to avoid layout shift
    <div className="h-screen w-screen bg-[#020202] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
          {/* Subtle Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 max-w-[1400px] mx-auto w-full pointer-events-none">
          {/* Pointer events auto on children to make buttons clickable if added later */}
          <div className="flex items-center gap-3 pointer-events-auto">
              <div className="w-8 h-8 bg-white/10 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center">
                  <Aperture className="text-white" size={18} />
              </div>
              <span className="font-bold text-xl tracking-tight text-white/90">Vizzy Studio</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-500 pointer-events-auto">
             <span className="flex items-center gap-1.5"><Cpu size={14}/> Gemini 2.5 Engine</span>
             <span className="w-1 h-1 rounded-full bg-zinc-800" />
             <span className="flex items-center gap-1.5"><Layers size={14}/> Real-time Rendering</span>
          </div>
      </header>

      {/* Main Content Area - Added overflow-y-auto to allow scrolling on small screens/tall content */}
      <main className="flex-1 relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar">
        {error && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 p-4 bg-red-900/20 border border-red-500/20 rounded-xl text-red-200 flex items-center gap-3 shadow-xl animate-in slide-in-from-top-4 z-50 backdrop-blur-md">
              <CheckCircle2 size={20} className="text-red-400 rotate-45" />
              <span>{error}</span>
            </div>
        )}

        {/* Landing State */}
        {step === AppStep.UPLOAD && (
            <div className="min-h-full flex flex-col items-center justify-center px-6 py-24 relative">
                <div className="max-w-5xl mx-auto w-full text-center mb-12">
                    
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md text-indigo-300 text-xs font-semibold tracking-wide uppercase mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Next Gen Visualizer
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-white mb-6 animate-in fade-in zoom-in duration-700 delay-150 leading-[0.9] md:leading-[0.9]">
                        Visualize <br />
                        <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-indigo-300">Your Music</span>
                    </h1>
                    
                    {/* Subheadline */}
                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 mt-8">
                        Turn audio into cinema. Drag and drop your track to generate 
                        <span className="text-zinc-200 font-medium"> professional, audio-reactive visuals </span> 
                        instantly.
                    </p>
                </div>
                
                {/* Uploader */}
                <div className="w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 relative z-20">
                    <AudioUploader onFileSelected={handleFileSelect} />
                </div>

                {/* Footer Tech Specs */}
                <div className="mt-20 flex justify-center gap-8 md:gap-16 text-[10px] md:text-xs font-mono text-zinc-600 uppercase tracking-widest animate-in fade-in duration-1000 delay-700 pointer-events-none">
                    <span>4K Resolution Support</span>
                    <span>60 FPS Export</span>
                    <span>Hardware Accelerated</span>
                </div>
            </div>
        )}

        {/* Analyzing State */}
        {step === AppStep.ANALYZING && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500 bg-black/50 backdrop-blur-sm">
                <div className="relative w-24 h-24">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Music2 className="text-indigo-400" size={32} />
                    </div>
                </div>
                <div className="text-center space-y-3">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Processing Audio</h2>
                    <p className="text-zinc-500 text-sm font-mono">Analyzing frequencies & extracting mood...</p>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}