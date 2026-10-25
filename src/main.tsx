import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import './styles.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { parseWorldSeed } from './sim/seededRng';
import { useControlsStore } from './store/useControlsStore';
import { useUIStore } from './store/useUIStore';
import { applyWorldFromLocation } from './utils/shareUrl';

// Apply a shared world before first render so the sim is created with its grid and seed.
const sharedSeed = applyWorldFromLocation(useControlsStore.getState().setControls);
if (parseWorldSeed(sharedSeed) !== undefined) useUIStore.getState().setWorldSeed(sharedSeed!);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
