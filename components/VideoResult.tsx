import React, { useRef, useEffect, useState } from 'react';
import { Download, Play, Pause, RefreshCw, AlertCircle } from 'lucide-react';

interface VideoResultProps {
  videoUrl: string;
  audioUrl: string;
  onReset: () => void;
}

export const VideoResult: React.FC<VideoResultProps> = ({ videoUrl, audioUrl, onReset }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Sync controls
  const togglePlay = () => {
    if (videoRef.current && audioRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
      } else {
        // Reset to start if finished
        if (videoRef.current.ended) {
          videoRef.current.currentTime = 0;
          audioRef.current.currentTime = 0;
        }
        videoRef.current.play();
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;

    const handleEnded = () => {
        // Loop visually if audio is longer, or loop audio if video is longer? 
        // For Veo previews, videos are short. We loop the video while audio plays.
        if(v) {
            v.currentTime = 0;
            v.play();
        }
    };
    
    // When audio ends, stop everything
    const handleAudioEnded = () => {
        setIsPlaying(false);
        if(v) v.pause();
    };

    if (v && a) {
      v.addEventListener('ended', handleEnded);
      a.addEventListener('ended', handleAudioEnded);
      setIsSynced(true);
    }

    return () => {
      if (v) v.removeEventListener('ended', handleEnded);
      if (a) a.removeEventListener('ended', handleAudioEnded);
    };
  }, [videoUrl, audioUrl]);

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in zoom-in duration-500">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Preview Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center group">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            loop={true} // Explicit loop for video track
            muted={true} // Muted because we use the audio element
            playsInline
          />
          <audio ref={audioRef} src={audioUrl} className="hidden" />

          {/* Overlay Controls */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={togglePlay}
              className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all hover:scale-105"
            >
              {isPlaying ? (
                <Pause size={32} className="text-white fill-current" />
              ) : (
                <Play size={32} className="text-white fill-current ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Creation Complete</h3>
            <p className="text-zinc-400 text-sm">
              Your AI-generated visual is ready. The video loops automatically to your track.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={onReset}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium transition-colors"
            >
              <RefreshCw size={18} />
              New
            </button>
            <a
              href={videoUrl}
              download="vibestream-generated.mp4"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium transition-all shadow-lg shadow-purple-900/20"
            >
              <Download size={18} />
              Download Video
            </a>
          </div>
        </div>
        
        {/* Monetization Tip */}
        <div className="px-6 pb-6">
            <div className="bg-indigo-900/20 border border-indigo-900/50 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-indigo-200">
                    <strong>Monetization Tip:</strong> This video file is separate from your audio. Use a video editor (like CapCut or Premiere) to combine this video loop with your original high-quality audio file before uploading to YouTube.
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
