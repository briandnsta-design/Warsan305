// realtime.js - Corrected to work with app.js
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
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    promptForUsername() {
        const username = prompt('Enter your name to join the collaborative space:');
        if (username && username.trim()) {
            this.currentUser = username.trim();
            localStorage.setItem('warsan305_user', this.currentUser);
            this.connectToServer();
        } else {
            // Try again if cancelled
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
            
            // Get references to app.js variables and functions
            const app = window.appInstance;
            
            if (app && data.expenses) {
                app.sharedExpenses = data.expenses;
                app.renderExpenses();
                app.calculateBalances();
            }
            
            if (app && data.personalDebts) {
                app.personalDebts = data.personalDebts;
                app.renderPersonalDebts();
                app.calculateBalances();
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
        
        this.socket.on('user-typing', (data) => {
            this.showTypingIndicator(data);
        });
        
        // Data events
        this.socket.on('expense-added', (data) => {
            const expense = data.expense;
            const app = window.appInstance;
            
            if (app && !app.sharedExpenses.some(e => e.id === expense.id)) {
                app.sharedExpenses.unshift(expense);
                app.renderExpenses();
                app.calculateBalances();
                app.showAutoSaveIndicator('New expense added: ' + expense.name);
                
                this.showNotification(`${data.addedBy} added expense: ${expense.name}`);
            }
        });
        
        this.socket.on('debt-added', (data) => {
            const debt = data.debt;
            const app = window.appInstance;
            
            if (app && !app.personalDebts.some(d => d.id === debt.id)) {
                app.personalDebts.unshift(debt);
                app.renderPersonalDebts();
                app.calculateBalances();
                app.showAutoSaveIndicator('New debt added');
                
                this.showNotification(`${data.addedBy} added personal debt: ${debt.description}`);
            }
        });
        
        this.socket.on('item-deleted', (data) => {
            const app = window.appInstance;
            
            if (app) {
                if (data.itemType === 'expense') {
                    const index = app.sharedExpenses.findIndex(e => e.id === data.itemId);
                    if (index !== -1) {
                        app.sharedExpenses.splice(index, 1);
                        app.renderExpenses();
                        app.calculateBalances();
                        app.showAutoSaveIndicator('Expense deleted');
                    }
                } else if (data.itemType === 'debt') {
                    const index = app.personalDebts.findIndex(d => d.id === data.itemId);
                    if (index !== -1) {
                        app.personalDebts.splice(index, 1);
                        app.renderPersonalDebts();
                        app.showAutoSaveIndicator('Debt deleted');
                    }
                }
            }
        });
        
        this.socket.on('debt-settled', (data) => {
            const app = window.appInstance;
            
            if (app) {
                const debt = app.personalDebts.find(d => d.id === data.debtId);
                if (debt) {
                    debt.status = 'settled';
                    debt.settledAt = new Date().toISOString();
                    app.renderPersonalDebts();
                    app.calculateBalances();
                    app.showAutoSaveIndicator('Debt settled');
                }
            }
        });
        
        this.socket.on('data-reset', (data) => {
            const app = window.appInstance;
            
            if (app) {
                app.sharedExpenses = [];
                app.personalDebts = [];
                app.settlements = [];
                
                app.renderExpenses();
                app.renderPersonalDebts();
                app.calculateBalances();
                app.showAutoSaveIndicator('Data reset by ' + data.resetBy);
                
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
                
                this.showNotification(`${data.resetBy} reset all data`);
            }
        });
        
        this.socket.on('settlements-calculated', (data) => {
            const app = window.appInstance;
            
            if (app) {
                app.settlements = data.settlements;
                app.renderSettlements();
                
                const circularDebtSection = document.getElementById('circular-debt-section');
                if (circularDebtSection) {
                    circularDebtSection.style.display = 'block';
                }
                
                app.showAutoSaveIndicator('Settlements calculated by ' + data.calculatedBy);
                
                this.showNotification(`${data.calculatedBy} calculated settlements`);
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
                                    ${user.isTyping ? '<span class="user-typing">is typing...</span>' : ''}
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
    
    showTypingIndicator(data) {
        const userElement = document.getElementById(`user-${data.userId}`);
        if (userElement) {
            const typingSpan = userElement.querySelector('.user-typing');
            if (data.isTyping) {
                if (!typingSpan) {
                    userElement.querySelector('div').innerHTML += 
                        '<span class="user-typing">is typing...</span>';
                }
            } else {
                if (typingSpan) {
                    typingSpan.remove();
                }
            }
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
            
            // Scroll to bottom
            const activityFeed = document.getElementById('activity-feed');
            if (activityFeed) {
                activityFeed.scrollTop = activityFeed.scrollHeight;
            }
        }
    }
    
    addActivityToFeed(activity) {
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            const icon = this.getActivityIcon(activity.type);
            activityList.innerHTML += `
                <div class="activity-item">
                    <i class="fas ${icon}"></i> ${activity.message}
                    <div class="activity-time">${activity.time}</div>
                </div>
            `;
            
            // Keep only last 10 activities
            const allActivities = activityList.querySelectorAll('.activity-item');
            if (allActivities.length > 10) {
                for (let i = 0; i < allActivities.length - 10; i++) {
                    allActivities[i].remove();
                }
            }
            
            // Scroll to bottom
            const activityFeed = document.getElementById('activity-feed');
            if (activityFeed) {
                activityFeed.scrollTop = activityFeed.scrollHeight;
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
        // Simple color assignment based on username
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
        // Create a simple notification
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
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
        
        // Add animation styles if not already present
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
        // Override app.js functions to emit socket events
        
        // Get app instance
        const app = window.appInstance;
        
        if (app) {
            // Store original functions
            const originalAddSharedExpense = app.addSharedExpense.bind(app);
            const originalAddPersonalDebt = app.addPersonalDebt.bind(app);
            const originalSettlePersonalDebt = app.settlePersonalDebt.bind(app);
            const originalCalculateSettlements = app.calculateSettlements.bind(app);
            const originalResetAllData = app.resetAllData.bind(app);
            const originalConfirmDelete = app.confirmDelete.bind(app);
            
            // Override addSharedExpense
            app.addSharedExpense = () => {
                const type = document.getElementById('expense-type').value;
                const name = document.getElementById('expense-name').value.trim();
                const amount = parseFloat(document.getElementById('expense-amount').value);
                const date = document.getElementById('invoice-date').value;
                const paidByValue = document.getElementById('paid-by').value;
                
                // Get selected roommates for splitting
                const selectedRoommates = [];
                document.querySelectorAll('.split-option input[type="checkbox"]').forEach(checkbox => {
                    if (checkbox.checked) {
                        selectedRoommates.push(checkbox.value);
                    }
                });
                
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
                
                if (selectedRoommates.length === 0) {
                    alert('Please select at least one roommate to split the expense with');
                    return;
                }
                
                // Ensure the payer is included
                if (!selectedRoommates.includes(paidByValue)) {
                    selectedRoommates.push(paidByValue);
                }
                
                // Create expense object
                const expense = {
                    id: Date.now(),
                    type: type,
                    name: name,
                    amount: amount,
                    date: date,
                    paidBy: paidByValue,
                    paidByName: app.ROOMMATES[paidByValue],
                    splitBetween: selectedRoommates,
                    createdAt: new Date().toISOString()
                };
                
                // Emit to server if connected
                if (this.socket && this.isConnected) {
                    this.socket.emit('add-expense', {
                        roomId: this.roomId,
                        expense: expense,
                        userName: this.currentUser
                    });
                } else {
                    // Use original function if not connected
                    app.sharedExpenses.push(expense);
                    app.saveData();
                    app.renderExpenses();
                    app.calculateBalances();
                    
                    // Reset form
                    document.getElementById('expense-name').value = '';
                    document.getElementById('expense-amount').value = '';
                    
                    app.showAutoSaveIndicator('Expense added successfully!');
                }
            };
            
            // Override addPersonalDebt
            app.addPersonalDebt = () => {
                const from = document.getElementById('debt-from').value;
                const to = document.getElementById('debt-to').value;
                const amount = parseFloat(document.getElementById('debt-amount').value);
                const description = document.getElementById('debt-description').value.trim();
                const date = document.getElementById('debt-date').value;
                const notes = document.getElementById('debt-notes').value.trim();
                
                // Validation
                if (from === to) {
                    alert('The debtor and creditor cannot be the same person');
                    return;
                }
                
                if (!description) {
                    alert('Please enter a description');
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
                    fromName: app.ROOMMATES[from],
                    to: to,
                    toName: app.ROOMMATES[to],
                    amount: amount,
                    description: description,
                    date: date,
                    notes: notes,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                
                // Emit to server if connected
                if (this.socket && this.isConnected) {
                    this.socket.emit('add-personal-debt', {
                        roomId: this.roomId,
                        debt: debt,
                        userName: this.currentUser
                    });
                } else {
                    // Use original function if not connected
                    app.personalDebts.push(debt);
                    app.saveData();
                    app.renderPersonalDebts();
                    
                    // Reset form
                    document.getElementById('debt-description').value = '';
                    document.getElementById('debt-amount').value = '';
                    document.getElementById('debt-notes').value = '';
                    
                    app.showAutoSaveIndicator('Personal debt added successfully!');
                }
            };
            
            // Override settlePersonalDebt
            app.settlePersonalDebt = (debtId) => {
                const debtIndex = app.personalDebts.findIndex(d => d.id === debtId);
                if (debtIndex !== -1) {
                    const debt = app.personalDebts[debtIndex];
                    
                    // Emit to server if connected
                    if (this.socket && this.isConnected) {
                        this.socket.emit('settle-debt', {
                            roomId: this.roomId,
                            debtId: debtId,
                            userName: this.currentUser
                        });
                    } else {
                        // Use original function if not connected
                        debt.status = 'settled';
                        debt.settledAt = new Date().toISOString();
                        app.saveData();
                        app.renderPersonalDebts();
                        app.calculateBalances();
                    }
                }
            };
            
            // Override calculateSettlements
            app.calculateSettlements = () => {
                // Call original function to calculate
                originalCalculateSettlements();
                
                // Emit to server if connected
                if (this.socket && this.isConnected) {
                    this.socket.emit('calculate-settlements', {
                        roomId: this.roomId,
                        settlements: app.settlements,
                        userName: this.currentUser
                    });
                }
            };
            
            // Override confirmDelete
            app.confirmDelete = () => {
                if (app.itemToDelete && app.deleteType) {
                    // Emit to server if connected
                    if (this.socket && this.isConnected) {
                        this.socket.emit('delete-item', {
                            roomId: this.roomId,
                            itemId: app.itemToDelete,
                            itemType: app.deleteType,
                            userName: this.currentUser
                        });
                    } else {
                        // Use original function if not connected
                        if (app.deleteType === 'expense') {
                            app.sharedExpenses = app.sharedExpenses.filter(e => e.id !== app.itemToDelete);
                        } else {
                            app.personalDebts = app.personalDebts.filter(d => d.id !== app.itemToDelete);
                        }
                        
                        app.saveData();
                        
                        if (app.deleteType === 'expense') {
                            app.renderExpenses();
                            app.calculateBalances();
                        } else {
                            app.renderPersonalDebts();
                        }
                        
                        app.showAutoSaveIndicator('Item deleted successfully!');
                    }
                    
                    app.hideDeleteConfirmation();
                }
            };
            
            // Override resetAllData
            app.resetAllData = () => {
                // Emit to server if connected
                if (this.socket && this.isConnected) {
                    this.socket.emit('reset-data', {
                        roomId: this.roomId,
                        userName: this.currentUser
                    });
                } else {
                    // Use original function if not connected
                    originalResetAllData();
                }
                
                app.hideResetConfirmation();
            };
        }
        
        // Typing indicators for input fields
        const expenseInputs = document.querySelectorAll('#shared-expense-tab input, #shared-expense-tab textarea, #shared-expense-tab select');
        const debtInputs = document.querySelectorAll('#personal-debt-tab input, #personal-debt-tab textarea, #personal-debt-tab select');
        
        const emitTyping = (isTyping) => {
            if (this.socket && this.isConnected) {
                this.socket.emit('typing', {
                    roomId: this.roomId,
                    userName: this.currentUser,
                    isTyping: isTyping
                });
            }
        };
        
        expenseInputs.forEach(input => {
            input.addEventListener('focus', () => {
                emitTyping(true);
            });
            
            input.addEventListener('blur', () => {
                emitTyping(false);
            });
            
            input.addEventListener('keydown', () => {
                clearTimeout(this.typingTimeout);
                emitTyping(true);
                
                this.typingTimeout = setTimeout(() => {
                    emitTyping(false);
                }, 1000);
            });
        });
        
        debtInputs.forEach(input => {
            input.addEventListener('focus', () => {
                emitTyping(true);
            });
            
            input.addEventListener('blur', () => {
                emitTyping(false);
            });
            
            input.addEventListener('keydown', () => {
                clearTimeout(this.typingTimeout);
                emitTyping(true);
                
                this.typingTimeout = setTimeout(() => {
                    emitTyping(false);
                }, 1000);
            });
        });
    }
}

// Expose app.js instance to realtime.js
document.addEventListener('DOMContentLoaded', function() {
    // Store app instance globally so realtime.js can access it
    window.appInstance = {
        // Variables
        sharedExpenses: JSON.parse(localStorage.getItem('warsan305_sharedExpenses')) || [],
        personalDebts: JSON.parse(localStorage.getItem('warsan305_personalDebts')) || [],
        settlements: [],
        itemToDelete: null,
        deleteType: null,
        
        // Constants
        ROOMMATES: {
            person1: 'Brian',
            person2: 'Tessa', 
            person3: 'Robert',
            person4: 'Hershey',
            person5: 'Wilson',
            person6: 'Joselle',
            person7: 'Chona'
        },
        
        // Functions (will be overridden by realtime.js)
        addSharedExpense: () => {},
        addPersonalDebt: () => {},
        settlePersonalDebt: () => {},
        calculateSettlements: () => {},
        confirmDelete: () => {},
        resetAllData: () => {},
        
        // Helper functions that realtime.js needs
        saveData: () => {
            localStorage.setItem('warsan305_sharedExpenses', JSON.stringify(window.appInstance.sharedExpenses));
            localStorage.setItem('warsan305_personalDebts', JSON.stringify(window.appInstance.personalDebts));
        },
        
        showAutoSaveIndicator: (message) => {
            const indicator = document.getElementById('auto-save-indicator');
            if (indicator) {
                indicator.innerHTML = `<i class="fas fa-save"></i> ${message}`;
                indicator.classList.add('show');
                
                setTimeout(() => {
                    indicator.classList.remove('show');
                }, 3000);
            }
        },
        
        hideDeleteConfirmation: () => {
            const deleteConfirmation = document.getElementById('delete-confirmation');
            const deleteOverlay = document.getElementById('delete-overlay');
            
            if (deleteConfirmation) deleteConfirmation.classList.remove('active');
            if (deleteOverlay) deleteOverlay.classList.remove('active');
            
            window.appInstance.itemToDelete = null;
            window.appInstance.deleteType = null;
        },
        
        hideResetConfirmation: () => {
            const resetConfirmation = document.getElementById('reset-confirmation');
            if (resetConfirmation) resetConfirmation.classList.remove('active');
        }
    };
    
    // Initialize real-time collaboration
    window.realTime = new RealTimeCollaboration();
});
