// Server-only types - not shared with webapp clients

// Request/Response types for server-side validation
export interface UpdateGroupRequest {
    name?: string;
    description?: string;
}

// Policy admin response types (NOT consumed by webapp - admin only)
export interface UpdatePolicyResponse {
    success: boolean;
    versionHash: string;
    published: boolean;
    currentVersionHash: string | undefined;
    message: string;
}

export interface PublishPolicyResponse {
    success: boolean;
    message: string;
    currentVersionHash: string;
}

export interface CreatePolicyResponse {
    success: boolean;
    id: string;
    versionHash: string;
    message: string;
}

export interface DeletePolicyVersionResponse {
    success: boolean;
    message: string;
}

// Test pool response types
export interface ReturnTestUserResponse {
    message: string;
    email: string;
}

// Test endpoint response types
export interface TestErrorResponse {
    error: {
        code: string;
        message: string;
    };
}

export interface TestSuccessResponse {
    success: boolean;
    message: string;
}

export interface TestPromoteToAdminResponse {
    success: boolean;
    message: string;
    userId: string;
}
