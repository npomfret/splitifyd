import { render } from 'preact';
import { App } from './App';
import { AuthProvider } from './app/providers/AuthProvider';
import './styles/global.css';
import { registerThemeServiceWorker } from './utils/theme-bootstrap';

registerThemeServiceWorker();

// Navigation tracking is handled by NavigationService
// Click tracking is handled by Button and Clickable components

render(
    <AuthProvider>
        <App />
    </AuthProvider>,
    document.getElementById('app')!,
);
