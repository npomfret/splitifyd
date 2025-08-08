import { render } from 'preact';
import { App } from './App';
import { AuthProvider } from './app/providers/AuthProvider';
import { logUserAction, logButtonClick } from './utils/browser-logger';
import './styles/global.css';

// Global click interceptor for audit trail
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  
  // Skip if already handled by Button component
  if (target.closest('button[data-logged]')) {
    return;
  }
  
  // Handle native button elements
  if (target.tagName === 'BUTTON' || target.closest('button')) {
    const button = target.tagName === 'BUTTON' ? target : target.closest('button') as HTMLButtonElement;
    const buttonText = button.textContent?.trim() || button.getAttribute('aria-label') || 'Unknown Button';
    
    logButtonClick(buttonText, {
      id: button.id,
      className: button.className,
      page: window.location.pathname,
      element: 'native-button',
    });
  }
  
  // Handle link clicks
  else if (target.tagName === 'A' || target.closest('a')) {
    const link = (target.tagName === 'A' ? target : target.closest('a')) as HTMLAnchorElement;
    const linkText = link.textContent?.trim() || link.getAttribute('aria-label') || 'Unknown Link';
    
    logUserAction(`Link Click: ${linkText}`, {
      href: link.href,
      id: link.id,
      className: link.className,
      page: window.location.pathname,
      element: 'link',
    });
  }
  
  // Handle other clickable elements with onclick or role="button"
  else if (target.onclick || target.getAttribute('role') === 'button') {
    const elementText = target.textContent?.trim() || target.getAttribute('aria-label') || 'Unknown Element';
    
    logUserAction(`Element Click: ${elementText}`, {
      tagName: target.tagName.toLowerCase(),
      id: target.id,
      className: target.className,
      role: target.getAttribute('role'),
      page: window.location.pathname,
      element: 'clickable',
    });
  }
}, true); // Use capture phase to catch all clicks

// Track page navigation
let previousPath = window.location.pathname;
const checkNavigation = () => {
  const currentPath = window.location.pathname;
  if (currentPath !== previousPath) {
    logUserAction('Navigation', {
      from: previousPath,
      to: currentPath,
      type: 'spa-navigation',
    });
    previousPath = currentPath;
  }
};

// Check for navigation changes periodically (for SPA routing)
setInterval(checkNavigation, 100);

render(
  <AuthProvider>
    <App />
  </AuthProvider>, 
  document.getElementById('app')!
);