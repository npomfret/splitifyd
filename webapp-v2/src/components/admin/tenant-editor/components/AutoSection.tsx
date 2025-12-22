import { AdminFormSection, SubsectionHeader } from '@/components/admin/forms';
import type { AnyFieldDef, SectionId } from '../field-registry';
import { getFieldsBySection } from '../field-registry';
import { getSectionConfig } from '../section-config';
import type { CreationMode, TenantData } from '../types';
import { FieldRenderer } from './FieldRenderer';

interface AutoSectionProps {
    sectionId: SectionId;
    formData: TenantData;
    update: (partial: Partial<TenantData>) => void;
    isSaving: boolean;
    mode: 'create' | 'edit';
    creationMode: CreationMode;
}

interface FieldGroup {
    subsection: string | undefined;
    fields: AnyFieldDef[];
}

function groupFieldsBySubsection(fields: AnyFieldDef[]): FieldGroup[] {
    const groups: FieldGroup[] = [];
    let currentGroup: FieldGroup | null = null;

    for (const field of fields) {
        if (currentGroup === null || currentGroup.subsection !== field.subsection) {
            currentGroup = { subsection: field.subsection, fields: [] };
            groups.push(currentGroup);
        }
        currentGroup.fields.push(field);
    }

    return groups;
}

function getGridClass(gridCols: number | undefined): string {
    switch (gridCols) {
        case 1:
            return 'grid-cols-1';
        case 2:
            return 'grid-cols-2';
        case 3:
            return 'grid-cols-3';
        case 4:
            return 'grid-cols-4';
        case 5:
            return 'grid-cols-5';
        default:
            return 'grid-cols-2';
    }
}

function renderFieldGrid(fields: AnyFieldDef[], formData: TenantData, update: (partial: Partial<TenantData>) => void, isSaving: boolean) {
    // Group fields by their gridCols setting
    const fieldsByGridCols = new Map<number, AnyFieldDef[]>();

    for (const field of fields) {
        const cols = field.gridCols || 2;
        if (!fieldsByGridCols.has(cols)) {
            fieldsByGridCols.set(cols, []);
        }
        fieldsByGridCols.get(cols)!.push(field);
    }

    // If all fields have the same gridCols, render them in a single grid
    if (fieldsByGridCols.size === 1) {
        const [cols, groupFields] = [...fieldsByGridCols.entries()][0];
        return (
            <div className={`grid ${getGridClass(cols)} gap-4`}>
                {groupFields.map((field) => (
                    <FieldRenderer
                        key={field.key}
                        field={field}
                        formData={formData}
                        update={update}
                        isSaving={isSaving}
                    />
                ))}
            </div>
        );
    }

    // Otherwise, render in order preserving original layout
    // Group consecutive fields with same gridCols
    const gridGroups: Array<{ cols: number; fields: AnyFieldDef[]; }> = [];
    let currentGridGroup: { cols: number; fields: AnyFieldDef[]; } | null = null;

    for (const field of fields) {
        const cols = field.gridCols || 2;
        if (currentGridGroup === null || currentGridGroup.cols !== cols) {
            currentGridGroup = { cols, fields: [] };
            gridGroups.push(currentGridGroup);
        }
        currentGridGroup.fields.push(field);
    }

    return (
        <>
            {gridGroups.map((group, idx) => (
                <div key={idx} className={`grid ${getGridClass(group.cols)} gap-4 ${idx > 0 ? 'mt-4' : ''}`}>
                    {group.fields.map((field) => (
                        <FieldRenderer
                            key={field.key}
                            field={field}
                            formData={formData}
                            update={update}
                            isSaving={isSaving}
                        />
                    ))}
                </div>
            ))}
        </>
    );
}

export function AutoSection({ sectionId, formData, update, isSaving, mode, creationMode }: AutoSectionProps) {
    const config = getSectionConfig(sectionId);
    const fields = getFieldsBySection(sectionId);

    if (!config || fields.length === 0) {
        return null;
    }

    // Check conditional visibility
    if (config.condition && !config.condition(formData)) {
        return null;
    }

    const groups = groupFieldsBySubsection(fields);
    const defaultOpen = config.defaultOpen ?? (mode === 'create' && creationMode === 'empty');

    // Handle boolean-only sections (like Feature Flags in motion)
    const allBoolean = fields.every((f) => f.type === 'boolean');

    return (
        <AdminFormSection
            title={config.title}
            description={config.description}
            defaultOpen={defaultOpen}
            testId={config.testId}
        >
            <div className='space-y-4'>
                {groups.map((group, groupIdx) => (
                    <div key={groupIdx}>
                        {group.subsection && <SubsectionHeader title={group.subsection} />}

                        {allBoolean || group.fields.every((f) => f.type === 'boolean')
                            ? (
                                <div className='space-y-3'>
                                    {group.fields.map((field) => (
                                        <FieldRenderer
                                            key={field.key}
                                            field={field}
                                            formData={formData}
                                            update={update}
                                            isSaving={isSaving}
                                        />
                                    ))}
                                </div>
                            )
                            : (
                                renderFieldGrid(group.fields, formData, update, isSaving)
                            )}
                    </div>
                ))}
            </div>
        </AdminFormSection>
    );
}
