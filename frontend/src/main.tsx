import React from 'react';
import ReactDOM from 'react-dom/client';
import { ccc } from '@ckb-ccc/connector-react';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';

try {
  const t = localStorage.getItem('pckt:theme');
  if (t === 'dark' || t === 'light') {
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${t}`);
  }
} catch {
  /* ignore */
}

const cccThemeVars = {
  '--background': 'var(--bg)',
  '--divider': 'var(--border)',
  '--btn-primary': 'var(--accent)',
  '--btn-primary-hover': 'var(--accent-hov)',
  '--btn-secondary': 'var(--bg-elev-2)',
  '--btn-secondary-hover': 'var(--bg-elev-3)',
  '--icon-primary': 'var(--fg)',
  '--icon-secondary': 'var(--fg-muted)',
  '--tip-color': 'var(--fg-quiet)',
} as unknown as React.CSSProperties;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ccc.Provider
      name="pckt"
      icon={`${window.location.origin}/pckt-mark.svg`}
      hideMark
      connectorProps={{ style: cccThemeVars }}
    >
      <App />
    </ccc.Provider>
  </React.StrictMode>,
);
