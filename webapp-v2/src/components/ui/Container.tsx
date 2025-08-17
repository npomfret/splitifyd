import { ComponentChildren } from 'preact';

interface ContainerProps {
    children: ComponentChildren;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}

export function Container({ children, maxWidth = 'lg', className = '' }: ContainerProps) {
    const maxWidthClasses = {
        sm: 'max-w-screen-sm',
        md: 'max-w-screen-md',
        lg: 'max-w-screen-lg',
        xl: 'max-w-screen-xl',
        full: 'max-w-full',
    };

    return (
        <div
            className={`
        mx-auto px-4 sm:px-6 lg:px-8
        ${maxWidthClasses[maxWidth]}
        ${className}
      `.trim()}
        >
            {children}
        </div>
    );
}
