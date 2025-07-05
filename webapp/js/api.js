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
            const response = await fetch(`${baseUrl}/listDocuments?collection=groups`, {
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
            members: doc.data.members || [{ id: 'user1', name: 'You', initials: 'YO' }],
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
                    { id: 'user1', name: 'You', initials: 'YO' },
                    { id: 'user2', name: 'Alice', initials: 'AL' },
                    { id: 'user3', name: 'Bob', initials: 'BO' },
                    { id: 'user4', name: 'Carol', initials: 'CA' }
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
                    { id: 'user1', name: 'You', initials: 'YO' },
                    { id: 'user5', name: 'Dave', initials: 'DA' },
                    { id: 'user6', name: 'Eve', initials: 'EV' }
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
                    { id: 'user1', name: 'You', initials: 'YO' },
                    { id: 'user7', name: 'Frank', initials: 'FR' },
                    { id: 'user8', name: 'Grace', initials: 'GR' },
                    { id: 'user9', name: 'Henry', initials: 'HE' },
                    { id: 'user10', name: 'Ivy', initials: 'IV' },
                    { id: 'user11', name: 'Jack', initials: 'JA' }
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
                    members: [{ id: 'current_user', name: 'You', initials: 'YO' }],
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
                members: [{ id: 'current_user', name: 'You', initials: 'YO' }]
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
            members: document.data.members || [{ id: 'user1', name: 'You', initials: 'YO' }]
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
                { id: 'user1', name: 'You', initials: 'YO' }
            ]
        };
    }

    async getGroup(groupId) {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error('Group detail API not implemented yet'));
            }, 300);
        });
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