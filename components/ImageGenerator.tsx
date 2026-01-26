import React, { useState, useEffect } from 'react';
// FIX: Import the `Part` type from @google/genai to correctly type the content parts array.
import { GoogleGenAI, GenerateContentResponse, Part } from '@google/genai';
import { fileToBase64 } from '../utils';
import { LoadingSpinner } from './LoadingSpinner';

type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '3:4' | '4:3';
type ImageResolution = '1K' | '2K' | '4K';
type ImageStyle = 'None' | 'Photorealistic' | 'Anime' | 'Digital Art' | 'Oil Painting' | 'Sketch' | 'Cyberpunk' | 'Watercolor' | '2D Render' | '3D Render';

interface SavedImage {
  id: string;
  url: string;
  prompt: string;
  style: ImageStyle;
  resolution: ImageResolution;
  aspectRatio: ImageAspectRatio;
  timestamp: number;
}

export function ImageGenerator() {
  const [prompt, setPrompt] = useState<string>('');
  
  // Changed to arrays to support multiple images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  // New State variables for configuration
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [resolution, setResolution] = useState<ImageResolution>('1K');
  const [style, setStyle] = useState<ImageStyle>('None');

  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<SavedImage[]>([]);

  // Load history from local storage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('video_zen_image_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveToHistory = (url: string, currentPrompt: string, currentStyle: ImageStyle, currentRes: ImageResolution, currentRatio: ImageAspectRatio) => {
    const newEntry: SavedImage = {
      id: Date.now().toString(),
      url,
      prompt: currentPrompt,
      style: currentStyle,
      resolution: currentRes,
      aspectRatio: currentRatio,
      timestamp: Date.now()
    };

    const updatedHistory = [newEntry, ...history];
    
    // Limit history to avoid quota issues (e.g., keep last 20)
    if (updatedHistory.length > 20) {
      updatedHistory.pop();
    }

    setHistory(updatedHistory);
    try {
      localStorage.setItem('video_zen_image_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.warn("LocalStorage quota exceeded, could not save image to history.");
    }
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to delete all saved images?")) {
      setHistory([]);
      localStorage.removeItem('video_zen_image_history');
    }
  };

  const handleRestoreFromHistory = (item: SavedImage) => {
    setPrompt(item.prompt);
    setStyle(item.style);
    setResolution(item.resolution);
    setAspectRatio(item.aspectRatio);
    setGeneratedImageUrl(item.url);
    setImageFiles([]); // Reset file upload when restoring from history
    setImagePreviews([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Cast to File[] because Array.from might infer unknown[] depending on TS config
      const newFiles = Array.from(files) as File[];
      const allFiles = [...imageFiles, ...newFiles];
      
      // Limit to 4 images max for UX/performance
      if (allFiles.length > 4) {
          alert("You can upload a maximum of 4 reference images.");
          return;
      }

      setImageFiles(allFiles);

      // Generate previews
      const newPreviews: string[] = [];
      let processedCount = 0;

      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          processedCount++;
          if (processedCount === newFiles.length) {
            setImagePreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles.splice(index, 1);
    setImageFiles(newFiles);

    const newPreviews = [...imagePreviews];
    newPreviews.splice(index, 1);
    setImagePreviews(newPreviews);
  };
  
  const resetForm = () => {
    setGeneratedImageUrl(null);
    setPrompt('');
    setImageFiles([]);
    setImagePreviews([]);
    setAspectRatio('1:1');
    setResolution('1K');
    setStyle('None');
  }

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate an image.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Append style to prompt if selected
      let finalPrompt = prompt;
      if (style !== 'None') {
        finalPrompt = `${prompt}, in ${style} style`;
      }

      // Explicitly type `parts` as `Part[]`
      const parts: Part[] = [{ text: finalPrompt }];

      // Loop through all uploaded images and add them to parts
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
             const base64Data = await fileToBase64(file);
             parts.unshift({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type,
                },
             });
        }
      }

      const modelName = resolution === '1K' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';

      const imageConfig: any = {
        aspectRatio: aspectRatio,
      };

      if (modelName === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = resolution;
      }

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
            imageConfig: imageConfig
        }
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePart && imagePart.inlineData) {
        const base64String = imagePart.inlineData.data;
        const newUrl = `data:${imagePart.inlineData.mimeType};base64,${base64String}`;
        setGeneratedImageUrl(newUrl);
        saveToHistory(newUrl, prompt, style, resolution, aspectRatio);
      } else {
        throw new Error('No image was generated. The model may have refused the prompt.');
      }
    } catch (e: unknown) {
      setError(`An error occurred: ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-gray-300">Generating your image...</p>
        {resolution !== '1K' && <p className="text-sm text-gray-500 mt-2">High resolution generation may take longer.</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
        <button onClick={() => setError(null)} className="ml-4 text-sm underline">Dismiss</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Result Section */}
      {generatedImageUrl && (
        <div className="flex flex-col items-center space-y-6 bg-gray-800/50 p-6 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Your Image is Ready!</h2>
          <img src={generatedImageUrl} alt="Generated art" className="max-w-full max-h-[60vh] rounded-lg shadow-2xl border-4 border-gray-900" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
            <a 
              href={generatedImageUrl} 
              download={`generated-image-${Date.now()}.png`} 
              className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Download
            </a>
            <button 
              onClick={handleGenerateImage} 
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Regenerate
            </button>
            <button 
              onClick={resetForm} 
              className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Generate New
            </button>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className={`${generatedImageUrl ? 'opacity-75 hover:opacity-100 transition-opacity' : ''}`}>
        <div>
            <label htmlFor="prompt-image" className="block text-lg font-medium text-gray-300 mb-2">
            Enter Your Image Prompt
            </label>
            <textarea
            id="prompt-image"
            rows={3}
            className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-4 text-gray-100 focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500"
            placeholder="e.g., A cute cat astronaut floating in space"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Resolution Selection */}
            <div>
            <label htmlFor="resolution-select" className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
            <select 
                id="resolution-select"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ImageResolution)}
                className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 transition"
            >
                <option value="1K">1K (Standard)</option>
                <option value="2K">2K (High Quality)</option>
                <option value="4K">4K (Ultra Quality)</option>
            </select>
            </div>

            {/* Aspect Ratio Selection */}
            <div>
            <label htmlFor="ratio-select" className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
            <select 
                id="ratio-select"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as ImageAspectRatio)}
                className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 transition"
            >
                <option value="1:1">1:1 (Square)</option>
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="4:3">4:3 (Standard)</option>
                <option value="3:4">3:4 (Vertical)</option>
            </select>
            </div>

            {/* Style Selection */}
            <div>
            <label htmlFor="style-select" className="block text-sm font-medium text-gray-300 mb-2">Style & Format</label>
            <select 
                id="style-select"
                value={style}
                onChange={(e) => setStyle(e.target.value as ImageStyle)}
                className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 transition"
            >
                <option value="None">No Specific Style</option>
                <option value="2D Render">2D Render</option>
                <option value="3D Render">3D Render</option>
                <option value="Photorealistic">Photorealistic</option>
                <option value="Anime">Anime</option>
                <option value="Digital Art">Digital Art</option>
                <option value="Oil Painting">Oil Painting</option>
                <option value="Sketch">Sketch</option>
                <option value="Cyberpunk">Cyberpunk</option>
                <option value="Watercolor">Watercolor</option>
            </select>
            </div>
        </div>

        <div className="mt-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Reference Images (Multiple Supported)</label>
            <div className="mt-1 flex flex-col items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                
                {imagePreviews.length > 0 && (
                   <div className="flex flex-wrap gap-4 mb-4 justify-center">
                       {imagePreviews.map((preview, index) => (
                           <div key={index} className="relative">
                               <img src={preview} alt={`Preview ${index}`} className="h-24 w-auto rounded-md border border-gray-500" />
                               <button 
                                 onClick={() => removeImage(index)}
                                 className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700"
                               >
                                   ×
                               </button>
                           </div>
                       ))}
                   </div>
                )}
                
                <div className="space-y-1 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <div className="flex text-sm text-gray-500">
                    <label htmlFor="file-upload-image" className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-purple-400 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-purple-500 px-1">
                        <span>Upload files</span>
                        <input 
                            id="file-upload-image" 
                            name="file-upload-image" 
                            type="file" 
                            className="sr-only" 
                            accept="image/*" 
                            multiple 
                            onChange={handleImageChange} 
                        />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="pt-4">
            <button onClick={handleGenerateImage} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 text-white font-bold py-4 px-4 rounded-lg text-lg transform hover:scale-105 transition-transform">
            {generatedImageUrl ? "Generate Again" : "Generate Image"}
            </button>
        </div>
      </div>

      {/* History Section */}
      {history.length > 0 && (
        <div className="mt-12 border-t border-gray-700 pt-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-200">History / Saved Data</h3>
                <button 
                    onClick={clearHistory}
                    className="text-red-400 text-sm hover:text-red-300 border border-red-900 bg-red-900/20 px-3 py-1 rounded"
                >
                    Clear Saved Data
                </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {history.map((item) => (
                    <div 
                        key={item.id} 
                        className="relative group cursor-pointer bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-all"
                        onClick={() => handleRestoreFromHistory(item)}
                    >
                        <img src={item.url} alt={item.prompt} className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition-opacity">
                            <p className="text-xs text-white truncate">{item.prompt}</p>
                            <p className="text-[10px] text-gray-300">{item.style} • {item.resolution}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}