import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, Content, Part } from '@google/genai';
import { LoadingSpinner } from './LoadingSpinner';
import { fileToBase64 } from '../utils';

// FIX: Explicitly type the component as React.FC to allow 'key' prop without TS errors
const ChatMessage: React.FC<{ message: Content }> = ({ message }) => {
  const isModel = message.role === 'model';
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Safely extract text from parts
  const textContent = message.parts ? message.parts.map(p => p.text || '').join(' ').trim() : '';

  const handleSpeak = () => {
    if (!textContent) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel(); // Stop any currently playing audio
      const utterance = new SpeechSynthesisUtterance(textContent);
      
      // Optional: Select a preferred voice (e.g., standard English) if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  return (
    <div className={`flex my-2 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`p-3 rounded-lg max-w-lg ${isModel ? 'bg-gray-700' : 'bg-purple-600'}`}>
        {/* Render text parts */}
        <div className={textContent ? "mb-2" : ""}>
            {message.parts.map((part, i) => (
                <div key={i}>
                    {part.text && <p className="text-white whitespace-pre-wrap">{part.text}</p>}
                    {part.inlineData && (
                        <div className="mt-2 text-xs text-gray-300 bg-gray-900/50 p-1 rounded">
                            [{part.inlineData.mimeType} Attachment]
                        </div>
                    )}
                </div>
            ))}
        </div>

        {/* Speaker/Read Aloud Button */}
        {textContent && (
            <div className={`flex ${isModel ? 'justify-start' : 'justify-end'} border-t border-white/10 pt-1`}>
                 <button 
                    onClick={handleSpeak}
                    className="text-gray-300 hover:text-white transition-colors p-1 rounded hover:bg-white/10 flex items-center gap-1 text-xs font-medium"
                    title={isSpeaking ? "Stop reading" : "Read aloud"}
                >
                    {isSpeaking ? (
                        <>
                            <svg className="w-4 h-4 animate-pulse text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                            <span>Stop</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                            <span>Listen</span>
                        </>
                    )}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export function ChatGenerator() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<Content[]>([]);
  const [userInput, setUserInput] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
          systemInstruction: "You are a helpful AI assistant. You can analyze images, transcribe audio, and summarize video links provided by the user. If a video link is provided, try to summarize its content based on your knowledge."
      }
    });
    setChat(chatSession);

    // Initialize Speech Recognition if supported
    if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false; // Stop after speaking a sentence
            recognition.interimResults = false;
            
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setUserInput(prev => prev ? `${prev} ${transcript}` : transcript);
            };

            recognition.onend = () => {
                setIsListening(false);
            };
            
            recognition.onerror = (event: any) => {
                console.error("Speech Recognition Error", event.error);
                setIsListening(false);
            };
            
            recognitionRef.current = recognition;
        }
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  // Clean up recognition on unmount
  useEffect(() => {
      return () => {
          if (recognitionRef.current && isListening) {
              recognitionRef.current.stop();
          }
      };
  }, [isListening]);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setAttachment(e.target.files[0]);
      }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
        alert("Your browser does not support Speech to Text functionality (try Chrome, Edge, or Safari).");
        return;
    }

    if (isListening) {
        recognitionRef.current.stop();
    } else {
        recognitionRef.current.start();
        setIsListening(true);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!userInput.trim() && !attachment) || !chat) return;

    const currentInput = userInput;
    const currentAttachment = attachment;
    
    // Reset inputs
    setUserInput('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsLoading(true);
    setError(null);

    // Prepare Parts
    const parts: Part[] = [];
    if (currentInput) {
        parts.push({ text: currentInput });
    }
    
    if (currentAttachment) {
        try {
            const base64Data = await fileToBase64(currentAttachment);
            parts.push({
                inlineData: {
                    mimeType: currentAttachment.type,
                    data: base64Data
                }
            });
        } catch (err) {
            setError("Failed to process attachment");
            setIsLoading(false);
            return;
        }
    }

    // Add user message to history immediately
    setHistory(prev => [...prev, { role: 'user', parts: parts }]);

    try {
        const stream = await chat.sendMessageStream({ message: parts });
        
        // Add a placeholder for the model's response
        setHistory(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

        for await (const chunk of stream) {
            const c = chunk as GenerateContentResponse;
            const chunkText = c.text;
            if (chunkText) {
                 setHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    // Append text to the existing text part or add new one
                    if (!lastMessage.parts[0].text) {
                        lastMessage.parts[0].text = chunkText;
                    } else {
                        lastMessage.parts[0].text += chunkText;
                    }
                    return newHistory;
                });
            }
        }
    } catch (err: unknown) {
        setError(`An error occurred: ${(err as Error).message}`);
        // Remove the empty model placeholder on error
        setHistory(prev => prev.slice(0, -1));
    } finally {
        setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto pr-4 mb-4 custom-scrollbar">
            {history.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                    <p className="text-xl font-bold mb-2">VisioAI Chat</p>
                    <p className="text-sm text-center max-w-xs">
                        Upload an image to translate text, upload audio to transcribe, or paste a video link to get a summary.
                    </p>
                </div>
            )}
            {history.map((msg, index) => (
                <ChatMessage key={index} message={msg} />
            ))}
             {isLoading && (
                <div className="flex justify-start my-2">
                    <div className="p-3 rounded-lg bg-gray-700">
                        <LoadingSpinner />
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>
        
        {error && <div className="text-red-400 mb-2 text-sm text-center bg-red-900/20 py-1 rounded">{error}</div>}

        <form onSubmit={handleSendMessage} className="mt-auto relative">
            {attachment && (
                <div className="absolute -top-10 left-0 bg-gray-700 text-xs text-white px-3 py-1 rounded-t-lg flex items-center border border-gray-600 border-b-0">
                    <span className="truncate max-w-[200px]">{attachment.name}</span>
                    <button 
                        type="button" 
                        onClick={() => { setAttachment(null); if(fileInputRef.current) fileInputRef.current.value=''; }}
                        className="ml-2 text-red-400 hover:text-red-300 font-bold"
                    >
                        ×
                    </button>
                </div>
            )}
            
            <div className="flex items-center bg-gray-700 border-2 border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 transition overflow-hidden">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors border-r border-gray-600"
                    title="Attach Image or Audio"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/*,audio/*"
                />
                
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={isListening ? "Listening... (Speak now)" : "Ask a question, paste a link..."}
                    className="flex-1 bg-transparent p-3 text-gray-100 focus:outline-none"
                    disabled={isLoading}
                />
                
                {/* Microphone Button */}
                <button
                    type="button"
                    onClick={handleMicClick}
                    className={`p-3 transition-colors border-l border-gray-600 ${isListening ? 'text-red-500 hover:text-red-400 animate-pulse bg-red-900/10' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
                    title={isListening ? "Stop listening" : "Speak to type"}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>

                <button
                    type="submit"
                    className="bg-purple-600 text-white font-bold p-3 px-6 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    disabled={isLoading || (!userInput.trim() && !attachment)}
                >
                    <svg className="w-6 h-6 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
            </div>
        </form>
    </div>
  );
}