// Server-only types - not shared with webapp clients
import { Group, GroupBalance } from '../shared/shared-types';

// Request/Response types for server-side validation
export interface UpdateGroupRequest {
    name?: string;
    description?: string;
}

export interface GroupWithBalance extends Group {
    balance: GroupBalance;
}

export interface GroupData {
    name: string;
    description?: string;
    members: Record<string, any>;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
