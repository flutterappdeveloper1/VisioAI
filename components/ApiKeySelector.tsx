
import React from 'react';

interface ApiKeySelectorProps {
  onSelectKey: () => void;
}

export function ApiKeySelector({ onSelectKey }: ApiKeySelectorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">API Key Required</h2>
        <p className="text-gray-400 mb-6">
          To generate videos with Veo, you must select a valid API key from a paid Google Cloud project.
        </p>
        <button
          onClick={onSelectKey}
          className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-3 px-4 rounded-lg text-lg transition-transform duration-200 transform hover:scale-105"
        >
          Select Your API Key
        </button>
        <p className="text-xs text-gray-500 mt-4">
          By continuing, you agree to the terms of service. For more information on billing, visit{' '}
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-teal-400 hover:underline"
          >
            Gemini API Billing
          </a>.
        </p>
      </div>
    </div>
  );
}
