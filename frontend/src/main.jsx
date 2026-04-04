import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App';

// Global error handlers — catch errors that React ErrorBoundary misses
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error?.message, event.error?.stack);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise]', event.reason?.message || event.reason, event.reason?.stack);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
