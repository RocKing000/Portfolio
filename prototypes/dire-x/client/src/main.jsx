import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Start the GeoJSON network fetch immediately so the response is ready when GlobeView needs it.
// We intentionally do NOT parse here — r.json() takes ~40ms on the main thread for 500KB
// and could drop an animation frame. GlobeView will call .json() at mount time instead.
window.__geoJsonFetch = fetch(
  'https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson'
).catch(() => null);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
