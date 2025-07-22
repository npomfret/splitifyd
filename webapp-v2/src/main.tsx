import { render } from 'preact';
import { App } from './App';
import { AuthProvider } from './app/providers/AuthProvider';
import './styles/global.css';

render(
  <AuthProvider>
    <App />
  </AuthProvider>, 
  document.getElementById('app')!
);