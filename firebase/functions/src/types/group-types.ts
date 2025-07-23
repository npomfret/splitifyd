/**
 * Group types - Re-exported from webapp-shared-types.ts to avoid duplication
 */

export {
  Group,
  GroupBalance,
  CreateGroupRequest,
  User,
  User as GroupMember, // Alias for backward compatibility
  UserBalance
} from './webapp-shared-types';

export {
  GroupWithBalance,
  GroupDocument,
  UpdateGroupRequest,
  GroupData,
} from './server-types';