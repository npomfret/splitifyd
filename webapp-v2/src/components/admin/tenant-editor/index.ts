// Re-export from new field-registry module (single source of truth)
export {
    EMPTY_TENANT_DATA,
    extractFormDataFromTokens,
    buildBrandingTokensFromForm,
    validateTenantData,
    FIELD_REGISTRY,
    getFieldsBySection,
} from './field-registry';

export type {
    SectionId,
    FieldDef,
    AnyFieldDef,
    ColorFieldDef,
    RgbaFieldDef,
    StringFieldDef,
    NumberFieldDef,
    BooleanFieldDef,
    ColorArrayFieldDef,
    SelectFieldDef,
} from './field-registry';

// Re-export types
export * from './types';

// Re-export section config
export { SECTION_CONFIG, getSectionConfig, getVisibleSections } from './section-config';
export type { SectionConfig } from './section-config';

// Re-export components
export { AutoSection, FieldRenderer } from './components';
