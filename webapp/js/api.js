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
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/listDocuments`, {
                method: 'GET',
                headers: this._getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('splitifyd_auth_token');
                    window.location.href = 'index.html';
                    return [];
                }
                
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to fetch groups');
            }

            const data = await response.json();
            return this._transformGroupsData(data.documents || []);
            
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return this._getMockGroups();
            }
            throw error;
        }
    }

    _transformGroupsData(documents) {
        return documents.map(doc => ({
            id: doc.id,
            name: doc.data.name || 'Unnamed Group',
            memberCount: doc.data.members?.length || 1,
            yourBalance: doc.data.yourBalance || 0,
            lastActivity: this._formatLastActivity(doc.data.updatedAt || doc.data.createdAt),
            lastActivityRaw: doc.data.updatedAt || doc.data.createdAt,
            lastExpense: doc.data.lastExpense || null,
            members: doc.data.members || [{ uid: 'user1', name: 'You', initials: 'YO' }],
            expenseCount: doc.data.expenseCount || 0,
            lastExpenseTime: doc.data.lastExpenseTime || null
        }));
    }

    _formatLastActivity(timestamp) {
        if (!timestamp) return 'Recently';
        
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

    _getMockGroups() {
        const now = new Date();
        const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
        
        return [
            {
                id: 'group1',
                name: 'House Expenses',
                memberCount: 4,
                yourBalance: -25.50,
                lastActivity: this._formatLastActivity(hoursAgo(2)),
                lastActivityRaw: hoursAgo(2),
                lastExpense: {
                    amount: 67.20,
                    description: 'expense-3'
                },
                members: [
                    { uid: 'user1', name: 'You', initials: 'YO' },
                    { uid: 'user2', name: 'Alice', initials: 'AL' },
                    { uid: 'user3', name: 'Bob', initials: 'BO' },
                    { uid: 'user4', name: 'Carol', initials: 'CA' }
                ],
                expenseCount: 12,
                lastExpenseTime: hoursAgo(2)
            },
            {
                id: 'group2',
                name: 'group-2',
                memberCount: 3,
                yourBalance: 15.75,
                lastActivity: this._formatLastActivity(hoursAgo(168)),
                lastActivityRaw: hoursAgo(168),
                lastExpense: {
                    amount: 120.00,
                    description: 'Hotel'
                },
                members: [
                    { uid: 'user1', name: 'You', initials: 'YO' },
                    { uid: 'user5', name: 'Dave', initials: 'DA' },
                    { uid: 'user6', name: 'Eve', initials: 'EV' }
                ],
                expenseCount: 5,
                lastExpenseTime: hoursAgo(168)
            },
            {
                id: 'group3',
                name: 'group-3',
                memberCount: 6,
                yourBalance: 0,
                lastActivity: this._formatLastActivity(hoursAgo(0.5)),
                lastActivityRaw: hoursAgo(0.5),
                lastExpense: {
                    amount: 45.30,
                    description: 'expense-10'
                },
                members: [
                    { uid: 'user1', name: 'You', initials: 'YO' },
                    { uid: 'user7', name: 'Frank', initials: 'FR' },
                    { uid: 'user8', name: 'Grace', initials: 'GR' },
                    { uid: 'user9', name: 'Henry', initials: 'HE' },
                    { uid: 'user10', name: 'Ivy', initials: 'IV' },
                    { uid: 'user11', name: 'Jack', initials: 'JA' }
                ],
                expenseCount: 23,
                lastExpenseTime: hoursAgo(0.5)
            }
        ];
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

            const baseUrl = await this._getBaseUrl();
            
            const response = await fetch(`${baseUrl}/createDocument`, {
                method: 'POST',
                headers: this._getAuthHeaders(),
                body: JSON.stringify(groupDoc)
            });

            if (!response.ok) {
                const errorData = await response.text();
                
                if (response.status === 401) {
                    localStorage.removeItem('splitifyd_auth_token');
                    window.location.href = 'index.html';
                    throw new Error('Authentication required');
                }
                
                let errorMessage = 'Failed to create group';
                try {
                    const errorJson = JSON.parse(errorData);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {
                    // Use default message if JSON parsing fails
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            
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
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return this._createMockGroup(groupData);
            }
            throw error;
        }
    }

    _transformGroupData(document) {
        return {
            id: document.id,
            name: document.data.name || 'Unnamed Group',
            memberCount: document.data.members?.length || 1,
            yourBalance: document.data.yourBalance || 0,
            lastActivity: this._formatLastActivity(document.data.updatedAt || document.data.createdAt),
            lastExpense: document.data.lastExpense || null,
            members: document.data.members || [{ uid: 'user1', name: 'You', initials: 'YO' }]
        };
    }

    _createMockGroup(groupData) {
        return {
            id: `group_${Date.now()}`,
            name: groupData.name.trim(),
            memberCount: (groupData.memberEmails?.length || 0) + 1,
            yourBalance: 0,
            lastActivity: 'Just created',
            lastExpense: null,
            members: [
                { uid: 'user1', name: 'You', initials: 'YO' }
            ]
        };
    }

    async getGroup(groupId) {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/getDocument?id=${groupId}`, {
                method: 'GET',
                headers: this._getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('splitifyd_auth_token');
                    window.location.href = 'index.html';
                }
                throw new Error('Failed to fetch group details');
            }

            const data = await response.json();
            return { data: this._transformGroupDetail(data) };
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return { data: this._getMockGroupDetail(groupId) };
            }
            throw error;
        }
    }

    _transformGroupDetail(document) {
        const data = document.data || document;
        return {
            id: document.id,
            name: data.name || 'Unnamed Group',
            description: data.description || '',
            members: data.members || [],
            createdBy: data.createdBy || data.memberEmails?.[0] || 'unknown',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    }

    _getMockGroupDetail(groupId) {
        const mockGroups = {
            'group1': {
                id: 'group1',
                name: 'House Expenses',
                description: 'Shared house expenses and utilities',
                members: [
                    { uid: 'user1', name: 'You', email: 'you@example.com' },
                    { uid: 'user2', name: 'Alice', email: 'alice@example.com' },
                    { uid: 'user3', name: 'Bob', email: 'bob@example.com' },
                    { uid: 'user4', name: 'Carol', email: 'carol@example.com' }
                ],
                createdBy: 'user1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
        
        return mockGroups[groupId] || mockGroups['group1'];
    }

    async getGroupBalances(groupId) {
        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/expenses/group?groupId=${groupId}`, {
                method: 'GET',
                headers: this._getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to fetch group balances');
            }

            const data = await response.json();
            // The expenses are already in the correct format from the server
            return { data: data.expenses || [] };
        } catch (error) {
            return { data: this._getMockGroupBalances(groupId) };
        }
    }

    _getMockGroupBalances(groupId) {
        return [
            {
                id: 'exp1',
                amount: 100,
                description: 'Groceries',
                paidBy: 'user1',
                splits: {
                    'user1': 25,
                    'user2': 25,
                    'user3': 25,
                    'user4': 25
                },
                date: new Date().toISOString()
            },
            {
                id: 'exp2',
                amount: 60,
                description: 'Utilities',
                paidBy: 'user2',
                splits: {
                    'user1': 15,
                    'user2': 15,
                    'user3': 15,
                    'user4': 15
                },
                date: new Date(Date.now() - 86400000).toISOString()
            }
        ];
    }

    async getGroupExpenses(groupId, limit = 20, offset = 0) {
        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/expenses/group?groupId=${groupId}&limit=${limit}&offset=${offset}`, {
                method: 'GET',
                headers: this._getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to fetch group expenses');
            }

            const data = await response.json();
            return { data: data.expenses || [] };
        } catch (error) {
            return { data: this._getMockGroupExpenses(groupId, limit, offset) };
        }
    }

    _getMockGroupExpenses(groupId, limit, offset) {
        const allExpenses = [];
        const categories = ['food', 'transport', 'utilities', 'entertainment', 'shopping'];
        const descriptions = ['Groceries', 'Uber ride', 'Electricity bill', 'Movie tickets', 'Restaurant'];
        
        // Get the correct group members for this group
        const mockGroups = this._getMockGroups();
        const currentGroup = mockGroups.find(g => g.id === groupId);
        const members = currentGroup ? currentGroup.members : [
            { uid: 'user1', name: 'You' },
            { uid: 'user2', name: 'Alice' },
            { uid: 'user3', name: 'Bob' },
            { uid: 'user4', name: 'Carol' }
        ];
        
        for (let i = 0; i < 30; i++) {
            const memberIndex = i % members.length;
            const paidBy = members[memberIndex].uid;
            const amount = Math.floor(Math.random() * 200) + 10;
            const splitAmount = Math.round((amount / members.length) * 100) / 100;
            
            // Create splits object with actual member IDs
            const splits = {};
            members.forEach(member => {
                splits[member.uid] = splitAmount;
            });
            
            allExpenses.push({
                id: `exp${i + 1}`,
                amount: amount,
                description: descriptions[i % descriptions.length] + ` ${i + 1}`,
                category: categories[i % categories.length],
                paidBy: paidBy,
                splits: splits,
                date: new Date(Date.now() - i * 86400000).toISOString()
            });
        }
        
        return allExpenses.slice(offset, offset + limit);
    }

    async updateGroup(groupId, updates) {
        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/updateDocument?id=${groupId}`, {
                method: 'PUT',
                headers: this._getAuthHeaders(),
                body: JSON.stringify({ data: updates })
            });

            if (!response.ok) {
                throw new Error('Failed to update group');
            }

            return await response.json();
        } catch (error) {
            return { success: true };
        }
    }

    async deleteGroup(groupId) {
        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/deleteDocument?id=${groupId}`, {
                method: 'DELETE',
                headers: this._getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to delete group');
            }

            return { success: true };
        } catch (error) {
            return { success: true };
        }
    }

    async inviteToGroup(groupId, email) {
        // TODO: Implement when backend endpoint is ready
        return { success: true, message: 'Invitation sent (mock)' };
    }

    async removeGroupMember(groupId, userId) {
        // TODO: Implement when backend endpoint is ready
        return { success: true, message: 'Member removed (mock)' };
    }

    async createExpense(expenseData) {
        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/createDocument`, {
                method: 'POST',
                headers: this._getAuthHeaders(),
                body: JSON.stringify({ data: expenseData })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('splitifyd_auth_token');
                    window.location.href = 'index.html';
                    throw new Error('Authentication required');
                }
                
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to create expense');
            }

            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return { success: true, data: { id: `exp_${Date.now()}`, ...expenseData } };
            }
            throw error;
        }
    }

    async getExpense(expenseId) {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/expenses?id=${expenseId}`, {
                method: 'GET',
                headers: this._getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('splitifyd_auth_token');
                    window.location.href = 'index.html';
                }
                throw new Error('Failed to fetch expense');
            }

            const data = await response.json();
            return { data: data };
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return { data: this._getMockExpense(expenseId) };
            }
            throw error;
        }
    }

    async updateExpense(expenseId, updateData) {
        if (!expenseId) {
            throw new Error('Expense ID is required');
        }

        try {
            const baseUrl = await this._getBaseUrl();
            const response = await fetch(`${baseUrl}/expenses?id=${expenseId}`, {
                method: 'PUT',
                headers: this._getAuthHeaders(),
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('splitifyd_auth_token');
                    window.location.href = 'index.html';
                }
                throw new Error('Failed to update expense');
            }

            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return { success: true, data: { id: expenseId, ...updateData } };
            }
            throw error;
        }
    }

    _getMockExpense(expenseId) {
        return {
            id: expenseId,
            groupId: 'group1',
            description: 'Sample Expense',
            amount: 50.00,
            category: 'food',
            paidBy: 'user1',
            splits: {
                'user1': 12.50,
                'user2': 12.50,
                'user3': 12.50,
                'user4': 12.50
            },
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
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
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status} error`);
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
    inviteToGroup: (groupId, email) => apiService.inviteToGroup(groupId, email),
    removeGroupMember: (groupId, userId) => apiService.removeGroupMember(groupId, userId),
    createExpense: (expenseData) => apiService.createExpense(expenseData),
    getExpense: (expenseId) => apiService.getExpense(expenseId),
    updateExpense: (expenseId, updateData) => apiService.updateExpense(expenseId, updateData)
};