import React, { useState } from 'react';
import { GoogleGenAI, Modality, GenerateContentResponse } from '@google/genai';
import { PrebuiltVoice } from '../types';
import { decode, createWavBlob } from '../utils';
import { LoadingSpinner } from './LoadingSpinner';

const VOICE_OPTIONS: { id: PrebuiltVoice, name: string }[] = [
    { id: 'Kore', name: 'Kore (Female - Friendly)' },
    { id: 'Zephyr', name: 'Zephyr (Male - Calm)' },
    { id: 'Puck', name: 'Puck (Male - Upbeat)' },
    { id: 'Charon', name: 'Charon (Male - Deep)' },
    { id: 'Fenrir', name: 'Fenrir (Male - Assertive)' },
];

const VOICE_STYLES = [
    { id: 'Normal', name: 'Normal Conversation' },
    { id: 'Kid', name: 'Child / Kid Voice (Simulated)' },
    { id: 'SoftFemale', name: 'Soft / Gentle Female' },
    { id: 'News', name: 'News Anchor (Professional)' },
    { id: 'Movie', name: 'Movie Trailer (Deep/Dramatic)' },
    { id: 'Cartoon', name: 'Cartoon (Funny/Exaggerated)' },
    { id: 'Whisper', name: 'Whispering / Soft' },
    { id: 'Shouting', name: 'Shouting / Urgent' },
];

export function AudioGenerator() {
  const [prompt, setPrompt] = useState<string>('');
  const [voice, setVoice] = useState<PrebuiltVoice>('Kore');
  const [style, setStyle] = useState<string>('Normal');
  
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const resetForm = () => {
    setGeneratedAudioUrl(null);
    setPrompt('');
    setVoice('Kore');
    setStyle('Normal');
  }

  const handleGenerateAudio = async () => {
    if (!prompt.trim()) {
      setError('Please enter some text to generate audio.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedAudioUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Modify text based on style selection to influence the model's prosody
      let finalPrompt = prompt;
      
      switch (style) {
          case 'Kid':
              finalPrompt = `Speak in a young, high-pitched, cheerful child's voice: ${prompt}`;
              break;
          case 'SoftFemale':
              finalPrompt = `Speak in a very soft, gentle, and soothing female voice: ${prompt}`;
              break;
          case 'News':
              finalPrompt = `Speak like a professional news anchor reporting breaking news: ${prompt}`;
              break;
          case 'Movie':
              finalPrompt = `Speak in a deep, epic, dramatic movie trailer voice: ${prompt}`;
              break;
          case 'Cartoon':
              finalPrompt = `Speak in a funny, high-energy, exaggerated cartoon character voice: ${prompt}`;
              break;
          case 'Whisper':
              finalPrompt = `Whisper softly and quietly: ${prompt}`;
              break;
          case 'Shouting':
              finalPrompt = `Shout loudly and urgently: ${prompt}`;
              break;
          default:
              // Normal
              break;
      }

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: finalPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const pcmData = decode(audioData);
        const wavBlob = createWavBlob(pcmData, 24000, 1);
        const url = URL.createObjectURL(wavBlob);
        setGeneratedAudioUrl(url);
      } else {
        throw new Error('No audio was generated. The model may have refused the prompt.');
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
        <p className="mt-4 text-lg text-gray-300">Generating your audio...</p>
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

  if (generatedAudioUrl) {
    return (
      <div className="flex flex-col items-center space-y-6">
        <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Your Audio is Ready!</h2>
        <audio controls src={generatedAudioUrl} className="w-full max-w-md" />
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <a href={generatedAudioUrl} download="generated-audio.wav" className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">Download Audio</a>
          <button onClick={resetForm} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">Generate Another</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="prompt-audio" className="block text-lg font-medium text-gray-300 mb-2">
          Enter Text to Convert to Speech
        </label>
        <textarea
          id="prompt-audio"
          rows={5}
          className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-4 text-gray-100 focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500"
          placeholder="e.g., Once upon a time in a magical forest..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="voice" className="block text-sm font-medium text-gray-300 mb-2">Choose a Voice</label>
            <select
            id="voice"
            className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 transition"
            value={voice}
            onChange={(e) => setVoice(e.target.value as PrebuiltVoice)}
            >
            {VOICE_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
            </select>
          </div>

          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-300 mb-2">Speaking Style</label>
            <select
            id="style"
            className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 transition"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            >
            {VOICE_STYLES.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
            </select>
          </div>
      </div>
      
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-sm text-gray-400">
          <p><strong>Note:</strong> To simulate a "Child Voice", select the <strong>Child / Kid Voice</strong> style. For best results with female voices, ensure <strong>Kore</strong> is selected.</p>
      </div>

      <div className="pt-4">
        <button onClick={handleGenerateAudio} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 text-white font-bold py-4 px-4 rounded-lg text-lg transform hover:scale-105 transition-transform">
          Generate Audio
        </button>
      </div>
    </div>
  );
}