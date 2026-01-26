import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Manually configuring the API key as requested.
// This allows the app to skip the selection screen and use this key by default.
(window as any).process = {
  env: {
    API_KEY: "AIzaSyDyRCg-_sMNJQw9a_U835saZgSN0eIT_tQ"
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);