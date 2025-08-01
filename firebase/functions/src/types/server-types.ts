// Server-only types - not shared with webapp clients
import { Group, GroupBalance } from './webapp-shared-types';

// Firestore document structure
export interface GroupDocument {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

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
  memberIds?: string[];
  createdAt: string;
  updatedAt: string;
}