import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createServices } from './app/bridge';
import './styles/app.css';

const services = createServices();

// Test/debug hooks exist only in dev/e2e builds; production builds drop this branch entirely.
if (import.meta.env.DEV) {
  void import('./debug/testHooks').then((m) => m.installTestHooks(services));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
