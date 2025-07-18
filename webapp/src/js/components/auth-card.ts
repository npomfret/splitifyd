import { AuthCardConfig } from '../types/components';

interface ExtendedAuthCardConfig extends AuthCardConfig {
    subtitleTitle?: string | null;
    formContent?: string;
    footerContent?: string;
    cardClass?: string;
}

export const AuthCardComponent = {
    render: (config: ExtendedAuthCardConfig): string => {
        const { 
            title = 'Bill Splitter', 
            subtitle = 'Split bills with friends',
            subtitleTitle = null,
            formContent = '',
            footerContent = '',
            cardClass = ''
        } = config;

        return `
            <div class="main-content">
                <main class="auth-container">
                    <article class="auth-card ${cardClass}">
                        <header class="auth-card__header">
                            <h1 class="auth-card__title">
                                <a href="/index.html" class="auth-card__title-link">${title}</a>
                            </h1>
                            ${subtitleTitle ? `<h2 class="auth-card__subtitle-title">${subtitleTitle}</h2>` : ''}
                            <p class="auth-card__subtitle">${subtitle}</p>
                        </header>
                        
                        ${formContent}
                        
                        ${footerContent ? `
                            <footer class="auth-card__footer">
                                ${footerContent}
                            </footer>
                        ` : ''}
                    </article>
                </main>
            </div>
        `;
    }
};