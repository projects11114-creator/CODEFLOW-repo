import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely suppress benign browser ResizeObserver notification loops
window.addEventListener(
  'error',
  (e) => {
    const msg = typeof e.message === 'string' ? e.message : (e.error?.message || '');
    if (
      msg.includes('ResizeObserver loop completed with undelivered notifications') ||
      msg.includes('ResizeObserver loop limit exceeded')
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(<App />);
