import React, { useCallback, useState, useRef } from 'react';
import { Upload, Music, FileAudio, ArrowRight } from 'lucide-react';

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    // Simple check - most browsers populate type, but extension fallback is safer
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

  const handleBoxClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={handleBoxClick}
        className={`
            relative group cursor-pointer transition-all duration-500 ease-out
            border border-dashed rounded-2xl p-10 text-center overflow-hidden backdrop-blur-sm
            ${isDragging 
                ? 'border-indigo-500/50 bg-indigo-500/10 scale-[1.02] shadow-2xl shadow-indigo-500/20' 
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
          onChange={handleChange}
          className="hidden"
          id="audio-upload"
        />
        
        <div className="relative z-10 flex flex-col items-center">
            {/* Icon */}
            <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 shadow-xl
                ${isDragging ? 'bg-indigo-500 scale-110 rotate-6' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 group-hover:scale-110 group-hover:border-indigo-500/50'}
            `}>
                <Music size={24} className={`${isDragging ? 'text-white' : 'text-zinc-400 group-hover:text-indigo-400'} transition-colors duration-300`} />
            </div>

            <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">Upload Track</h3>
            <p className="text-zinc-500 text-sm mb-6 max-w-[200px] mx-auto leading-relaxed">
              Drag & drop audio or click to browse files
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-2">
                 <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    <FileAudio size={10} /> MP3 / WAV
                 </div>
                 <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    <Upload size={10} /> 100MB Limit
                 </div>
            </div>
            
            <div className="h-6 mt-4 flex items-center justify-center">
                 <span className="text-indigo-400 font-medium text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    Select from computer <ArrowRight size={12} />
                 </span>
            </div>
        </div>

        {/* Hover Gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      </div>
    </div>
  );
};