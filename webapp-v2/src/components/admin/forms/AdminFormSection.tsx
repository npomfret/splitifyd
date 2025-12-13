import { ChevronDownIcon } from '@/components/ui/icons';
import { useState } from 'preact/hooks';

interface AdminFormSectionProps {
    title: string;
    description?: string;
    defaultOpen?: boolean;
    testId?: string;
    children: preact.ComponentChildren;
}

export function AdminFormSection({ title, description, defaultOpen = false, testId, children }: AdminFormSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className='border border-border-default rounded-lg overflow-hidden'>
            <button
                type='button'
                onClick={() => setIsOpen(!isOpen)}
                className='w-full flex items-center justify-between px-4 py-3 bg-surface-raised hover:bg-surface-base transition-colors'
                data-testid={testId}
                aria-expanded={isOpen}
            >
                <div className='text-start'>
                    <h3 className='text-sm font-semibold text-text-primary'>{title}</h3>
                    {description && <p className='help-text-xs mt-0.5'>{description}</p>}
                </div>
                <ChevronDownIcon size={20} className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className='px-4 py-4 space-y-4 border-t border-border-subtle'>{children}</div>}
        </div>
    );
}
