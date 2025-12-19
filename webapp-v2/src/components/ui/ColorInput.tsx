interface ColorInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    testId?: string;
    placeholder?: string;
}

export function ColorInput({
    id,
    label,
    value,
    onChange,
    disabled,
    testId,
    placeholder = '#RRGGBB',
}: ColorInputProps) {
    return (
        <div>
            <label htmlFor={id} className='block text-xs font-medium text-text-secondary mb-1'>
                {label}
            </label>
            <div className='flex items-center gap-2'>
                <div className='relative h-8 w-12 shrink-0 rounded border-2 border-border-strong overflow-hidden checkerboard-bg'>
                    <input
                        id={id}
                        type='color'
                        value={value || '#000000'}
                        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                        disabled={disabled}
                        className='absolute inset-0 w-full h-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border-0'
                        style={{ padding: 0, margin: 0 }}
                        data-testid={testId}
                    />
                </div>
                <input
                    type='text'
                    value={value}
                    onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className='flex-1 min-w-0 text-xs text-text-muted font-mono rounded border border-border-default bg-surface-base px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50'
                />
            </div>
        </div>
    );
}

interface RgbaColorInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    testId?: string;
    placeholder?: string;
}

export function RgbaColorInput({
    id,
    label,
    value,
    onChange,
    disabled,
    testId,
    placeholder = 'rgba(0, 0, 0, 0.5)',
}: RgbaColorInputProps) {
    return (
        <div>
            <label htmlFor={id} className='block text-xs font-medium text-text-secondary mb-1'>
                {label}
            </label>
            <div className='flex items-center gap-2'>
                <div className='relative h-8 w-12 shrink-0 rounded border-2 border-border-strong overflow-hidden checkerboard-bg'>
                    <div
                        className='absolute inset-0'
                        style={{ backgroundColor: value || 'transparent' }}
                        title={value || 'No color set'}
                    />
                </div>
                <input
                    id={id}
                    type='text'
                    value={value}
                    onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className='flex-1 min-w-0 text-xs text-text-muted font-mono rounded border border-border-default bg-surface-base px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50'
                    data-testid={testId}
                />
            </div>
        </div>
    );
}
