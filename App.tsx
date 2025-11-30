import React, { useState } from 'react';
import { AppStep, AudioFile, GenerationConfig } from './types';
import { AudioUploader } from './components/AudioUploader';
import { VideoResult } from './components/VideoResult';
import { analyzeAudioAndGeneratePrompt, generateVideo } from './services/geminiService';
import { Wand2, Loader2, Music, Youtube, Film, CheckCircle2, DollarSign } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [config, setConfig] = useState<GenerationConfig>({
    prompt: '',
    aspectRatio: '16:9',
    resolution: '1080p',
  });
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
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
      case 'flac': return 'audio/flac';
      case 'aac': return 'audio/aac';
      default: return 'audio/mpeg'; // Default to mp3 container as a safe fallback
    }
  };

  // Utilities
  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix for API
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = async (file: File) => {
    try {
      // Increased limit to 100MB
      if (file.size > 100 * 1024 * 1024) {
        setError("File size too large. Please upload an audio file smaller than 100MB.");
        return;
      }

      // Safe MIME type detection
      const mimeType = getMimeType(file);

      const url = URL.createObjectURL(file);
      setAudioFile({
        file,
        url,
        base64: '',
        mimeType: mimeType,
      });
      setError(null);
      setStep(AppStep.ANALYZING);

      const API_INLINE_LIMIT = 18 * 1024 * 1024;
      let blobForAnalysis: Blob = file;
      
      if (file.size > API_INLINE_LIMIT) {
        console.log("File too large for inline analysis, slicing first 18MB...");
        blobForAnalysis = file.slice(0, API_INLINE_LIMIT, mimeType);
      }

      const base64 = await fileToBase64(blobForAnalysis);
      setAudioFile(prev => prev ? { ...prev, base64 } : null);

      const suggestedPrompt = await analyzeAudioAndGeneratePrompt(base64, mimeType);
      setPrompt(suggestedPrompt);
      setConfig(prev => ({ ...prev, prompt: suggestedPrompt }));
      setStep(AppStep.PROMPT_EDIT);

    } catch (err: any) {
      console.error("Analysis Error:", err);
      let msg = "Failed to analyze audio. ";
      
      if (err.message && err.message.includes("API_KEY")) {
        msg = "API Key missing. Please configure your API_KEY in settings or environment.";
      } else if (err.status === 400) {
        msg += "The file format might not be supported or the file is corrupted.";
      } else {
        msg += "Please try again with a different file.";
      }
      
      setError(msg);
      setStep(AppStep.UPLOAD);
    }
  };

  const handleGenerate = async () => {
    try {
      setStep(AppStep.GENERATING_VIDEO);
      setError(null);
      
      const videoUrl = await generateVideo(config.prompt, config.aspectRatio, config.resolution);
      setGeneratedVideoUrl(videoUrl);
      setStep(AppStep.RESULT);
    } catch (err: any) {
      console.error(err);
      
      let msg = "Failed to generate video.";
      if (err.message?.includes("400") || err.message?.includes("BILLING") || err.status === 400) {
        msg = "Video generation requires a Paid API Key (Google Veo). Free tier keys only work for the audio analysis step.";
      } else if (err.message) {
        msg = err.message;
      }

      setError(msg);
      setStep(AppStep.PROMPT_EDIT);
    }
  };

  const handleReset = () => {
    setStep(AppStep.UPLOAD);
    setAudioFile(null);
    setPrompt('');
    setGeneratedVideoUrl(null);
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
              <Wand2 size={16} />
              <span>Veo Generation</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-purple-400">
              <Youtube size={16} />
              <span>Monetize Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <div className="w-full max-w-5xl mx-auto z-10">
          
          {error && (
            <div className="mb-8 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-center animate-in slide-in-from-top-4 flex items-center justify-center gap-2">
              {error.includes("Paid API") ? <DollarSign size={20} className="text-red-400" /> : <CheckCircle2 size={20} className="text-red-400 rotate-45" />}
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
                  Upload your music track. Our AI analyzes the rhythm and mood to generate 
                  stunning, royalty-free video backgrounds powered by Google Veo.
                </p>
              </div>
              <AudioUploader onFileSelected={handleFileSelect} />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 text-center">
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-400 font-bold">1</div>
                    <h3 className="font-semibold text-white">Upload Audio</h3>
                    <p className="text-sm text-zinc-500 mt-1">MP3, WAV, FLAC supported</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-400 font-bold">2</div>
                    <h3 className="font-semibold text-white">AI Visualizing</h3>
                    <p className="text-sm text-zinc-500 mt-1">Gemini generates the prompt</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-400 font-bold">3</div>
                    <h3 className="font-semibold text-white">Download Video</h3>
                    <p className="text-sm text-zinc-500 mt-1">High-quality MP4 output</p>
                </div>
              </div>
            </div>
          )}

          {step === AppStep.ANALYZING && (
            <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-zinc-800 border-t-purple-500 animate-spin"></div>
                <Music className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-500" size={32} />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Listening to your track...</h2>
                <p className="text-zinc-400">Gemini is analyzing the mood, tempo, and atmosphere.</p>
              </div>
            </div>
          )}

          {step === AppStep.PROMPT_EDIT && (
            <div className="w-full max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-8 fade-in">
               <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Design Your Visuals</h2>
                <p className="text-zinc-400">Gemini suggested this prompt based on your audio. Tweak it to perfection.</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Video Prompt
                </label>
                <textarea
                  value={config.prompt}
                  onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-100 placeholder-zinc-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-all"
                  placeholder="Describe the video you want generated..."
                />
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Aspect Ratio</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConfig({ ...config, aspectRatio: '16:9' })}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          config.aspectRatio === '16:9'
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        16:9 (Landscape)
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, aspectRatio: '9:16' })}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          config.aspectRatio === '9:16'
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        9:16 (Portrait)
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Quality</label>
                     <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConfig({ ...config, resolution: '1080p' })}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          config.resolution === '1080p'
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        1080p HD
                      </button>
                       <button
                        onClick={() => setConfig({ ...config, resolution: '720p' })}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          config.resolution === '720p'
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        720p
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    onClick={() => setStep(AppStep.UPLOAD)}
                    className="px-6 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-8 py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
                  >
                    <Wand2 size={16} />
                    Generate Video
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === AppStep.GENERATING_VIDEO && (
            <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in max-w-xl mx-auto text-center">
              <div className="relative w-24 h-24">
                 <div className="absolute inset-0 rounded-full border-t-4 border-purple-500 animate-spin"></div>
                 <div className="absolute inset-2 rounded-full border-r-4 border-indigo-500 animate-spin animation-delay-200"></div>
                 <div className="absolute inset-4 rounded-full border-b-4 border-pink-500 animate-spin animation-delay-500"></div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">Creating Magic...</h2>
                <div className="space-y-2">
                    <p className="text-zinc-400">Google Veo is generating your video content. This usually takes 30-60 seconds.</p>
                    <div className="flex flex-col gap-2 items-center justify-center text-sm text-zinc-500 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-2 text-indigo-400">
                            <CheckCircle2 size={14} /> <span>Analyzing prompt structure</span>
                        </div>
                         <div className="flex items-center gap-2 text-indigo-400">
                            <CheckCircle2 size={14} /> <span>Rendering frames</span>
                        </div>
                         <div className="flex items-center gap-2 animate-pulse text-zinc-400">
                            <Loader2 size={14} className="animate-spin" /> <span>Finalizing output</span>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          )}

          {step === AppStep.RESULT && generatedVideoUrl && audioFile && (
            <VideoResult 
              videoUrl={generatedVideoUrl} 
              audioUrl={audioFile.url}
              onReset={handleReset}
            />
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-center text-zinc-600 text-sm">
        <p>© 2024 VibeStream AI. Powered by Google Gemini & Veo.</p>
      </footer>
    </div>
  );
}