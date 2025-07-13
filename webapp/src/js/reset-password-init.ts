import { ResetPasswordComponent } from './components/ResetPasswordComponent.js';
import './warning-banner.js';

document.addEventListener('DOMContentLoaded', () => {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        throw new Error('app-root element not found');
    }

    const resetPasswordComponent = new ResetPasswordComponent();
    resetPasswordComponent.mount(appRoot);
});