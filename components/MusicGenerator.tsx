import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { LoadingSpinner } from './LoadingSpinner';

interface SongData {
  title: string;
  genre: string;
  mood: string;
  lyrics: string;
  chords: string;
  albumArtUrl?: string;
}

interface SavedSong extends SongData {
  id: string;
  timestamp: number;
}

export function MusicGenerator() {
  const [topic, setTopic] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [mood, setMood] = useState('Happy');
  
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // 'Writing Lyrics...' or 'Designing Album Art...'
  const [error, setError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<SavedSong[]>([]);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem('video_zen_music_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse music history", e);
      }
    }
  }, []);

  const saveToHistory = (song: SongData) => {
    const newEntry: SavedSong = {
      ...song,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    const updated = [newEntry, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('video_zen_music_history', JSON.stringify(updated));
  };

  const clearHistory = () => {
    if (confirm("Clear all saved songs?")) {
      setHistory([]);
      localStorage.removeItem('video_zen_music_history');
    }
  };

  const handleGenerateSong = async () => {
    if (!topic.trim()) {
      setError("Please describe what your song is about.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentSong(null);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      // Step 1: Generate Lyrics and Chords (Text Model)
      setLoadingStep("Writing lyrics and composing chords...");
      
      const textResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write a song about "${topic}". Genre: ${genre}. Mood: ${mood}. Include a creative Title, full Lyrics (Verse 1, Chorus, Verse 2, Chorus, Outro), and suggested Guitar/Piano Chords.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              lyrics: { type: Type.STRING, description: "The full song lyrics with structure headers (e.g. [Chorus])" },
              chords: { type: Type.STRING, description: "The chord progression and key signature" },
            },
            required: ["title", "lyrics", "chords"]
          }
        }
      });

      const songJson = JSON.parse(textResponse.text || "{}");
      
      // Step 2: Generate Album Art (Image Model)
      setLoadingStep("Designing album artwork...");
      
      const imagePrompt = `Album cover art for a ${mood} ${genre} song titled "${songJson.title}". Artistic, high quality, ${mood} atmosphere.`;
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: imagePrompt,
        config: {
           imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      let albumArtUrl = "";
      const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePart && imagePart.inlineData) {
        albumArtUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      }

      const newSong: SongData = {
        title: songJson.title,
        genre: genre,
        mood: mood,
        lyrics: songJson.lyrics,
        chords: songJson.chords,
        albumArtUrl: albumArtUrl
      };

      setCurrentSong(newSong);
      saveToHistory(newSong);

    } catch (e: unknown) {
      setError(`Generation failed: ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const restoreSong = (song: SavedSong) => {
    setCurrentSong(song);
    setTopic(''); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-purple-400 font-medium animate-pulse">{loadingStep}</p>
        <p className="text-sm text-gray-500 mt-2">Composing your masterpiece...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Song Display Section */}
      {currentSong ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
          <div className="md:flex">
             {/* Album Art Side */}
            <div className="md:w-1/3 p-6 bg-black/20 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-700">
              {currentSong.albumArtUrl && (
                <img 
                  src={currentSong.albumArtUrl} 
                  alt="Album Art" 
                  className="w-full max-w-[300px] h-auto rounded-lg shadow-lg border-2 border-gray-600 mb-4" 
                />
              )}
              <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-1">
                {currentSong.title}
              </h2>
              <p className="text-gray-400 text-sm mb-4">{currentSong.genre} • {currentSong.mood}</p>
              
              <div className="w-full space-y-2">
                 {currentSong.albumArtUrl && (
                    <a 
                      href={currentSong.albumArtUrl} 
                      download={`${currentSong.title}-cover.png`}
                      className="block w-full text-center bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm transition"
                    >
                      Download Cover Art
                    </a>
                 )}
                 <button 
                   onClick={() => setCurrentSong(null)}
                   className="block w-full text-center bg-purple-600 hover:bg-purple-700 py-2 rounded text-sm transition font-bold"
                 >
                   Create New Song
                 </button>
              </div>
            </div>

            {/* Lyrics & Chords Side */}
            <div className="md:w-2/3 p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-2">Chords / Structure</h3>
                <pre className="whitespace-pre-wrap text-yellow-500 font-mono text-sm">
                  {currentSong.chords}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Lyrics</h3>
                <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-gray-200">
                  {currentSong.lyrics}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Input Form */
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
             {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}
            <h2 className="text-2xl font-bold mb-6 text-white">AI Music Composer</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-gray-300 mb-2 font-medium">What is your song about?</label>
                    <textarea 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. A cyberpunk love story in Tokyo during the rain..."
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-300 mb-2 font-medium">Genre / Style</label>
                        <select 
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white"
                        >
                            <option value="Pop">Pop</option>
                            <option value="Rock">Rock</option>
                            <option value="Hip Hop">Hip Hop / Rap</option>
                            <option value="R&B">R&B</option>
                            <option value="Country">Country</option>
                            <option value="Electronic / EDM">Electronic / EDM</option>
                            <option value="Lofi Chill">Lofi Chill</option>
                            <option value="Metal">Metal</option>
                            <option value="Jazz">Jazz</option>
                            <option value="Classical">Classical</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-300 mb-2 font-medium">Mood</label>
                        <select 
                            value={mood}
                            onChange={(e) => setMood(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white"
                        >
                            <option value="Happy">Happy / Energetic</option>
                            <option value="Sad">Sad / Melancholic</option>
                            <option value="Romantic">Romantic</option>
                            <option value="Angry">Angry / Aggressive</option>
                            <option value="Relaxed">Relaxed / Chill</option>
                            <option value="Inspirational">Inspirational</option>
                            <option value="Dark">Dark / Mysterious</option>
                        </select>
                    </div>
                </div>

                <button 
                    onClick={handleGenerateSong}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold py-4 rounded-lg text-lg shadow-lg transform hover:scale-[1.02] transition-all"
                >
                    Compose Song & Artwork
                </button>
            </div>
        </div>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div className="border-t border-gray-700 pt-8">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-200">Song Library</h3>
                <button 
                    onClick={clearHistory}
                    className="text-red-400 text-xs hover:text-red-300 border border-red-900 bg-red-900/20 px-3 py-1 rounded"
                >
                    Clear Library
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((song) => (
                    <div 
                        key={song.id}
                        onClick={() => restoreSong(song)}
                        className="bg-gray-800 p-3 rounded-lg flex items-center space-x-4 cursor-pointer hover:bg-gray-700 transition border border-gray-700 hover:border-purple-500"
                    >
                        {song.albumArtUrl ? (
                            <img src={song.albumArtUrl} alt="Cover" className="w-16 h-16 rounded object-cover" />
                        ) : (
                            <div className="w-16 h-16 bg-gray-600 rounded flex items-center justify-center text-2xl">🎵</div>
                        )}
                        <div className="overflow-hidden">
                            <h4 className="font-bold text-white truncate">{song.title}</h4>
                            <p className="text-xs text-gray-400">{song.genre} • {song.mood}</p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(song.timestamp).toLocaleDateString()}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}
