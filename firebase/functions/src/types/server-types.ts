// Server-only types - not shared with webapp clients

// Request/Response types for server-side validation
export interface UpdateGroupRequest {
    name?: string;
    description?: string;
}
