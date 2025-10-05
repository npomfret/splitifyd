export type ChangeType = 'created' | 'updated' | 'deleted';
type ChangePriority = 'high' | 'medium' | 'low';

export interface ChangeMetadata {
    priority: ChangePriority;
    affectedUsers: string[];
    changedFields?: string[];
}

