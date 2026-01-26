
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AspectRatio, Resolution } from '../types';
import { fileToBase64 } from '../utils';
import { VideoPlayer } from './VideoPlayer';
import { LoadingSpinner } from './LoadingSpinner';

interface VideoGeneratorProps {
  onApiKeyError: () => void;
}

const LOADING_MESSAGES = [
  "Warming up the AI director...", "Casting digital actors...", "Building the virtual set...",
  "Script is being finalized...", "Adjusting the lighting...", "Rolling the AI cameras...",
  "Rendering the first scenes...", "Adding special effects...", "Composing the soundtrack...", "Finalizing the edit...",
];

export function VideoGenerator({ onApiKeyError }: VideoGeneratorProps) {
  const [prompt, setPrompt] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let interval: number;
    if (isLoading) {
      setLoadingMessage(LOADING_MESSAGES[0]);
      let i = 1;
      interval = window.setInterval(() => {
        setLoadingMessage(LOADING_MESSAGES[i % LOADING_MESSAGES.length]);
        i++;
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setVideoUrl(null);
    setPrompt('');
    setImageFile(null);
    setImagePreview(null);
  };
  
  const handleGenerateVideo = async () => {
    if (!prompt.trim() && !imageFile) {
      setError('Please enter a prompt or upload an image to generate a video.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imagePayload = imageFile ? { imageBytes: await fileToBase64(imageFile), mimeType: imageFile.type } : undefined;
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: imagePayload,
        config: { numberOfVideos: 1, resolution, aspectRatio },
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        const videoBlob = await videoResponse.blob();
        setVideoUrl(URL.createObjectURL(videoBlob));
      } else {
        throw new Error('Video generation completed, but no video URI was returned.');
      }
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message.includes("Requested entity was not found.")) {
        setError("Your API key is invalid. Please refresh and select a valid key from a paid GCP project.");
        onApiKeyError();
      } else {
        setError(`An error occurred: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-gray-300 animate-pulse">{loadingMessage}</p>
        <p className="mt-2 text-sm text-gray-500">Video generation can take several minutes. Please be patient.</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (videoUrl) {
    return <VideoPlayer src={videoUrl} onGenerateNew={resetForm} />;
  }
  
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="prompt-video" className="block text-lg font-medium text-gray-300 mb-2">
          Enter Prompt
        </label>
        <textarea
          id="prompt-video"
          rows={4}
          className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-4 text-gray-100 focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500"
          placeholder="Describe the scene, or the animation for your uploaded image."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Upload Starting Image (Optional)</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="mx-auto h-24 w-auto rounded-md" />
            ) : (
             <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
            <div className="flex text-sm text-gray-500">
              <label htmlFor="file-upload-video" className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-purple-400 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-purple-500 px-1">
                <span>Upload a file</span>
                <input id="file-upload-video" name="file-upload-video" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
          <select id="aspectRatio" className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 transition" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
          </select>
        </div>
        <div>
          <label htmlFor="resolution" className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
          <select id="resolution" className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 transition" value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>
      </div>

      <div className="pt-4">
        <button onClick={handleGenerateVideo} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 text-white font-bold py-4 px-4 rounded-lg text-lg transform hover:scale-105 transition-transform duration-200">
          Generate Video
        </button>
      </div>
    </div>
  );
}
