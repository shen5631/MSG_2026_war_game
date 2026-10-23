import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createServices } from './app/bridge';
import './styles/app.css';

const services = createServices();

// Canvas text (Phaser heal popups) cannot wait for CSS font swaps: warm the game faces up front. Failure is harmless
// (the fallback font is used).
void document.fonts?.load('700 10px "Gowun Batang"').catch(() => {});
void document.fonts?.load('10px "Song Myung"').catch(() => {});

// Test/debug hooks exist only in dev/e2e builds; production builds drop this branch entirely.
if (import.meta.env.DEV) {
  void import('./debug/testHooks').then((m) => m.installTestHooks(services));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
