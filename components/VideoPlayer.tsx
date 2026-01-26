
import React from 'react';

interface VideoPlayerProps {
  src: string;
  onGenerateNew: () => void;
}

export function VideoPlayer({ src, onGenerateNew }: VideoPlayerProps) {
  return (
    <div className="flex flex-col items-center space-y-6">
      <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Your Video is Ready!</h2>
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
        <video src={src} controls autoPlay loop className="w-full h-full object-contain" />
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full">
        <a
          href={src}
          download="generated-video.mp4"
          className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Download Video
        </a>
        <button
          onClick={onGenerateNew}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Generate Another Video
        </button>
      </div>
    </div>
  );
}
