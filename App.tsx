import React, { useState, useEffect, useCallback } from 'react';
import { ApiKeySelector } from './components/ApiKeySelector';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ImageGenerator } from './components/ImageGenerator';
import { AudioGenerator } from './components/AudioGenerator';
import { ChatGenerator } from './components/ChatGenerator';

// Removed 'video' and 'music' from type
type ActiveTab = 'image' | 'audio' | 'chat';

export default function App() {
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);
  const [checkingApiKey, setCheckingApiKey] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('image'); // Default is now image

  const checkApiKey = useCallback(async () => {
    setCheckingApiKey(true);
    
    if (process.env.API_KEY) {
      setApiKeySelected(true);
      setCheckingApiKey(false);
      return;
    }

    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const hasKey = await aistudio.hasSelectedApiKey();
      setApiKeySelected(hasKey);
    } else {
      setApiKeySelected(false);
    }
    setCheckingApiKey(false);
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  const handleSelectApiKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'image':
        return <ImageGenerator />;
      case 'audio':
        return <AudioGenerator />;
      case 'chat':
        return <ChatGenerator />;
      default:
        return null;
    }
  };

  if (checkingApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (!apiKeySelected) {
    return <ApiKeySelector onSelectKey={handleSelectApiKey} />;
  }

  const TabButton = ({ tabName, label }: { tabName: ActiveTab; label: string }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-colors duration-200 ${
        activeTab === tabName
          ? 'bg-gray-800 text-purple-400 border-b-2 border-purple-400'
          : 'text-gray-400 hover:bg-gray-700/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            VisioAI
          </h1>
          <p className="text-gray-400 mt-2">Generate stunning images and audio with the power of Gemini.</p>
        </header>

        <div className="border-b border-gray-700 mb-6 overflow-x-auto">
          <nav className="-mb-px flex space-x-2 sm:space-x-4 min-w-max" aria-label="Tabs">
            <TabButton tabName="image" label="Images" />
            <TabButton tabName="audio" label="Voice/TTS" />
            <TabButton tabName="chat" label="Chat" />
          </nav>
        </div>

        <main className="bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
}