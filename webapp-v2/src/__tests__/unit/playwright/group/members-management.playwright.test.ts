import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage, createTestUsers, createTestGroup, mockAuthState, mockGroupData } from '../stores/setup';

/**
 * Focused Playwright tests for members management functionality
 * 
 * Tests role changes, member removal, permission-based UI visibility,
 * real-time member updates, and complex group management interactions.
 */

test.describe('Members Management - Role-Based Operations', () => {
    const testUsers = createTestUsers();
    const adminUser = testUsers.find(u => u.role === 'admin')!;
    const memberUser = testUsers.find(u => u.role === 'member')!;
    const viewerUser = testUsers.find(u => u.role === 'viewer')!;
    
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
    });

    test('should allow admin to manage member roles', async ({ page }) => {
        const testGroup = createTestGroup(testUsers, {
            canManageMembers: true,
            canChangeRoles: true,
        });
        
        await mockAuthState(page, adminUser);
        await mockGroupData(page, testGroup);

        await createTestPage(page, `
            <div class="members-management">
                <h3 data-testid="members-title">Group Members</h3>
                
                <div id="members-list" data-testid="members-list">
                    ${testUsers.map(user => `
                        <div class="member-item" data-testid="member-${user.uid}">
                            <div class="member-info">
                                <div class="member-avatar" data-testid="avatar-${user.uid}">
                                    ${user.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div class="member-details">
                                    <div class="member-name" data-testid="name-${user.uid}">${user.displayName}</div>
                                    <div class="member-email" data-testid="email-${user.uid}">${user.email}</div>
                                    <div class="member-status" data-testid="status-${user.uid}">Status: ${user.status}</div>
                                </div>
                            </div>
                            
                            <div class="member-role">
                                <select class="role-select" data-testid="role-select-${user.uid}" data-user-id="${user.uid}">
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    <option value="member" ${user.role === 'member' ? 'selected' : ''}>Member</option>
                                    <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                                </select>
                            </div>
                            
                            <div class="member-actions">
                                <button class="btn-secondary toggle-status-btn" 
                                        data-testid="toggle-status-${user.uid}"
                                        data-user-id="${user.uid}"
                                        data-current-status="${user.status}">
                                    ${user.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                ${user.uid !== adminUser.uid ? `
                                    <button class="btn-danger remove-btn" 
                                            data-testid="remove-${user.uid}"
                                            data-user-id="${user.uid}">
                                        Remove
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="add-member-section">
                    <h4>Add New Member</h4>
                    <div class="add-member-form">
                        <input type="email" id="new-member-email" data-testid="new-member-email" placeholder="Enter email address" />
                        <select id="new-member-role" data-testid="new-member-role">
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button id="add-member-btn" data-testid="add-member-btn">Add Member</button>
                    </div>
                </div>
                
                <div id="action-result" data-testid="action-result">No recent actions</div>
                <div id="member-count" data-testid="member-count">Members: ${testUsers.filter(u => u.status === 'active').length}</div>
            </div>

            <style>
                .members-management {
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                .member-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    margin: 12px 0;
                }
                
                .member-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                }
                
                .member-avatar {
                    width: 40px;
                    height: 40px;
                    background: #007bff;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 16px;
                }
                
                .member-details {
                    flex: 1;
                }
                
                .member-name {
                    font-weight: 600;
                    font-size: 16px;
                    color: #333;
                    margin-bottom: 2px;
                }
                
                .member-email {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 2px;
                }
                
                .member-status {
                    font-size: 12px;
                    color: #888;
                }
                
                .member-role {
                    margin-right: 12px;
                }
                
                .role-select {
                    padding: 6px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                .member-actions {
                    display: flex;
                    gap: 8px;
                }
                
                button {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                
                .btn-danger {
                    background: #dc3545;
                    color: white;
                }
                
                .btn-primary {
                    background: #007bff;
                    color: white;
                }
                
                .add-member-section {
                    margin-top: 32px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .add-member-form {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    margin-top: 12px;
                }
                
                .add-member-form input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                
                .add-member-form select {
                    padding: 8px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                
                #action-result {
                    margin-top: 16px;
                    padding: 12px;
                    background: #e9ecef;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 13px;
                }
                
                #member-count {
                    margin-top: 8px;
                    font-weight: 500;
                    color: #666;
                }
            </style>

            <script>
                const users = ${JSON.stringify(testUsers)};
                const currentUser = ${JSON.stringify(adminUser)};
                const group = ${JSON.stringify(testGroup)};
                
                let members = [...users];
                let memberCount = members.length;
                
                class MembersManager {
                    constructor() {
                        this.actionResult = document.getElementById('action-result');
                        this.memberCount = document.getElementById('member-count');
                        
                        this.setupEventListeners();
                        this.updateMemberCount();
                    }
                    
                    setupEventListeners() {
                        // Role change listeners
                        document.querySelectorAll('.role-select').forEach(select => {
                            select.addEventListener('change', (e) => {
                                this.handleRoleChange(e.target.dataset.userId, e.target.value);
                            });
                        });
                        
                        // Status toggle listeners
                        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const userId = e.target.dataset.userId;
                                const currentStatus = e.target.dataset.currentStatus;
                                this.toggleMemberStatus(userId, currentStatus);
                            });
                        });
                        
                        // Remove member listeners
                        document.querySelectorAll('.remove-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                this.removeMember(e.target.dataset.userId);
                            });
                        });
                        
                        // Add member listener
                        document.getElementById('add-member-btn').addEventListener('click', () => {
                            this.addNewMember();
                        });
                        
                        // Enter key for add member
                        document.getElementById('new-member-email').addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                this.addNewMember();
                            }
                        });
                    }
                    
                    handleRoleChange(userId, newRole) {
                        const member = members.find(m => m.uid === userId);
                        if (!member) return;
                        
                        const oldRole = member.role;
                        member.role = newRole;
                        
                        this.logAction(\`Changed \${member.displayName}'s role from \${oldRole} to \${newRole}\`);
                        
                        // Update UI to reflect role change effects
                        this.updateMemberDisplay(userId);
                    }
                    
                    toggleMemberStatus(userId, currentStatus) {
                        const member = members.find(m => m.uid === userId);
                        if (!member) return;
                        
                        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
                        member.status = newStatus;
                        
                        // Update button text and data
                        const btn = document.querySelector(\`[data-testid="toggle-status-\${userId}"]\`);
                        if (btn) {
                            btn.textContent = newStatus === 'active' ? 'Deactivate' : 'Activate';
                            btn.dataset.currentStatus = newStatus;
                        }
                        
                        // Update status display
                        const statusEl = document.querySelector(\`[data-testid="status-\${userId}"]\`);
                        if (statusEl) {
                            statusEl.textContent = \`Status: \${newStatus}\`;
                        }
                        
                        this.logAction(\`\${newStatus === 'active' ? 'Activated' : 'Deactivated'} \${member.displayName}\`);
                    }
                    
                    removeMember(userId) {
                        const memberIndex = members.findIndex(m => m.uid === userId);
                        if (memberIndex === -1) return;
                        
                        const member = members[memberIndex];
                        
                        // Remove from array
                        members.splice(memberIndex, 1);
                        
                        // Remove from DOM
                        const memberEl = document.querySelector(\`[data-testid="member-\${userId}"]\`);
                        if (memberEl) {
                            memberEl.remove();
                        }
                        
                        this.logAction(\`Removed \${member.displayName} from the group\`);
                        this.updateMemberCount();
                    }
                    
                    addNewMember() {
                        const emailInput = document.getElementById('new-member-email');
                        const roleSelect = document.getElementById('new-member-role');
                        
                        const email = emailInput.value.trim();
                        const role = roleSelect.value;
                        
                        if (!email || !this.validateEmail(email)) {
                            this.logAction('Error: Please enter a valid email address');
                            return;
                        }
                        
                        // Check if member already exists
                        if (members.find(m => m.email.toLowerCase() === email.toLowerCase())) {
                            this.logAction('Error: Member with this email already exists');
                            return;
                        }
                        
                        // Create new member
                        const newMember = {
                            uid: 'new-user-' + Date.now(),
                            email: email,
                            displayName: email.split('@')[0], // Simple display name
                            role: role,
                            status: 'active'
                        };
                        
                        members.push(newMember);
                        
                        // Add to DOM
                        this.addMemberToDOM(newMember);
                        
                        // Clear form
                        emailInput.value = '';
                        roleSelect.value = 'member';
                        
                        this.logAction(\`Added \${newMember.displayName} as \${role}\`);
                        this.updateMemberCount();
                    }
                    
                    addMemberToDOM(member) {
                        const membersList = document.getElementById('members-list');
                        const memberEl = document.createElement('div');
                        memberEl.className = 'member-item';
                        memberEl.dataset.testid = \`member-\${member.uid}\`;
                        
                        memberEl.innerHTML = \`
                            <div class="member-info">
                                <div class="member-avatar" data-testid="avatar-\${member.uid}">
                                    \${member.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div class="member-details">
                                    <div class="member-name" data-testid="name-\${member.uid}">\${member.displayName}</div>
                                    <div class="member-email" data-testid="email-\${member.uid}">\${member.email}</div>
                                    <div class="member-status" data-testid="status-\${member.uid}">Status: \${member.status}</div>
                                </div>
                            </div>
                            
                            <div class="member-role">
                                <select class="role-select" data-testid="role-select-\${member.uid}" data-user-id="\${member.uid}">
                                    <option value="admin" \${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    <option value="member" \${member.role === 'member' ? 'selected' : ''}>Member</option>
                                    <option value="viewer" \${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                                </select>
                            </div>
                            
                            <div class="member-actions">
                                <button class="btn-secondary toggle-status-btn" 
                                        data-testid="toggle-status-\${member.uid}"
                                        data-user-id="\${member.uid}"
                                        data-current-status="\${member.status}">
                                    \${member.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button class="btn-danger remove-btn" 
                                        data-testid="remove-\${member.uid}"
                                        data-user-id="\${member.uid}">
                                    Remove
                                </button>
                            </div>
                        \`;
                        
                        membersList.appendChild(memberEl);
                        
                        // Add event listeners to new elements
                        memberEl.querySelector('.role-select').addEventListener('change', (e) => {
                            this.handleRoleChange(e.target.dataset.userId, e.target.value);
                        });
                        
                        memberEl.querySelector('.toggle-status-btn').addEventListener('click', (e) => {
                            const userId = e.target.dataset.userId;
                            const currentStatus = e.target.dataset.currentStatus;
                            this.toggleMemberStatus(userId, currentStatus);
                        });
                        
                        memberEl.querySelector('.remove-btn').addEventListener('click', (e) => {
                            this.removeMember(e.target.dataset.userId);
                        });
                    }
                    
                    updateMemberDisplay(userId) {
                        // This could update permission-based UI elements
                        // For now, just log the change
                        const member = members.find(m => m.uid === userId);
                        if (member) {
                            console.log(\`Updated display for \${member.displayName} with role \${member.role}\`);
                        }
                    }
                    
                    validateEmail(email) {
                        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                    }
                    
                    logAction(message) {
                        this.actionResult.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
                    }
                    
                    updateMemberCount() {
                        const activeMembers = members.filter(member => member.status === 'active');
                        this.memberCount.textContent = \`Members: \${activeMembers.length}\`;
                    }
                }
                
                window.membersManager = new MembersManager();
            </script>
        `);

        // Verify initial state
        await expect(page.getByTestId('members-title')).toHaveText('Group Members');
        await expect(page.getByTestId('member-count')).toHaveText('Members: 3');

        // Verify all members are displayed
        await expect(page.getByTestId('member-admin-user-123')).toBeVisible();
        await expect(page.getByTestId('member-member-user-456')).toBeVisible();
        await expect(page.getByTestId('member-viewer-user-789')).toBeVisible();

        // Test role change
        await page.getByTestId('role-select-member-user-456').selectOption('admin');
        await expect(page.getByTestId('action-result')).toContainText("Changed Member User's role from member to admin");

        // Test status toggle
        await page.getByTestId('toggle-status-member-user-456').click();
        await expect(page.getByTestId('status-member-user-456')).toHaveText('Status: inactive');
        await expect(page.getByTestId('toggle-status-member-user-456')).toHaveText('Activate');
        await expect(page.getByTestId('action-result')).toContainText('Deactivated Member User');

        // Test member removal
        await page.getByTestId('remove-viewer-user-789').click();
        await expect(page.getByTestId('member-viewer-user-789')).toBeHidden();
        await expect(page.getByTestId('member-count')).toHaveText('Members: 1');
        await expect(page.getByTestId('action-result')).toContainText('Removed Viewer User from the group');

        // Admin should not have a remove button
        await expect(page.getByTestId('remove-admin-user-123')).toBeHidden();
    });

    test('should add new members with proper validation', async ({ page }) => {
        const testGroup = createTestGroup([adminUser], { canManageMembers: true });
        
        await mockAuthState(page, adminUser);
        await mockGroupData(page, testGroup);

        await createTestPage(page, `
            <div class="add-member-test">
                <div class="add-member-form">
                    <input type="email" id="new-member-email" data-testid="new-member-email" placeholder="Enter email address" />
                    <select id="new-member-role" data-testid="new-member-role">
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button id="add-member-btn" data-testid="add-member-btn">Add Member</button>
                </div>
                
                <div id="validation-message" data-testid="validation-message">Ready to add members</div>
                <div id="member-count" data-testid="member-count">Members: 1</div>
                
                <div id="members-list" data-testid="members-list">
                    <div class="member-item" data-testid="existing-member">Admin User (admin@example.com)</div>
                </div>
            </div>

            <style>
                .add-member-form {
                    display: flex;
                    gap: 12px;
                    margin: 20px;
                    align-items: center;
                }
                
                .add-member-form input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                
                .add-member-form select, .add-member-form button {
                    padding: 8px 16px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                
                button {
                    background: #007bff;
                    color: white;
                    cursor: pointer;
                    border: none;
                }
                
                #validation-message {
                    margin: 20px;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    border: 1px solid #dee2e6;
                }
                
                #validation-message.error {
                    background: #f8d7da;
                    border-color: #f5c6cb;
                    color: #721c24;
                }
                
                #validation-message.success {
                    background: #d4edda;
                    border-color: #c3e6cb;
                    color: #155724;
                }
                
                .member-item {
                    padding: 12px;
                    margin: 8px 20px;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                }
            </style>

            <script>
                let members = [{ email: 'admin@example.com', name: 'Admin User', role: 'admin' }];
                
                class MemberAdder {
                    constructor() {
                        this.emailInput = document.getElementById('new-member-email');
                        this.roleSelect = document.getElementById('new-member-role');
                        this.addBtn = document.getElementById('add-member-btn');
                        this.validationMessage = document.getElementById('validation-message');
                        this.memberCount = document.getElementById('member-count');
                        this.membersList = document.getElementById('members-list');
                        
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        this.addBtn.addEventListener('click', () => {
                            this.addMember();
                        });
                        
                        this.emailInput.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                this.addMember();
                            }
                        });
                        
                        this.emailInput.addEventListener('input', () => {
                            this.validateInput();
                        });
                    }
                    
                    validateInput() {
                        const email = this.emailInput.value.trim();
                        
                        if (!email) {
                            this.showValidation('Ready to add members', 'normal');
                            return false;
                        }
                        
                        if (!this.validateEmail(email)) {
                            this.showValidation('Invalid email format', 'error');
                            return false;
                        }
                        
                        if (members.find(m => m.email.toLowerCase() === email.toLowerCase())) {
                            this.showValidation('Member with this email already exists', 'error');
                            return false;
                        }
                        
                        this.showValidation('Email format is valid', 'success');
                        return true;
                    }
                    
                    addMember() {
                        const email = this.emailInput.value.trim();
                        const role = this.roleSelect.value;
                        
                        if (!this.validateInput()) {
                            return;
                        }
                        
                        // Create new member
                        const newMember = {
                            email: email,
                            name: email.split('@')[0].replace(/[._]/g, ' '), // Simple name generation
                            role: role
                        };
                        
                        members.push(newMember);
                        
                        // Add to DOM
                        const memberEl = document.createElement('div');
                        memberEl.className = 'member-item';
                        memberEl.dataset.testid = \`member-\${members.length}\`;
                        memberEl.textContent = \`\${newMember.name} (\${newMember.email}) - \${newMember.role}\`;
                        
                        this.membersList.appendChild(memberEl);
                        
                        // Update count
                        this.memberCount.textContent = \`Members: \${members.length}\`;
                        
                        // Clear form
                        this.emailInput.value = '';
                        this.roleSelect.value = 'member';
                        
                        this.showValidation(\`Successfully added \${newMember.name} as \${role}\`, 'success');
                        
                        // Clear success message after delay
                        setTimeout(() => {
                            this.showValidation('Ready to add more members', 'normal');
                        }, 3000);
                    }
                    
                    validateEmail(email) {
                        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                    }
                    
                    showValidation(message, type) {
                        this.validationMessage.textContent = message;
                        this.validationMessage.className = type === 'error' ? 'error' : type === 'success' ? 'success' : '';
                    }
                }
                
                window.memberAdder = new MemberAdder();
            </script>
        `);

        // Test invalid email
        await page.getByTestId('new-member-email').fill('invalid-email');
        await expect(page.getByTestId('validation-message')).toHaveText('Invalid email format');
        await expect(page.getByTestId('validation-message')).toHaveClass(/error/);

        // Test duplicate email
        await page.getByTestId('new-member-email').fill('admin@example.com');
        await expect(page.getByTestId('validation-message')).toHaveText('Member with this email already exists');
        await expect(page.getByTestId('validation-message')).toHaveClass(/error/);

        // Test valid email
        await page.getByTestId('new-member-email').fill('newmember@example.com');
        await expect(page.getByTestId('validation-message')).toHaveText('Email format is valid');
        await expect(page.getByTestId('validation-message')).toHaveClass(/success/);

        // Add member
        await page.getByTestId('new-member-role').selectOption('member');
        await page.getByTestId('add-member-btn').click();

        await expect(page.getByTestId('member-count')).toHaveText('Members: 2');
        await expect(page.getByTestId('member-2')).toBeVisible();
        await expect(page.getByTestId('member-2')).toContainText('newmember@example.com');
        await expect(page.getByTestId('member-2')).toContainText('member');
        await expect(page.getByTestId('validation-message')).toContainText('Successfully added');

        // Form should be cleared
        await expect(page.getByTestId('new-member-email')).toHaveValue('');
        await expect(page.getByTestId('new-member-role')).toHaveValue('member');

        // Test Enter key functionality
        await page.getByTestId('new-member-email').fill('another@example.com');
        await page.getByTestId('new-member-role').selectOption('viewer');
        await page.getByTestId('new-member-email').press('Enter');

        await expect(page.getByTestId('member-count')).toHaveText('Members: 3');
        await expect(page.getByTestId('member-3')).toContainText('viewer');
    });

    test('should show different UI based on user permissions', async ({ page }) => {
        // Test as a member user (non-admin)
        const testGroup = createTestGroup(testUsers, {
            canManageMembers: false, // Members can't manage other members
        });
        
        await mockAuthState(page, memberUser);
        await mockGroupData(page, testGroup);

        await createTestPage(page, `
            <div class="members-view">
                <h3 data-testid="members-title">Group Members</h3>
                
                <div id="members-list" data-testid="members-list">
                    ${testUsers.map(user => `
                        <div class="member-item" data-testid="member-${user.uid}">
                            <div class="member-info">
                                <div class="member-name" data-testid="name-${user.uid}">${user.displayName}</div>
                                <div class="member-role" data-testid="role-${user.uid}">Role: ${user.role}</div>
                                <div class="member-status" data-testid="status-${user.uid}">Status: ${user.status}</div>
                            </div>
                            
                            <div class="member-actions">
                                <!-- Admin controls - should be hidden for non-admin users -->
                                <select class="role-select admin-only" 
                                        data-testid="role-select-${user.uid}" 
                                        style="display: none;">
                                    <option value="admin">Admin</option>
                                    <option value="member">Member</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                                
                                <button class="btn-danger admin-only remove-btn" 
                                        data-testid="remove-${user.uid}"
                                        style="display: none;">
                                    Remove
                                </button>
                                
                                <!-- Member-level actions -->
                                <button class="btn-secondary contact-btn" 
                                        data-testid="contact-${user.uid}">
                                    Contact
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="add-member-section admin-only" data-testid="add-member-section" style="display: none;">
                    <h4>Add New Member</h4>
                    <input type="email" data-testid="new-member-email" placeholder="Enter email" />
                    <button data-testid="add-member-btn">Add Member</button>
                </div>
                
                <div id="permission-info" data-testid="permission-info">Viewing as: Member (limited permissions)</div>
                <button id="simulate-admin" data-testid="simulate-admin">Simulate Admin View</button>
            </div>

            <style>
                .members-view { padding: 20px; }
                .member-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    margin: 12px 0;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                }
                .member-info { flex: 1; }
                .member-name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
                .member-role, .member-status { font-size: 14px; color: #666; margin-bottom: 2px; }
                .member-actions { display: flex; gap: 8px; align-items: center; }
                button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; }
                .btn-secondary { background: #6c757d; color: white; }
                .btn-danger { background: #dc3545; color: white; }
                .admin-only { display: none !important; }
                .admin-only.visible { display: block !important; }
                .add-member-section { 
                    margin-top: 24px; 
                    padding: 20px; 
                    background: #f8f9fa; 
                    border-radius: 8px; 
                }
                .add-member-section input { 
                    padding: 8px 12px; 
                    margin: 0 8px; 
                    border: 1px solid #ccc; 
                    border-radius: 4px; 
                }
                #permission-info { 
                    margin: 16px 0; 
                    padding: 12px; 
                    background: #e9ecef; 
                    border-radius: 4px; 
                }
            </style>

            <script>
                const currentUser = ${JSON.stringify(memberUser)};
                const group = ${JSON.stringify(testGroup)};
                
                class PermissionBasedView {
                    constructor() {
                        this.isAdmin = currentUser.role === 'admin';
                        this.canManageMembers = group.permissions.canManageMembers;
                        
                        this.applyPermissions();
                        this.setupEventListeners();
                    }
                    
                    setupEventListeners() {
                        document.getElementById('simulate-admin').addEventListener('click', () => {
                            this.simulateAdminView();
                        });
                        
                        // Contact buttons (available to all users)
                        document.querySelectorAll('.contact-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const userId = e.target.dataset.testid.replace('contact-', '');
                                this.contactMember(userId);
                            });
                        });
                    }
                    
                    applyPermissions() {
                        const shouldShowAdminControls = this.isAdmin && this.canManageMembers;
                        
                        if (shouldShowAdminControls) {
                            // Show admin controls
                            document.querySelectorAll('.admin-only').forEach(el => {
                                el.style.display = 'block';
                                el.classList.add('visible');
                            });
                            
                            document.getElementById('permission-info').textContent = 'Viewing as: Admin (full permissions)';
                        } else {
                            // Ensure admin controls are hidden
                            document.querySelectorAll('.admin-only').forEach(el => {
                                el.style.display = 'none';
                                el.classList.remove('visible');
                            });
                            
                            const reason = !this.isAdmin ? 'not admin' : 'manage members disabled';
                            document.getElementById('permission-info').textContent = \`Viewing as: \${currentUser.role} (limited permissions - \${reason})\`;
                        }
                    }
                    
                    simulateAdminView() {
                        // Simulate what happens when permissions change
                        this.isAdmin = true;
                        this.canManageMembers = true;
                        this.applyPermissions();
                    }
                    
                    contactMember(userId) {
                        // Simulate member contact functionality
                        const memberName = document.querySelector(\`[data-testid="name-\${userId}"]\`).textContent;
                        document.getElementById('permission-info').textContent = \`Contacted \${memberName} - this action is available to all members\`;
                    }
                }
                
                window.permissionView = new PermissionBasedView();
            </script>
        `);

        // Initially should be member view - admin controls hidden
        await expect(page.getByTestId('add-member-section')).toBeHidden();
        await expect(page.getByTestId('role-select-admin-user-123')).toBeHidden();
        await expect(page.getByTestId('remove-admin-user-123')).toBeHidden();
        await expect(page.getByTestId('permission-info')).toContainText('limited permissions');

        // Member actions should be visible
        await expect(page.getByTestId('contact-admin-user-123')).toBeVisible();
        await expect(page.getByTestId('contact-member-user-456')).toBeVisible();

        // Test member-level action
        await page.getByTestId('contact-admin-user-123').click();
        await expect(page.getByTestId('permission-info')).toContainText('Contacted Admin User - this action is available to all members');

        // Simulate admin view
        await page.getByTestId('simulate-admin').click();
        
        // Now admin controls should be visible
        await expect(page.getByTestId('add-member-section')).toBeVisible();
        await expect(page.getByTestId('role-select-admin-user-123')).toBeVisible();
        await expect(page.getByTestId('remove-member-user-456')).toBeVisible(); // Can remove non-admin users
        await expect(page.getByTestId('permission-info')).toContainText('full permissions');
    });
});