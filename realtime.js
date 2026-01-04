// realtime.js - Simplified and fixed version
class RealTimeCollaboration {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.roomId = 'warsan305';
        this.isConnected = false;
        this.typingTimeout = null;

        this.init();
    }

    init() {
        // Get current user from localStorage or prompt
        this.currentUser = localStorage.getItem('warsan305_user') || '';

        if (!this.currentUser) {
            this.promptForUsername();
        } else {
            this.connectToServer();
        }

        // Setup event listeners after app is initialized
        setTimeout(() => this.setupEventListeners(), 100);
    }

    promptForUsername() {
        const username = prompt('Enter your name to join the collaborative space:');
        if (username && username.trim()) {
            this.currentUser = username.trim();
            localStorage.setItem('warsan305_user', this.currentUser);
            this.connectToServer();
        } else {
            setTimeout(() => this.promptForUsername(), 100);
        }
    }

    connectToServer() {
        this.socket = io();

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.updateConnectionStatus('connected');

            // Join the room
            this.socket.emit('join-room', {
                roomId: this.roomId,
                userName: this.currentUser
            });
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
        });

        this.socket.on('connect_error', () => {
            this.updateConnectionStatus('disconnected');
        });

        // Room data received
        this.socket.on('room-data', (data) => {
            console.log('Room data received:', data);

            // Update local data
            if (data.expenses) {
                window.appInstance.sharedExpenses = data.expenses;
                window.appInstance.renderExpenses();
                window.appInstance.calculateBalances();
            }

            if (data.personalDebts) {
                window.appInstance.personalDebts = data.personalDebts;
                window.appInstance.renderPersonalDebts();
                window.appInstance.calculateBalances();
            }

            // Update user list
            this.updateUserList(data.users);

            // Update activity feed
            if (data.activityLog) {
                this.updateActivityFeed(data.activityLog);
            }
        });

        // User events
        this.socket.on('user-joined', (user) => {
            this.showNotification(`${user.name} joined the room`);
            this.addUserToList(user);
        });

        this.socket.on('user-left', (data) => {
            this.showNotification(`${data.userName} left the room`);
            this.removeUserFromList(data.userId);
        });

        this.socket.on('update-users', (users) => {
            this.updateUserList(users);
        });

        // Data events
        this.socket.on('expense-added', (data) => {
            const expense = data.expense;

            // Add to local expenses if not already present
            if (!window.appInstance.sharedExpenses.some(e => e.id === expense.id)) {
                window.appInstance.sharedExpenses.unshift(expense);
                window.appInstance.renderExpenses();
                window.appInstance.calculateBalances();
                window.appInstance.showAutoSaveIndicator('New expense added');

                this.showNotification(`${data.addedBy} added expense: ${expense.name}`);
            }
        });

        this.socket.on('debt-added', (data) => {
            const debt = data.debt;

            if (!window.appInstance.personalDebts.some(d => d.id === debt.id)) {
                window.appInstance.personalDebts.unshift(debt);
                window.appInstance.renderPersonalDebts();
                window.appInstance.calculateBalances();
                window.appInstance.showAutoSaveIndicator('New debt added');

                this.showNotification(`${data.addedBy} added personal debt: ${debt.description}`);
            }
        });

        this.socket.on('item-deleted', (data) => {
            if (data.itemType === 'expense') {
                const index = window.appInstance.sharedExpenses.findIndex(e => e.id === data.itemId);
                if (index !== -1) {
                    window.appInstance.sharedExpenses.splice(index, 1);
                    window.appInstance.renderExpenses();
                    window.appInstance.calculateBalances();
                    window.appInstance.showAutoSaveIndicator('Expense deleted');
                }
            } else if (data.itemType === 'debt') {
                const index = window.appInstance.personalDebts.findIndex(d => d.id === data.itemId);
                if (index !== -1) {
                    window.appInstance.personalDebts.splice(index, 1);
                    window.appInstance.renderPersonalDebts();
                    window.appInstance.showAutoSaveIndicator('Debt deleted');
                }
            }
        });

        this.socket.on('debt-settled', (data) => {
            const debt = window.appInstance.personalDebts.find(d => d.id === data.debtId);
            if (debt) {
                debt.status = 'settled';
                debt.settledAt = new Date().toISOString();
                window.appInstance.renderPersonalDebts();
                window.appInstance.calculateBalances();
                window.appInstance.showAutoSaveIndicator('Debt settled');
            }
        });

        this.socket.on('data-reset', () => {
            window.appInstance.sharedExpenses = [];
            window.appInstance.personalDebts = [];
            window.appInstance.settlements = [];

            window.appInstance.renderExpenses();
            window.appInstance.renderPersonalDebts();
            window.appInstance.calculateBalances();
            window.appInstance.showAutoSaveIndicator('Data reset');

            // Clear settlement display
            const settlementContainer = document.getElementById('settlement-container');
            if (settlementContainer) {
                settlementContainer.innerHTML = '<p class="no-expenses">Click "Calculate" to see who owes whom (including personal debts)</p>';
            }

            // Hide circular debt section
            const circularDebtSection = document.getElementById('circular-debt-section');
            if (circularDebtSection) {
                circularDebtSection.style.display = 'none';
            }
        });
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.className = `connection-status status-${status}`;

            switch(status) {
                case 'connected':
                    statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Connected</span>';
                    break;
                case 'disconnected':
                    statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Disconnected</span>';
                    break;
                case 'connecting':
                    statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Connecting...</span>';
                    break;
            }
        }
    }

    updateUserList(users) {
        const userListElement = document.getElementById('user-list');
        if (userListElement) {
            userListElement.innerHTML = '';

            // Add current user first
            userListElement.innerHTML += `
                <li>
                    <div class="user-avatar" style="background-color: ${this.getUserColor(this.currentUser)}">
                        ${this.currentUser.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <strong>${this.currentUser} (You)</strong>
                    </div>
                </li>
            `;

            // Add other users
            if (users && Array.isArray(users)) {
                users.forEach(user => {
                    if (user.id !== this.socket.id) {
                        userListElement.innerHTML += `
                            <li id="user-${user.id}">
                                <div class="user-avatar" style="background-color: ${user.color}">
                                    ${user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <strong>${user.name}</strong>
                                </div>
                            </li>
                        `;
                    }
                });
            }

            // Show/hide active users panel
            const activeUsersPanel = document.getElementById('active-users');
            if (activeUsersPanel) {
                if (users && users.length > 0) {
                    activeUsersPanel.style.display = 'block';
                } else {
                    activeUsersPanel.style.display = 'none';
                }
            }
        }
    }

    addUserToList(user) {
        const userListElement = document.getElementById('user-list');
        if (userListElement && user.id !== this.socket.id) {
            const existingUser = document.getElementById(`user-${user.id}`);
            if (!existingUser) {
                userListElement.innerHTML += `
                    <li id="user-${user.id}">
                        <div class="user-avatar" style="background-color: ${user.color}">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong>${user.name}</strong>
                        </div>
                    </li>
                `;
            }
        }
    }

    removeUserFromList(userId) {
        const userElement = document.getElementById(`user-${userId}`);
        if (userElement) {
            userElement.remove();
        }
    }

    updateActivityFeed(activities) {
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            if (!Array.isArray(activities)) {
                activities = [activities];
            }

            activities.forEach(activity => {
                const icon = this.getActivityIcon(activity.type);
                activityList.innerHTML += `
                    <div class="activity-item">
                        <i class="fas ${icon}"></i> ${activity.message}
                        <div class="activity-time">${activity.time}</div>
                    </div>
                `;
            });

            // Keep only last 10 activities
            const allActivities = activityList.querySelectorAll('.activity-item');
            if (allActivities.length > 10) {
                for (let i = 0; i < allActivities.length - 10; i++) {
                    allActivities[i].remove();
                }
            }
        }
    }

    getActivityIcon(type) {
        switch(type) {
            case 'join': return 'fa-user-plus';
            case 'leave': return 'fa-user-minus';
            case 'expense': return 'fa-receipt';
            case 'debt': return 'fa-hand-holding-usd';
            case 'delete': return 'fa-trash';
            case 'settle': return 'fa-check-circle';
            case 'reset': return 'fa-redo';
            case 'calculate': return 'fa-calculator';
            default: return 'fa-info-circle';
        }
    }

    getUserColor(userName) {
        const colors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
            '#9b59b6', '#1abc9c', '#e67e22'
        ];

        let hash = 0;
        for (let i = 0; i < userName.length; i++) {
            hash = userName.charCodeAt(i) + ((hash << 5) - hash);
        }

        return colors[Math.abs(hash) % colors.length];
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease forwards;
            max-width: 300px;
            font-size: 0.9rem;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);

        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    setupEventListeners() {
        // Override the original button click handlers
        const addExpenseBtn = document.getElementById('add-expense-btn');
        const addDebtBtn = document.getElementById('add-debt-btn');
        const calculateBtn = document.getElementById('calculate-btn');
        const resetBtn = document.getElementById('reset-btn');

        if (addExpenseBtn) {
            addExpenseBtn.onclick = (e) => {
                e.preventDefault();
                this.handleAddExpense();
            };
        }

        if (addDebtBtn) {
            addDebtBtn.onclick = (e) => {
                e.preventDefault();
                this.handleAddDebt();
            };
        }

        if (calculateBtn) {
            calculateBtn.onclick = (e) => {
                e.preventDefault();
                this.handleCalculate();
            };
        }

        if (resetBtn) {
            resetBtn.onclick = (e) => {
                e.preventDefault();
                this.handleReset();
            };
        }

        // Setup roommate tag selection
        this.setupRoommateTags();

        // Setup select all/clear all buttons
        this.setupSelectionButtons();

        // Also override form submissions
        const expenseForm = document.querySelector('#shared-expense-tab');
        const debtForm = document.querySelector('#personal-debt-tab');

        if (expenseForm) {
            expenseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddExpense();
            });
        }

        if (debtForm) {
            debtForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddDebt();
            });
        }

        // Auto-select all roommates when focusing on expense name
        const expenseName = document.getElementById('expense-name');
        if (expenseName) {
            expenseName.addEventListener('focus', () => {
                if (window.appInstance && window.appInstance.selectedRoommates.size === 0) {
                    const ROOMMATE_IDS = Object.keys(window.appInstance.ROOMMATES || {});
                    ROOMMATE_IDS.forEach(id => window.appInstance.selectedRoommates.add(id));
                    if (window.appInstance.setupRoommateTags) {
                        window.appInstance.setupRoommateTags();
                        window.appInstance.updatePaidByOptions();
                    }
                }
            });
        }
    }

    setupRoommateTags() {
        const roommateTagsContainer = document.getElementById('roommate-tags-container');
        if (roommateTagsContainer) {
            roommateTagsContainer.addEventListener('click', (e) => {
                const tag = e.target.closest('.roommate-tag');
                if (tag && window.appInstance) {
                    const id = tag.dataset.id;
                    this.toggleRoommateSelection(id);
                }
            });
        }
    }

    setupSelectionButtons() {
        const selectAllBtn = document.getElementById('select-all-btn');
        const clearAllBtn = document.getElementById('clear-all-btn');

        if (selectAllBtn && window.appInstance) {
            selectAllBtn.addEventListener('click', () => {
                const ROOMMATE_IDS = Object.keys(window.appInstance.ROOMMATES || {});
                ROOMMATE_IDS.forEach(id => window.appInstance.selectedRoommates.add(id));
                if (window.appInstance.setupRoommateTags) {
                    window.appInstance.setupRoommateTags();
                    window.appInstance.updatePaidByOptions();
                }
            });
        }

        if (clearAllBtn && window.appInstance) {
            clearAllBtn.addEventListener('click', () => {
                window.appInstance.selectedRoommates.clear();
                if (window.appInstance.setupRoommateTags) {
                    window.appInstance.setupRoommateTags();
                    window.appInstance.updatePaidByOptions();
                }
            });
        }
    }

    toggleRoommateSelection(id) {
        if (!window.appInstance) return;

        if (window.appInstance.selectedRoommates.has(id)) {
            window.appInstance.selectedRoommates.delete(id);
        } else {
            window.appInstance.selectedRoommates.add(id);
        }

        const tag = document.querySelector(`.roommate-tag[data-id="${id}"]`);
        if (tag) {
            tag.classList.toggle('selected', window.appInstance.selectedRoommates.has(id));
            const checkmark = tag.querySelector('.tag-checkmark');
            if (checkmark) {
                checkmark.textContent = window.appInstance.selectedRoommates.has(id) ? '✓' : '✗';
            }
        }

        this.updateSelectedCount();
        if (window.appInstance.updatePaidByOptions) {
            window.appInstance.updatePaidByOptions();
        }
    }

    updateSelectedCount() {
        const selectedCountEl = document.getElementById('selected-count');
        if (selectedCountEl && window.appInstance) {
            selectedCountEl.textContent = `${window.appInstance.selectedRoommates.size}/${Object.keys(window.appInstance.ROOMMATES || {}).length} selected`;
            
            // Update color based on selection status
            const totalCount = Object.keys(window.appInstance.ROOMMATES || {}).length;
            if (window.appInstance.selectedRoommates.size === totalCount) {
                selectedCountEl.style.color = '#2ecc71';
            } else if (window.appInstance.selectedRoommates.size === 0) {
                selectedCountEl.style.color = '#e74c3c';
            } else {
                selectedCountEl.style.color = '#f39c12';
            }
        }
    }

    handleAddExpense() {
        const type = document.getElementById('expense-type').value;
        const name = document.getElementById('expense-name').value.trim();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const date = document.getElementById('invoice-date').value;
        const paidBy = document.getElementById('paid-by').value;

        // Get selected roommates
        const selectedRoommatesArray = window.appInstance ?
            Array.from(window.appInstance.selectedRoommates) :
            Object.keys(window.appInstance?.ROOMMATES || {});

        // Validation
        if (!name) {
            alert('Please enter an expense name');
            document.getElementById('expense-name').focus();
            return;
        }

        if (!amount || amount <= 0 || isNaN(amount)) {
            alert('Please enter a valid amount');
            document.getElementById('expense-amount').focus();
            return;
        }

        if (!date) {
            alert('Please select a date');
            document.getElementById('invoice-date').focus();
            return;
        }

        if (selectedRoommatesArray.length === 0) {
            alert('Please select at least one roommate to include in this expense');
            return;
        }

        if (!selectedRoommatesArray.includes(paidBy)) {
            alert('The person who paid must be included in the expense');
            return;
        }

        // Create expense object
        const expense = {
            id: Date.now(),
            type: type,
            name: name,
            amount: amount,
            date: date,
            paidBy: paidBy,
            paidByName: window.appInstance.ROOMMATES[paidBy],
            includedPersons: selectedRoommatesArray,
            sharePerPerson: amount / selectedRoommatesArray.length,
            createdAt: new Date().toISOString()
        };

        // Emit to server
        if (this.socket && this.isConnected) {
            this.socket.emit('add-expense', {
                roomId: this.roomId,
                expense: expense,
                userName: this.currentUser
            });
        } else {
            // Local fallback
            if (window.appInstance && window.appInstance.addSharedExpense) {
                window.appInstance.sharedExpenses.push(expense);
                window.appInstance.saveData();
                window.appInstance.renderExpenses();
                window.appInstance.calculateBalances();
                window.appInstance.showAutoSaveIndicator('Expense added successfully!');
            }
        }

        // Reset form
        document.getElementById('expense-name').value = '';
        document.getElementById('expense-amount').value = '';
        document.getElementById('expense-name').focus();

        // Reset roommate selection to all
        if (window.appInstance) {
            const ROOMMATE_IDS = Object.keys(window.appInstance.ROOMMATES || {});
            window.appInstance.selectedRoommates = new Set(ROOMMATE_IDS);
            if (window.appInstance.setupRoommateTags) {
                window.appInstance.setupRoommateTags();
                window.appInstance.updatePaidByOptions();
            }
        }
    }

    handleAddDebt() {
        const from = document.getElementById('debt-from').value;
        const to = document.getElementById('debt-to').value;
        const amount = parseFloat(document.getElementById('debt-amount').value);
        const description = document.getElementById('debt-description').value.trim();
        const date = document.getElementById('debt-date').value;
        const notes = document.getElementById('debt-notes').value.trim();

        // Validation - Fixed: Check for minimum length instead of just existence
        if (from === to) {
            alert('The debtor and creditor cannot be the same person');
            return;
        }

        if (!description || description.length < 2) {
            alert('Please enter a valid description (at least 2 characters)');
            document.getElementById('debt-description').focus();
            return;
        }

        if (!amount || amount <= 0 || isNaN(amount)) {
            alert('Please enter a valid amount');
            document.getElementById('debt-amount').focus();
            return;
        }

        if (!date) {
            alert('Please select a date');
            document.getElementById('debt-date').focus();
            return;
        }

        // Create debt object
        const debt = {
            id: Date.now(),
            from: from,
            fromName: window.appInstance.ROOMMATES[from],
            to: to,
            toName: window.appInstance.ROOMMATES[to],
            amount: amount,
            description: description,
            date: date,
            notes: notes,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Emit to server
        if (this.socket && this.isConnected) {
            this.socket.emit('add-personal-debt', {
                roomId: this.roomId,
                debt: debt,
                userName: this.currentUser
            });
        } else {
            // Local fallback
            if (window.appInstance && window.appInstance.addPersonalDebt) {
                window.appInstance.personalDebts.push(debt);
                window.appInstance.saveData();
                window.appInstance.renderPersonalDebts();
                window.appInstance.showAutoSaveIndicator('Personal debt added successfully!');
            }
        }

        // Reset form
        document.getElementById('debt-description').value = '';
        document.getElementById('debt-amount').value = '';
        document.getElementById('debt-notes').value = '';
        document.getElementById('debt-description').focus();
    }

    handleCalculate() {
        // Just trigger the original calculation
        if (window.appInstance && window.appInstance.calculateSettlements) {
            window.appInstance.calculateSettlements();

            // Emit to server
            if (this.socket && this.isConnected) {
                this.socket.emit('calculate-settlements', {
                    roomId: this.roomId,
                    userName: this.currentUser
                });
            }
        }
    }

    handleReset() {
        if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
            // Emit to server
            if (this.socket && this.isConnected) {
                this.socket.emit('reset-data', {
                    roomId: this.roomId,
                    userName: this.currentUser
                });
            } else {
                // Local fallback
                if (window.appInstance && window.appInstance.resetAllData) {
                    window.appInstance.resetAllData();
                }
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for app.js to initialize
    setTimeout(() => {
        if (!window.realTime) {
            window.realTime = new RealTimeCollaboration();
        }
    }, 500);
});
