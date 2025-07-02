class ApiService {
    constructor() {
        this._baseUrl = this._getBaseUrl();
    }

    _getBaseUrl() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:5001/splitifyd/us-central1/api`;
        }
        return 'https://api-po437q3l5q-uc.a.run.app';
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
            const response = await fetch(`${this._baseUrl}/listDocuments?collection=groups`, {
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
            lastExpense: doc.data.lastExpense || null,
            members: doc.data.members || [{ id: 'user1', name: 'You', initials: 'YO' }]
        }));
    }

    _formatLastActivity(timestamp) {
        if (!timestamp) return 'Recently';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }

    _getMockGroups() {
        return [
            {
                id: 'group1',
                name: 'House Expenses',
                memberCount: 4,
                yourBalance: -25.50,
                lastActivity: '2 days ago',
                lastExpense: {
                    amount: 67.20,
                    description: 'Groceries'
                },
                members: [
                    { id: 'user1', name: 'You', initials: 'YO' },
                    { id: 'user2', name: 'Alice', initials: 'AL' },
                    { id: 'user3', name: 'Bob', initials: 'BO' },
                    { id: 'user4', name: 'Carol', initials: 'CA' }
                ]
            },
            {
                id: 'group2',
                name: 'Weekend Trip',
                memberCount: 3,
                yourBalance: 15.75,
                lastActivity: '1 week ago',
                lastExpense: {
                    amount: 120.00,
                    description: 'Hotel'
                },
                members: [
                    { id: 'user1', name: 'You', initials: 'YO' },
                    { id: 'user5', name: 'Dave', initials: 'DA' },
                    { id: 'user6', name: 'Eve', initials: 'EV' }
                ]
            },
            {
                id: 'group3',
                name: 'Office Lunch',
                memberCount: 6,
                yourBalance: 0,
                lastActivity: '3 days ago',
                lastExpense: {
                    amount: 45.30,
                    description: 'Pizza delivery'
                },
                members: [
                    { id: 'user1', name: 'You', initials: 'YO' },
                    { id: 'user7', name: 'Frank', initials: 'FR' },
                    { id: 'user8', name: 'Grace', initials: 'GR' },
                    { id: 'user9', name: 'Henry', initials: 'HE' },
                    { id: 'user10', name: 'Ivy', initials: 'IV' },
                    { id: 'user11', name: 'Jack', initials: 'JA' }
                ]
            }
        ];
    }

    async createGroup(groupData) {
        if (!groupData.name?.trim()) {
            throw new Error('Group name is required');
        }

        try {
            const groupDoc = {
                collection: 'groups',
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

            const response = await fetch(`${this._baseUrl}/createDocument`, {
                method: 'POST',
                headers: this._getAuthHeaders(),
                body: JSON.stringify(groupDoc)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('splitifyd_auth_token');
                    window.location.href = 'index.html';
                    throw new Error('Authentication required');
                }
                
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to create group');
            }

            const data = await response.json();
            return this._transformGroupData(data.document);
            
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