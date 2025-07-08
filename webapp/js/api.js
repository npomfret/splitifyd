class ApiService {
    constructor() {
        this._baseUrlPromise = null;
    }

    async _getBaseUrl() {
        if (!this._baseUrlPromise) {
            this._baseUrlPromise = config.getApiUrl();
        }
        return this._baseUrlPromise;
    }

    _getAuthToken() {
        return localStorage.getItem('splitifyd_auth_token');
    }

    _getAuthHeaders() {
        const token = this._getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async getGroups() {
        try {
            const data = await apiCall('/listDocuments', {
                method: 'GET'
            });
            return this._transformGroupsData(data.documents);
            
        } catch (error) {
            throw error;
        }
    }

    _transformGroupsData(documents) {
        return documents.map(doc => ({
            id: doc.id,
            name: doc.data.name,
            memberCount: doc.data.members.length,
            yourBalance: doc.data.yourBalance,
            lastActivity: this._formatLastActivity(doc.data.updatedAt),
            lastActivityRaw: doc.data.updatedAt,
            lastExpense: doc.data.lastExpense,
            members: doc.data.members,
            expenseCount: doc.data.expenseCount,
            lastExpenseTime: doc.data.lastExpenseTime
        }));
    }

    _formatLastActivity(timestamp) {
        
        let date;
        if (timestamp._seconds) {
            // Handle Firestore Timestamp format
            date = new Date(timestamp._seconds * 1000);
        } else {
            // Handle ISO string or regular timestamp
            date = new Date(timestamp);
        }
        
        const now = new Date();
        const diffMs = now - date;
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


    async createGroup(groupData) {
        if (!groupData.name?.trim()) {
            throw new Error('Group name is required');
        }

        try {
            const groupDoc = {
                data: {
                    name: groupData.name.trim(),
                    description: groupData.description?.trim() || '',
                    memberEmails: groupData.memberEmails || [],
                    members: [{ uid: 'current_user', name: 'You', initials: 'YO' }],
                    yourBalance: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };

            const data = await apiCall('/createDocument', {
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
                members: [{ uid: 'current_user', name: 'You', initials: 'YO' }]
            };
            
        } catch (error) {
            throw error;
        }
    }

    _transformGroupData(document) {
        return {
            id: document.id,
            name: document.data.name,
            memberCount: document.data.members.length,
            yourBalance: document.data.yourBalance,
            lastActivity: this._formatLastActivity(document.data.updatedAt),
            lastExpense: document.data.lastExpense,
            members: document.data.members
        };
    }


    async getGroup(groupId) {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        try {
            const data = await apiCall(`/getDocument?id=${groupId}`, {
                method: 'GET'
            });
            return { data: this._transformGroupDetail(data) };
        } catch (error) {
            throw error;
        }
    }

    _transformGroupDetail(document) {
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


    async getGroupBalances(groupId) {
        try {
            const data = await apiCall(`/groups/balances?groupId=${groupId}`, {
                method: 'GET'
            });
            return { data: data };
        } catch (error) {
            throw error;
        }
    }


    async getGroupExpenses(groupId, limit = 20, offset = 0) {
        try {
            const data = await apiCall(`/expenses/group?groupId=${groupId}&limit=${limit}&offset=${offset}`, {
                method: 'GET'
            });
            return { data: data.expenses };
        } catch (error) {
            throw error;
        }
    }


    async updateGroup(groupId, updates) {
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

    async deleteGroup(groupId) {
        try {
            await apiCall(`/deleteDocument?id=${groupId}`, {
                method: 'DELETE'
            });
            return { success: true };
        } catch (error) {
            throw error;
        }
    }



    async createExpense(expenseData) {
        try {
            const data = await apiCall('/expenses', {
                method: 'POST',
                body: JSON.stringify(expenseData)
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

    async getExpense(expenseId) {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        try {
            const data = await apiCall(`/expenses?id=${expenseId}`, {
                method: 'GET'
            });
            return { data: data };
        } catch (error) {
            throw error;
        }
    }

    async updateExpense(expenseId, updateData) {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        try {
            const data = await apiCall(`/expenses?id=${expenseId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

    async generateShareableLink(groupId) {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        try {
            const data = await apiCall('/groups/share', {
                method: 'POST',
                body: JSON.stringify({ groupId })
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

    async joinGroupByLink(linkId) {
        if (!linkId) {
            throw new Error('Link ID is required');
        }

        try {
            const data = await apiCall('/groups/join', {
                method: 'POST',
                body: JSON.stringify({ linkId })
            });
            return { success: true, data: data };
        } catch (error) {
            throw error;
        }
    }

}

const apiService = new ApiService();

// Generic API call function for expense and group services
async function apiCall(endpoint, options = {}) {
    const baseUrl = await apiService._getBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    // Add auth headers if we have a token
    const token = apiService._getAuthToken();
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

// Global API object
window.api = {
    getGroups: () => apiService.getGroups(),
    createGroup: (groupData) => apiService.createGroup(groupData),
    getGroup: (groupId) => apiService.getGroup(groupId),
    getGroupBalances: (groupId) => apiService.getGroupBalances(groupId),
    getGroupExpenses: (groupId, limit, offset) => apiService.getGroupExpenses(groupId, limit, offset),
    updateGroup: (groupId, updates) => apiService.updateGroup(groupId, updates),
    deleteGroup: (groupId) => apiService.deleteGroup(groupId),
    createExpense: (expenseData) => apiService.createExpense(expenseData),
    getExpense: (expenseId) => apiService.getExpense(expenseId),
    updateExpense: (expenseId, updateData) => apiService.updateExpense(expenseId, updateData),
    generateShareableLink: (groupId) => apiService.generateShareableLink(groupId),
    joinGroupByLink: (linkId) => apiService.joinGroupByLink(linkId)
};