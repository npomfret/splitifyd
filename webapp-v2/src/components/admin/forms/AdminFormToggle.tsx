interface AdminFormToggleProps {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    testId: string;
}

export function AdminFormToggle({ label, description, checked, onChange, disabled, testId }: AdminFormToggleProps) {
    return (
        <label class='flex items-start gap-3 cursor-pointer'>
            <input
                type='checkbox'
                checked={checked}
                onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
                disabled={disabled}
                class='h-4 w-4 mt-0.5 rounded border-border-default'
                data-testid={testId}
            />
            <div>
                <span class='text-sm font-medium text-text-primary'>{label}</span>
                {description && <p class='text-xs text-text-muted'>{description}</p>}
            </div>
        </label>
    );
}
