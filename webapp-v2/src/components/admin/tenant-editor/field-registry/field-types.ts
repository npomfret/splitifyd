import type { TenantData } from '../types';

export type SectionId =
    | 'palette'
    | 'surfaces'
    | 'text'
    | 'interactive'
    | 'border'
    | 'status'
    | 'typography'
    | 'spacing'
    | 'radii'
    | 'shadows'
    | 'motion'
    | 'aurora'
    | 'glassmorphism'
    | 'legal'
    | 'marketing';

interface BaseFieldDef<K extends keyof TenantData> {
    key: K;
    label: string;
    section: SectionId;
    subsection?: string;
    required?: boolean;
    placeholder?: string;
    testId?: string;
    gridCols?: 1 | 2 | 3 | 4 | 5;
}

interface ColorFieldDef<K extends keyof TenantData> extends BaseFieldDef<K> {
    type: 'color';
    tokenPath: string;
    default: '';
}

interface RgbaFieldDef<K extends keyof TenantData> extends BaseFieldDef<K> {
    type: 'rgba';
    tokenPath: string;
    default: '';
}

interface StringFieldDef<K extends keyof TenantData> extends BaseFieldDef<K> {
    type: 'string';
    tokenPath: string;
    default: '';
    monospace?: boolean;
}

interface NumberFieldDef<K extends keyof TenantData> extends BaseFieldDef<K> {
    type: 'number';
    tokenPath: string;
    default: number;
}

interface BooleanFieldDef<K extends keyof TenantData> extends BaseFieldDef<K> {
    type: 'boolean';
    tokenPath: string;
    default: boolean;
    description?: string;
}

interface ColorArrayFieldDef<K extends keyof TenantData> extends BaseFieldDef<K> {
    type: 'colorArray';
    tokenPath: string;
    default: string[];
    minColors: number;
    maxColors: number;
}

interface SelectFieldDef<K extends keyof TenantData> extends BaseFieldDef<K> {
    type: 'select';
    tokenPath: string;
    default: string;
    options: string[];
}

type FieldDef<K extends keyof TenantData = keyof TenantData> =
    | ColorFieldDef<K>
    | RgbaFieldDef<K>
    | StringFieldDef<K>
    | NumberFieldDef<K>
    | BooleanFieldDef<K>
    | ColorArrayFieldDef<K>
    | SelectFieldDef<K>;

export type AnyFieldDef = FieldDef<keyof TenantData>;
