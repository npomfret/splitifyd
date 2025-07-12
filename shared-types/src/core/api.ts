export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
}

export interface GenerateShareableLinkRequest {
  groupId: string;
}

export interface JoinGroupRequest {
  linkId: string;
}

export interface ListDocumentsResponse {
  documents: DocumentResponse[];
}

export interface DocumentResponse {
  id: string;
  data: any;
}

export interface ShareableLinkResponse {
  linkId: string;
  shareableUrl: string;
  expiresAt: string;
}

export interface JoinGroupResponse {
  groupId: string;
  groupName: string;
  success: boolean;
}

export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}