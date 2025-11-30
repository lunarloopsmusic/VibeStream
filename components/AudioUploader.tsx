
import React, { useCallback, useState } from 'react';
import { Upload, Music, FileAudio, ArrowRight } from 'lucide-react';

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      validateAndUpload(file);
    },
    [onFileSelected]
  );

  const validateAndUpload = (file: File) => {
    const isAudioType = file?.type.startsWith('audio/');
    const hasAudioExtension = file?.name.match(/\.(mp3|wav|ogg|m4a|flac|aac|wma)$/i);

    if (file && (isAudioType || hasAudioExtension)) {
      onFileSelected(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`
            relative group cursor-pointer transition-all duration-500 ease-out
            border border-dashed rounded-3xl p-12 text-center overflow-hidden
            ${isDragging 
                ? 'border-indigo-500 bg-indigo-500/10 scale-105 shadow-[0_0_40px_rgba(99,102,241,0.2)]' 
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'}
        `}
      >
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
          onChange={handleChange}
          className="hidden"
          id="audio-upload"
        />
        
        <div className="relative z-10 flex flex-col items-center">
            {/* Animated Icon */}
            <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center mb-8 transition-all duration-500
                ${isDragging ? 'bg-indigo-500 rotate-12 scale-110' : 'bg-gradient-to-br from-indigo-500 to-purple-600 group-hover:scale-110 shadow-lg shadow-purple-900/30'}
            `}>
                <Music size={32} className="text-white" />
            </div>

            <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Upload Track</h3>
            <p className="text-zinc-400 mb-8 max-w-xs mx-auto leading-relaxed">
              Drag & drop your audio file here, or click to browse your library.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 text-xs text-zinc-500 font-medium">
                    <FileAudio size={12} /> MP3, WAV, FLAC
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 text-xs text-zinc-500 font-medium">
                    <Upload size={12} /> Max 100MB
                 </div>
            </div>
            
            <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                 <span className="text-indigo-400 font-semibold flex items-center gap-2 text-sm">
                    Select File <ArrowRight size={14} />
                 </span>
            </div>
        </div>

        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      </div>
    </div>
  );
};
