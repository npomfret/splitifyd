import { AdminFormInput, AdminFormToggle } from '@/components/admin/forms';
import { ColorInput, RgbaColorInput } from '@/components/ui';
import type { AnyFieldDef } from '../field-registry';
import type { TenantData } from '../types';

interface FieldRendererProps {
    field: AnyFieldDef;
    formData: TenantData;
    update: (partial: Partial<TenantData>) => void;
    isSaving: boolean;
}

export function FieldRenderer({ field, formData, update, isSaving }: FieldRendererProps) {
    const value = formData[field.key as keyof TenantData];
    const label = field.required ? `${field.label} *` : field.label;

    switch (field.type) {
        case 'color':
            return (
                <ColorInput
                    id={field.key}
                    label={label}
                    value={value as string}
                    onChange={(v) => update({ [field.key]: v } as Partial<TenantData>)}
                    disabled={isSaving}
                    testId={field.testId}
                />
            );

        case 'rgba':
            return (
                <RgbaColorInput
                    id={field.key}
                    label={label}
                    value={value as string}
                    onChange={(v) => update({ [field.key]: v } as Partial<TenantData>)}
                    disabled={isSaving}
                    testId={field.testId}
                />
            );

        case 'string':
            return (
                <AdminFormInput
                    id={field.key}
                    label={label}
                    value={value as string}
                    onChange={(v) => update({ [field.key]: v } as Partial<TenantData>)}
                    placeholder={field.placeholder}
                    disabled={isSaving}
                    monospace={field.monospace}
                    required={field.required}
                />
            );

        case 'number':
            return (
                <AdminFormInput
                    id={field.key}
                    label={label}
                    type='number'
                    value={value as number}
                    onChange={(v) => update({ [field.key]: parseInt(v) || 0 } as Partial<TenantData>)}
                    placeholder={field.placeholder}
                    disabled={isSaving}
                    required={field.required}
                    testId={field.testId}
                />
            );

        case 'boolean':
            return (
                <AdminFormToggle
                    label={field.label}
                    description={field.description}
                    checked={value as boolean}
                    onChange={(v) => update({ [field.key]: v } as Partial<TenantData>)}
                    disabled={isSaving}
                    testId={field.testId}
                />
            );

        case 'select':
            return (
                <div>
                    <label className='block text-xs font-medium text-text-secondary mb-1'>{label}</label>
                    <select
                        value={value as string}
                        onChange={(e) => update({ [field.key]: (e.target as HTMLSelectElement).value } as Partial<TenantData>)}
                        disabled={isSaving}
                        className='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
                    >
                        {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            );

        case 'colorArray':
            return (
                <ColorArrayField
                    field={field}
                    value={value as string[]}
                    onChange={(v) => update({ [field.key]: v } as Partial<TenantData>)}
                    isSaving={isSaving}
                />
            );

        default:
            return null;
    }
}

interface ColorArrayFieldProps {
    field: AnyFieldDef & { type: 'colorArray'; };
    value: string[];
    onChange: (value: string[]) => void;
    isSaving: boolean;
}

function ColorArrayField({ field, value, onChange, isSaving }: ColorArrayFieldProps) {
    const colors = value || [];
    const slots = Array.from({ length: field.maxColors }, (_, i) => i);

    return (
        <div className='grid grid-cols-2 gap-4'>
            {slots.map((i) => (
                <ColorInput
                    key={i}
                    id={`${field.key}-${i}`}
                    label={`Color ${i + 1}${i < field.minColors ? ' *' : ''}`}
                    value={colors[i] || ''}
                    onChange={(v) => {
                        const newColors = [...colors];
                        newColors[i] = v;
                        onChange(newColors);
                    }}
                    disabled={isSaving}
                    testId={`${field.testId || field.key}-color-${i + 1}-input`}
                />
            ))}
        </div>
    );
}
