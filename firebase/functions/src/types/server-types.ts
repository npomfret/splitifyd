// Server-only types - not shared with webapp clients
import { Group, GroupBalance } from '@splitifyd/shared';

// Request/Response types for server-side validation
export interface UpdateGroupRequest {
    name?: string;
    description?: string;
}
