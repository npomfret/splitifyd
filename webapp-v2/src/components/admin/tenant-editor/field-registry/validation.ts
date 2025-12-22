import type { TFunction } from 'i18next';
import type { TenantData } from '../types';
import { getRequiredFields } from './registry';

export function validateTenantData(formData: TenantData, t: TFunction): string | null {
    const required = (field: string) => t('validation.required', { field });

    // Validate tenantId format
    if (!/^[a-z0-9-]+$/.test(formData.tenantId)) {
        return t('admin.tenantEditor.validation.tenantIdFormat');
    }

    // Validate domains
    if (formData.domains.length === 0) {
        return t('admin.tenantEditor.validation.domainRequired');
    }

    // Validate core required fields not in registry
    if (!formData.tenantId.trim()) {
        return required(t('admin.tenantEditor.fields.tenantId'));
    }

    if (!formData.appName.trim()) {
        return required(t('admin.tenantEditor.fields.appName'));
    }

    if (!formData.logoUrl.trim()) {
        return required(t('admin.tenantEditor.fields.logoUrl'));
    }

    // Validate all required fields from registry
    const requiredFields = getRequiredFields();

    for (const field of requiredFields) {
        const value = formData[field.key as keyof TenantData];

        if (field.type === 'string' || field.type === 'color' || field.type === 'rgba' || field.type === 'select') {
            if (typeof value === 'string' && !value.trim()) {
                return required(field.label);
            }
        } else if (field.type === 'number') {
            if (typeof value === 'number' && !value && value !== 0) {
                return required(field.label);
            }
        }
    }

    return null;
}
