import { config } from './config.js';
import { authManager } from './auth.js';
import type { ApiResponse } from './types/global.js';
import type {
    CreateGroupRequest,
    CreateExpenseRequest,
    UpdateExpenseRequest,
    ListDocumentsResponse,
    DocumentResponse,
    GroupDocument,
    Member,
    TransformedGroup,
    GroupDetail,
    ExpenseData,
    GroupBalances,
    ShareableLinkResponse,
    JoinGroupResponse,
    FirestoreTimestamp
} from './types/api.js';

class ApiService {
    private _baseUrlPromise: Promise<string> | null = null;

    private async _getBaseUrl(): Promise<string> {
        if (!this._baseUrlPromise) {
            this._baseUrlPromise = config.getApiUrl();
        }
        return this._baseUrlPromise;
    }

    private _getAuthToken(): string | null {
        return localStorage.getItem('splitifyd_auth_token');
    }

    private _getAuthHeaders(): Record<string, string> {
        const token = this._getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async getGroups(): Promise<TransformedGroup[]> {
        try {
            const data = await apiCall<ListDocumentsResponse>('/listDocuments', {
                method: 'GET'
            });
            return this._transformGroupsData(data.documents);
            
        } catch (error) {
            throw error;
        }
    }

    private _transformGroupsData(documents: DocumentResponse[]): TransformedGroup[] {
        return documents.map(doc => ({
            id: doc.id,
            name: doc.data.name || 'Unnamed Group',
            memberCount: doc.data.members?.length || 0,
            yourBalance: doc.data.yourBalance || 0,
            lastActivity: this._formatLastActivity(doc.data.updatedAt),
            lastActivityRaw: doc.data.updatedAt,
            lastExpense: doc.data.lastExpense || null,
            members: doc.data.members || [],
            expenseCount: doc.data.expenseCount || 0,
            lastExpenseTime: doc.data.lastExpenseTime || null
        }));
    }

    private _formatLastActivity(timestamp: string | FirestoreTimestamp | undefined): string {
        if (!timestamp) {
            return 'Never';
        }
        
        let date: Date;
        if (timestamp && typeof timestamp === 'object' && '_seconds' in timestamp) {
            // Handle Firestore Timestamp format
            date = new Date(timestamp._seconds * 1000);
        } else {
            // Handle ISO string or regular timestamp
            date = new Date(timestamp as string);
        }
        
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }


    async createGroup(groupData: CreateGroupRequest): Promise<TransformedGroup> {
        if (!groupData.name?.trim()) {
            throw new Error('Group name is required');
        }

        try {
            const groupDoc = {
                data: {
                    name: groupData.name.trim(),
                    description: groupData.description?.trim() || '',
                    memberEmails: groupData.memberEmails || [],
                    members: [{ uid: authManager.getUserId(), name: 'You', initials: 'YO' }],
                    yourBalance: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };

            const data = await apiCall<{ id: string }>('/createDocument', {
                method: 'POST',
                body: JSON.stringify(groupDoc)
            });
            
            // Server only returns id, construct the full group object
            return {
                id: data.id,
                name: groupData.name.trim(),
                memberCount: 1 + (groupData.memberEmails?.length || 0),
                yourBalance: 0,
                lastActivity: 'Just now',
                lastActivityRaw: new Date().toISOString(),
                lastExpense: null,
                members: [{ uid: authManager.getUserId() || '', name: 'You', initials: 'YO' }],
                expenseCount: 0,
                lastExpenseTime: null
            };
            
        } catch (error) {
            throw error;
        }
    }

    private _transformGroupData(document: DocumentResponse): TransformedGroup {
        return {
            id: document.id,
            name: document.data.name,
            memberCount: document.data.members.length,
            yourBalance: document.data.yourBalance,
            lastActivity: this._formatLastActivity(document.data.updatedAt),
            lastActivityRaw: document.data.updatedAt,
            lastExpense: document.data.lastExpense,
            members: document.data.members,
            expenseCount: document.data.expenseCount || 0,
            lastExpenseTime: document.data.lastExpenseTime || null
        };
    }


    async getGroup(groupId: string): Promise<{ data: GroupDetail }> {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        try {
            const data = await apiCall<GroupDocument>(`/getDocument?id=${groupId}`, {
                method: 'GET'
            });
            return { data: this._transformGroupDetail(data) };
        } catch (error) {
            throw error;
        }
    }

    private _transformGroupDetail(document: GroupDocument): GroupDetail {
        const data = document.data;
        return {
            id: document.id,
            name: data.name,
            description: data.description,
            members: data.members,
            createdBy: data.createdBy,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    }


    async getGroupBalances(groupId: string): Promise<{ data: GroupBalances }> {
        try {
            const data = await apiCall<GroupBalances>(`/groups/balances?groupId=${groupId}`, {
                method: 'GET'
            });
            return { data: data };
        } catch (error) {
            throw error;
        }
    }


    async getGroupExpenses(groupId: string, limit: number = 20, offset: number = 0): Promise<{ data: ExpenseData[] }> {
        try {
            const data = await apiCall<{ expenses: ExpenseData[] }>(`/expenses/group?groupId=${groupId}&limit=${limit}&offset=${offset}`, {
                method: 'GET'
            });
            return { data: data.expenses };
        } catch (error) {
            throw error;
        }
    }


    async updateGroup(groupId: string, updates: Partial<GroupDetail>): Promise<any> {
        try {
            const data = await apiCall(`/updateDocument?id=${groupId}`, {
                method: 'PUT',
                body: JSON.stringify({ data: updates })
            });
            return data;
        } catch (error) {
            throw error;
        }
    }

    async deleteGroup(groupId: string): Promise<{ success: boolean }> {
        try {
            await apiCall(`/deleteDocument?id=${groupId}`, {
                method: 'DELETE'
            });
            return { success: true };
        } catch (error) {
            throw error;
        }
    }



    async createExpense(expenseData: CreateExpenseRequest): Promise<{ success: boolean; data: ExpenseData }> {
        try {
            const data = await apiCall<ExpenseData>('/expenses', {
                method: 'POST',
                body: JSON.stringify(expenseData)
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

    async getExpense(expenseId: string): Promise<{ data: ExpenseData }> {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        try {
            const data = await apiCall<ExpenseData>(`/expenses?id=${expenseId}`, {
                method: 'GET'
            });
            return { data: data };
        } catch (error) {
            throw error;
        }
    }

    async updateExpense(expenseId: string, updateData: UpdateExpenseRequest): Promise<{ success: boolean; data: ExpenseData }> {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        try {
            const data = await apiCall<ExpenseData>(`/expenses?id=${expenseId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

    async generateShareableLink(groupId: string): Promise<{ success: boolean; data: ShareableLinkResponse }> {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        try {
            const data = await apiCall<ShareableLinkResponse>('/groups/share', {
                method: 'POST',
                body: JSON.stringify({ groupId })
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

    async joinGroupByLink(linkId: string): Promise<{ success: boolean; data: JoinGroupResponse }> {
        if (!linkId) {
            throw new Error('Link ID is required');
        }

        try {
            const data = await apiCall<JoinGroupResponse>('/groups/join', {
                method: 'POST',
                body: JSON.stringify({ linkId })
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

}

export const apiService = new ApiService();

// Generic API call function for expense and group services
export async function apiCall<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await apiService['_getBaseUrl']();
    const url = `${baseUrl}${endpoint}`;
    
    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    
    // Add auth headers if we have a token
    const token = apiService['_getAuthToken']();
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
    
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('splitifyd_auth_token');
            window.location.href = 'index.html';
            throw new Error('Authentication required');
        }
        
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error?.message || 'Request failed');
    }
    
    return response.json();
}