import React, { useCallback } from 'react';
import { Upload, Music } from 'lucide-react';

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onFileSelected }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      
      // Expanded validation: Check mime type OR file extension
      // This fixes issues where Windows/Browsers don't correctly tag the mime type of audio files
      const isAudioType = file?.type.startsWith('audio/');
      const hasAudioExtension = file?.name.match(/\.(mp3|wav|ogg|m4a|flac|aac|wma)$/i);

      if (file && (isAudioType || hasAudioExtension)) {
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="w-full max-w-2xl mx-auto border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 transition-all cursor-pointer group p-12 text-center"
    >
      <input
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        onChange={handleChange}
        className="hidden"
        id="audio-upload"
      />
      <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Upload size={32} />
        </div>
        <h3 className="text-2xl font-semibold text-white mb-2">Upload your track</h3>
        <p className="text-zinc-400 mb-6">Drag and drop or click to browse (MP3, WAV)</p>
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-full">
          <Music size={12} />
          <span>Max file size 100MB</span>
        </div>
      </label>
    </div>
  );
};