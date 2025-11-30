import React, { useState } from 'react';
import { AppStep, AudioFile, VisualizerConfig } from './types';
import { AudioUploader } from './components/AudioUploader';
import { AudioVisualizer } from './components/AudioVisualizer';
import { analyzeAudioForVisualizer } from './services/geminiService';
import { Sparkles, Zap, Aperture, CheckCircle2 } from 'lucide-react';

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
    <div className="h-screen w-screen bg-[#050505] text-zinc-100 flex flex-col font-sans overflow-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-white to-zinc-400 rounded-xl flex items-center justify-center shadow-lg shadow-white/5">
                  <Aperture className="text-black" size={24} />
              </div>
              <span className="font-bold text-2xl tracking-tight text-white">VibeStream</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
              <button className="hover:text-white transition-colors">Features</button>
              <button className="hover:text-white transition-colors">Showcase</button>
          </nav>
      </header>

      <main className="flex-1 relative z-10 flex flex-col h-full">
        {error && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 p-4 bg-red-900/20 border border-red-500/20 rounded-xl text-red-200 flex items-center gap-3 shadow-xl animate-in slide-in-from-top-4 z-50 backdrop-blur-md">
              <CheckCircle2 size={20} className="text-red-400 rotate-45" />
              <span>{error}</span>
            </div>
        )}

        {/* Landing State */}
        {step === AppStep.UPLOAD && (
            <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="text-center max-w-4xl mx-auto space-y-6 mb-16 animate-in fade-in zoom-in duration-500">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold tracking-wide uppercase mb-4">
                        <Sparkles size={12} /> AI-Powered Audio Visualization
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
                        Transform Sound <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-pulse">Into Cinema.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        Upload your music. Our Gemini AI analyzes the mood. <br className="hidden md:block"/>
                        You get a professional, broadcast-ready music video in seconds.
                    </p>
                </div>
                
                <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                    <AudioUploader onFileSelected={handleFileSelect} />
                </div>
            </div>
        )}

        {/* Analyzing State */}
        {step === AppStep.ANALYZING && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                <div className="relative w-32 h-32">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30"></div>
                    <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="text-indigo-400 animate-pulse" size={40} />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-white">Synthesizing Visuals</h2>
                    <p className="text-zinc-400">AI is analyzing {audioFile?.name || 'audio'} frequency & mood...</p>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}