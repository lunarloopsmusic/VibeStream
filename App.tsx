import React, { useState } from 'react';
import { AppStep, AudioFile, VisualizerConfig } from './types';
import { AudioUploader } from './components/AudioUploader';
import { AudioVisualizer } from './components/AudioVisualizer';
import { analyzeAudioForVisualizer } from './services/geminiService';
import { Wand2, Loader2, Music, Youtube, Film, CheckCircle2, DollarSign, Palette } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to guess MIME type if the browser fails to detect it
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
      setAudioFile({ file, url, base64: '', mimeType });
      setError(null);
      setStep(AppStep.ANALYZING);

      // Slice for analysis to keep payload small for Gemini
      const API_INLINE_LIMIT = 15 * 1024 * 1024;
      let blobForAnalysis: Blob = file;
      if (file.size > API_INLINE_LIMIT) {
        blobForAnalysis = file.slice(0, API_INLINE_LIMIT, mimeType);
      }

      const base64 = await fileToBase64(blobForAnalysis);
      
      // Get config from Gemini
      const config = await analyzeAudioForVisualizer(base64, mimeType);
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

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Film size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">VibeStream</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
            <div className="hidden md:flex items-center gap-2">
              <Music size={16} />
              <span>Audio Analysis</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Palette size={16} />
              <span>Canvas Visualizer</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-purple-400">
              <Youtube size={16} />
              <span>Free & Unlimited</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-purple-900/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <div className="w-full max-w-5xl mx-auto z-10">
          
          {error && (
            <div className="mb-8 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={20} className="text-red-400 rotate-45" />
              <span>{error}</span>
            </div>
          )}

          {step === AppStep.UPLOAD && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
                  Visualize your sound.
                </h1>
                <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
                  Upload your music track. Our AI determines the perfect visual style, 
                  and our Real-time Engine renders a free 1080p video you can record and download.
                </p>
              </div>
              <AudioUploader onFileSelected={handleFileSelect} />
            </div>
          )}

          {step === AppStep.ANALYZING && (
            <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-zinc-800 border-t-purple-500 animate-spin"></div>
                <Music className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-500" size={32} />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Configuring Visual Engine...</h2>
                <p className="text-zinc-400">Gemini is matching colors and motion styles to your music.</p>
              </div>
            </div>
          )}

          {step === AppStep.VISUALIZER && audioFile && visualizerConfig && (
            <AudioVisualizer 
              audioUrl={audioFile.url}
              config={visualizerConfig}
              onBack={handleReset}
            />
          )}

        </div>
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-center text-zinc-600 text-sm">
        <p>© 2024 VibeStream. Browser-based Realtime Rendering.</p>
      </footer>
    </div>
  );
}
