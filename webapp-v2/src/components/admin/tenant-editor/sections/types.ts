import type { TenantData } from '../types';

export interface SectionProps {
    formData: TenantData;
    update: (partial: Partial<TenantData>) => void;
    isSaving: boolean;
}

export interface CreationModeSectionProps extends SectionProps {
    mode: 'create' | 'edit';
    creationMode: 'empty' | 'copy';
}
