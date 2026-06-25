import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import TodoPage from './TodoPage';

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
const RootComponent = normalizedPath === '/todo' ? TodoPage : App;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
