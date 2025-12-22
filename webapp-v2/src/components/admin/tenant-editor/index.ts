// Re-export from new field-registry module (single source of truth)
export { buildBrandingTokensFromForm, EMPTY_TENANT_DATA, extractFormDataFromTokens, FIELD_REGISTRY, getFieldsBySection, validateTenantData } from './field-registry';

export type { AnyFieldDef, BooleanFieldDef, ColorArrayFieldDef, ColorFieldDef, FieldDef, NumberFieldDef, RgbaFieldDef, SectionId, SelectFieldDef, StringFieldDef } from './field-registry';

// Re-export types
export * from './types';

// Re-export section config
export { getSectionConfig, getVisibleSections, SECTION_CONFIG } from './section-config';
export type { SectionConfig } from './section-config';

// Re-export components
export { AutoSection, FieldRenderer } from './components';
