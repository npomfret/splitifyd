import { ComponentChildren } from 'preact';

interface ContainerProps {
    children: ComponentChildren;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}

export function Container({ children, maxWidth = 'lg', className = '' }: ContainerProps) {
    const maxWidthClasses = {
        sm: 'max-w-(--breakpoint-sm)',
        md: 'max-w-(--breakpoint-md)',
        lg: 'max-w-(--breakpoint-lg)',
        xl: 'max-w-(--breakpoint-xl)',
        full: 'max-w-full',
    };

    return (
        <div
            className={`
        mx-auto px-4 sm:px-6 lg:px-8
        ${maxWidthClasses[maxWidth]}
        ${className}
      `
                .trim()}
        >
            {children}
        </div>
    );
}
