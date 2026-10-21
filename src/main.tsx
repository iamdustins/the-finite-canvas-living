import React from 'react';
import ReactDOM from 'react-dom/client';
import LifespanApp from './lifespan_calculator';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LifespanApp />
  </React.StrictMode>,
);
