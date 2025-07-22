import { AUTH_TOKEN_KEY } from './constants.js';
import type {
    CreateGroupRequest,
    CreateExpenseRequest,
    UpdateExpenseRequest,
    Group,
    GroupSummary,
    GroupListResponse,
    GroupDetail,
    ExpenseData,
    GroupBalances,
    ShareableLinkResponse,
    JoinGroupResponse,
    FirestoreTimestamp
} from './types/api.js';
import type { ExpenseListResponse } from './types/business-logic.js';

class ApiService {

    async getGroups(): Promise<GroupSummary[]> {
        const response = await apiCall<GroupListResponse>('/groups', {
            method: 'GET'
        });
        return response.groups;
    }




    async createGroup(groupData: CreateGroupRequest): Promise<Group> {
        if (!groupData.name?.trim()) {
            throw new Error('Group name is required');
        }

        const data = await apiCall<Group>('/groups', {
            method: 'POST',
            body: JSON.stringify({
                name: groupData.name.trim(),
                description: groupData.description?.trim() || '',
                memberEmails: groupData.memberEmails || []
            })
        });
        
        return data;
    }


    async getGroup(groupId: string): Promise<{ data: GroupDetail }> {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        const data = await apiCall<GroupDetail>(`/groups/${groupId}`, {
            method: 'GET'
        });
        return { data };
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