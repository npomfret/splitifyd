import { AUTH_TOKEN_KEY } from './constants.js';
import type {
    CreateGroupRequest,
    CreateExpenseRequest,
    UpdateExpenseRequest,
    TransformedGroup,
    GroupDetail,
    ExpenseData,
    GroupBalances,
    ShareableLinkResponse,
    JoinGroupResponse,
    FirestoreTimestamp
} from './types/api.js';
import type { ExpenseListResponse } from './types/business-logic.js';

class ApiService {

    async getGroups(): Promise<TransformedGroup[]> {
        const response = await apiCall<any>('/groups', {
            method: 'GET'
        });
        return this._transformNewGroupsData(response.groups);
    }

    private _transformNewGroupsData(groups: any[]): TransformedGroup[] {
        return groups.map(group => ({
            id: group.id,
            name: group.name || 'Unnamed Group',
            memberCount: group.memberCount || 0,
             yourBalance: group.balance?.userBalance?.netBalance || 0,
            lastActivity: group.lastActivity || 'Never',
            lastActivityRaw: group.lastActivityRaw || group.updatedAt,
            lastExpense: group.lastExpense || null,
            members: group.members || [],
            expenseCount: group.expenseCount || 0,
            lastExpenseTime: group.lastExpenseTime || null
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
        
        if (isNaN(date.getTime())) {
            return 'Never';
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

        const data = await apiCall<any>('/groups', {
            method: 'POST',
            body: JSON.stringify({
                name: groupData.name.trim(),
                description: groupData.description?.trim() || '',
                memberEmails: groupData.memberEmails || []
            })
        });
        
        return {
            id: data.id,
            name: data.name,
            memberCount: data.members?.length || 1,
            yourBalance: data.balance?.userBalance?.netBalance || 0,
            lastActivity: 'Just now',
            lastActivityRaw: data.createdAt,
            lastExpense: null,
            members: data.members || [],
            expenseCount: 0,
            lastExpenseTime: null
        };
    }


    async getGroup(groupId: string): Promise<{ data: GroupDetail }> {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        const data = await apiCall<any>(`/groups/${groupId}`, {
            method: 'GET'
        });
        return { 
            data: {
                id: data.id,
                name: data.name,
                description: data.description || '',
                members: data.members || [],
                createdBy: data.createdBy,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            }
        };
    }



    async getGroupBalances(groupId: string): Promise<{ data: GroupBalances }> {
        const data = await apiCall<GroupBalances>(`/groups/balances?groupId=${groupId}`, {
            method: 'GET'
        });
        return { data: data };
    }


    async getGroupExpenses(groupId: string, limit: number = 20, cursor: string | null = null): Promise<ExpenseListResponse> {
        const params = new URLSearchParams({
            groupId,
            limit: limit.toString()
        });
        
        if (cursor) {
            params.append('cursor', cursor);
        }

        const response = await apiCall<{ expenses: ExpenseData[], count: number, hasMore: boolean, nextCursor?: string }>(`/expenses/group?${params.toString()}`, {
            method: 'GET'
        });
        
        return {
            expenses: response.expenses,
            hasMore: response.hasMore,
            cursor: response.nextCursor
        };
    }


    async updateGroup(groupId: string, updates: Partial<GroupDetail>): Promise<any> {
        const data = await apiCall(`/groups/${groupId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        return data;
    }

    async deleteGroup(groupId: string): Promise<{ success: boolean }> {
        await apiCall(`/groups/${groupId}`, {
            method: 'DELETE'
        });
        return { success: true };
    }



    async createExpense(expenseData: CreateExpenseRequest): Promise<{ success: boolean; data: ExpenseData }> {
        const data = await apiCall<ExpenseData>('/expenses', {
            method: 'POST',
            body: JSON.stringify(expenseData)
        });
        return { success: true, data: data };
    }

    async getExpense(expenseId: string): Promise<{ data: ExpenseData }> {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        const data = await apiCall<ExpenseData>(`/expenses?id=${expenseId}`, {
            method: 'GET'
        });
        return { data: data };
    }

    async updateExpense(expenseId: string, updateData: UpdateExpenseRequest): Promise<{ success: boolean; data: ExpenseData }> {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        const data = await apiCall<ExpenseData>(`/expenses?id=${expenseId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        return { success: true, data: data };
    }

    async generateShareableLink(groupId: string): Promise<{ success: boolean; data: ShareableLinkResponse }> {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        const data = await apiCall<ShareableLinkResponse>('/groups/share', {
            method: 'POST',
            body: JSON.stringify({ groupId })
        });
        return { success: true, data: data };
    }

    async joinGroupByLink(linkId: string): Promise<{ success: boolean; data: JoinGroupResponse }> {
        if (!linkId) {
            throw new Error('Link ID is required');
        }

        const data = await apiCall<JoinGroupResponse>('/groups/join', {
            method: 'POST',
            body: JSON.stringify({ linkId })
        });
        return { success: true, data: data };
    }

    async getExpenseHistory(expenseId: string): Promise<{ history: any[] }> {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        const data = await apiCall<{ history: any[] }>(`/expenses/history?id=${expenseId}`, {
            method: 'GET'
        });
        return data;
    }

}

export const apiService = new ApiService();

// Generic API call function for expense and group services
export async function apiCall<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Use the new API client instead
    const { apiClient } = await import('./api-client.js');
    try {
        return await apiClient.request<T>(endpoint, options);
    } catch (error) {
        if (error instanceof Error && error.message.includes('401')) {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            window.location.href = 'index.html';
        }
        throw error;
    }
}