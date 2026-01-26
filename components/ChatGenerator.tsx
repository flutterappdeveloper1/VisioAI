import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, Content } from '@google/genai';
import { LoadingSpinner } from './LoadingSpinner';

// FIX: Explicitly type the component as React.FC to allow 'key' prop without TS errors
const ChatMessage: React.FC<{ message: Content }> = ({ message }) => {
  const isModel = message.role === 'model';
  return (
    <div className={`flex my-2 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`p-3 rounded-lg max-w-lg ${isModel ? 'bg-gray-700' : 'bg-purple-600'}`}>
        <p className="text-white whitespace-pre-wrap">{message.parts[0].text}</p>
      </div>
    </div>
  );
};

export function ChatGenerator() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<Content[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
    });
    setChat(chatSession);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !chat) return;

    const message = userInput;
    setUserInput('');
    setIsLoading(true);
    setError(null);

    // Add user message to history immediately
    setHistory(prev => [...prev, { role: 'user', parts: [{ text: message }] }]);

    try {
        const stream = await chat.sendMessageStream({ message });
        
        // Add a placeholder for the model's response
        setHistory(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

        for await (const chunk of stream) {
            const c = chunk as GenerateContentResponse;
            const chunkText = c.text;
            if (chunkText) {
                 setHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    lastMessage.parts[0].text += chunkText;
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
        <div className="flex-1 overflow-y-auto pr-4">
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
        
        {error && <div className="text-red-400 mt-2">{error}</div>}

        <form onSubmit={handleSendMessage} className="mt-4 flex items-center">
            <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-l-lg p-3 text-gray-100 focus:ring-2 focus:ring-purple-500 transition"
                disabled={isLoading}
            />
            <button
                type="submit"
                className="bg-purple-600 text-white font-bold py-3 px-6 rounded-r-lg hover:bg-purple-700 disabled:bg-gray-500"
                disabled={isLoading || !userInput.trim()}
            >
                Send
            </button>
        </form>
    </div>
  );
}