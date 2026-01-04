// realtime.js - Fixed version for proper desktop-mobile sync
class RealTimeCollaboration {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.roomId = 'warsan305';
        this.isConnected = false;
        this.typingTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

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
    }

    promptForUsername() {
        const username = prompt('Enter your name to join the collaborative space:');
        if (username && username.trim()) {
            this.currentUser = username.trim();
            localStorage.setItem('warsan305_user', this.currentUser);
            this.connectToServer();
        } else {
            // Use a default name if user cancels
            this.currentUser = 'User' + Math.floor(Math.random() * 1000);
            localStorage.setItem('warsan305_user', this.currentUser);
            this.connectToServer();
        }
    }

    connectToServer() {
        try {
            this.socket = io();

            // Connection events
            this.socket.on('connect', () => {
                console.log('✅ Connected to server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');

                // Join the room
                this.socket.emit('join-room', {
                    roomId: this.roomId,
                    userName: this.currentUser
                });

                // Show connected notification
                this.showNotification('Connected to real-time collaboration');
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from server');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                
                // Attempt reconnection
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    setTimeout(() => {
                        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                        this.connectToServer();
                    }, 2000 * this.reconnectAttempts);
                }
            });

            this.socket.on('connect_error', (error) => {
                console.log('Connection error:', error);
                this.updateConnectionStatus('disconnected');
                this.showNotification('Connection error - working in offline mode');
            });

            // Room data received - SYNC ALL DATA FROM SERVER
            this.socket.on('room-data', (data) => {
                console.log('📥 Room data received from server');
                
                // IMPORTANT: Replace ALL local data with server data
                if (window.appInstance) {
                    window.appInstance.sharedExpenses = data.expenses || [];
                    window.appInstance.personalDebts = data.personalDebts || [];
                    
                    // Save to localStorage to ensure consistency
                    window.appInstance.saveData();
                    
                    // Update UI
                    window.appInstance.renderExpenses();
                    window.appInstance.renderPersonalDebts();
                    window.appInstance.calculateBalances();
                    
                    this.showNotification('Synced with server data');
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
                this.showNotification(`${user.name} joined`);
                this.addUserToList(user);
            });

            this.socket.on('user-left', (data) => {
                this.showNotification(`${data.userName} left`);
                this.removeUserFromList(data.userId);
            });

            this.socket.on('update-users', (users) => {
                this.updateUserList(users);
            });

            // Data sync events
            this.socket.on('expense-added', (data) => {
                console.log('📥 Expense added by:', data.addedBy);
                
                if (window.appInstance) {
                    const expense = data.expense;
                    const exists = window.appInstance.sharedExpenses.some(e => e.id === expense.id);
                    
                    if (!exists) {
                        window.appInstance.sharedExpenses.unshift(expense);
                        window.appInstance.saveData();
                        window.appInstance.renderExpenses();
                        window.appInstance.calculateBalances();
                        window.appInstance.showAutoSaveIndicator(`New expense from ${data.addedBy}`);
                    }
                }
                
                this.showNotification(`${data.addedBy} added expense: ${data.expense.name}`);
            });

            this.socket.on('debt-added', (data) => {
                console.log('📥 Debt added by:', data.addedBy);
                
                if (window.appInstance) {
                    const debt = data.debt;
                    const exists = window.appInstance.personalDebts.some(d => d.id === debt.id);
                    
                    if (!exists) {
                        window.appInstance.personalDebts.unshift(debt);
                        window.appInstance.saveData();
                        window.appInstance.renderPersonalDebts();
                        window.appInstance.calculateBalances();
                        window.appInstance.showAutoSaveIndicator(`New debt from ${data.addedBy}`);
                    }
                }
                
                this.showNotification(`${data.addedBy} added debt: ${data.debt.description}`);
            });

            this.socket.on('item-deleted', (data) => {
                console.log('🗑️ Item deleted by:', data.deletedBy);
                
                if (window.appInstance) {
                    if (data.itemType === 'expense') {
                        window.appInstance.sharedExpenses = window.appInstance.sharedExpenses.filter(e => e.id !== data.itemId);
                        window.appInstance.saveData();
                        window.appInstance.renderExpenses();
                        window.appInstance.calculateBalances();
                    } else if (data.itemType === 'debt') {
                        window.appInstance.personalDebts = window.appInstance.personalDebts.filter(d => d.id !== data.itemId);
                        window.appInstance.saveData();
                        window.appInstance.renderPersonalDebts();
                    }
                    
                    window.appInstance.showAutoSaveIndicator(`${data.itemType} deleted by ${data.deletedBy}`);
                }
                
                this.showNotification(`${data.deletedBy} deleted a ${data.itemType}`);
            });

            this.socket.on('debt-settled', (data) => {
                console.log('✅ Debt settled by:', data.settledBy);
                
                if (window.appInstance) {
                    const debt = window.appInstance.personalDebts.find(d => d.id === data.debtId);
                    if (debt) {
                        debt.status = 'settled';
                        debt.settledAt = new Date().toISOString();
                        window.appInstance.saveData();
                        window.appInstance.renderPersonalDebts();
                        window.appInstance.calculateBalances();
                        window.appInstance.showAutoSaveIndicator(`Debt settled by ${data.settledBy}`);
                    }
                }
                
                this.showNotification(`${data.settledBy} settled a debt`);
            });

            this.socket.on('data-reset', (data) => {
                console.log('🔄 Data reset by:', data.resetBy);
                
                if (window.appInstance) {
                    window.appInstance.sharedExpenses = [];
                    window.appInstance.personalDebts = [];
                    window.appInstance.saveData();
                    window.appInstance.renderExpenses();
                    window.appInstance.renderPersonalDebts();
                    window.appInstance.calculateBalances();
                    window.appInstance.showAutoSaveIndicator(`Data reset by ${data.resetBy}`);
                    
                    // Clear settlement display
                    const settlementContainer = document.getElementById('settlement-container');
                    if (settlementContainer) {
                        settlementContainer.innerHTML = '<p class="no-expenses">Click "Calculate" to see who owes whom</p>';
                    }
                    
                    // Hide circular debt section
                    const circularDebtSection = document.getElementById('circular-debt-section');
                    if (circularDebtSection) {
                        circularDebtSection.style.display = 'none';
                    }
                }
                
                this.showNotification(`${data.resetBy} reset all data`);
            });

            // New activity
            this.socket.on('new-activity', (activity) => {
                this.addActivityToFeed(activity);
            });

        } catch (error) {
            console.error('Error connecting to server:', error);
            this.showNotification('Cannot connect to server - offline mode');
        }
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
                    if (user.id !== this.socket?.id) {
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
                activeUsersPanel.style.display = 'block';
            }
        }
    }

    addUserToList(user) {
        const userListElement = document.getElementById('user-list');
        if (userListElement && user.id !== this.socket?.id) {
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
            activityList.innerHTML = '';
            
            if (!Array.isArray(activities)) {
                activities = [activities];
            }
            
            // Show newest first
            activities.reverse().forEach(activity => {
                const icon = this.getActivityIcon(activity.type);
                activityList.innerHTML += `
                    <div class="activity-item">
                        <i class="fas ${icon}"></i> ${activity.message}
                        <div class="activity-time">${activity.time}</div>
                    </div>
                `;
            });
        }
    }

    addActivityToFeed(activity) {
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            const icon = this.getActivityIcon(activity.type);
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <i class="fas ${icon}"></i> ${activity.message}
                <div class="activity-time">${activity.time}</div>
            `;
            
            // Add to top
            activityList.insertBefore(activityItem, activityList.firstChild);
            
            // Keep only last 10 activities
            const allActivities = activityList.querySelectorAll('.activity-item');
            if (allActivities.length > 10) {
                activityList.removeChild(allActivities[allActivities.length - 1]);
            }
        }
    }

    getActivityIcon(type) {
        const icons = {
            'join': 'fa-user-plus',
            'leave': 'fa-user-minus',
            'expense': 'fa-receipt',
            'debt': 'fa-hand-holding-usd',
            'delete': 'fa-trash',
            'settle': 'fa-check-circle',
            'reset': 'fa-redo',
            'calculate': 'fa-calculator'
        };
        return icons[type] || 'fa-info-circle';
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

    // Public method to emit events from app.js
    emitEvent(event, data) {
        if (this.socket && this.isConnected) {
            this.socket.emit(event, {
                roomId: this.roomId,
                ...data,
                userName: this.currentUser
            });
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Create global instance
    window.realTime = new RealTimeCollaboration();
    
    // Override app.js functions to emit events
    if (window.appInstance) {
        const originalAddExpense = window.appInstance.addSharedExpense;
        window.appInstance.addSharedExpense = function() {
            // Call original function
            const result = originalAddExpense.apply(this, arguments);
            
            // Emit to server if connected
            if (window.realTime && window.realTime.isConnected && this.sharedExpenses.length > 0) {
                const expense = this.sharedExpenses[this.sharedExpenses.length - 1];
                window.realTime.emitEvent('add-expense', { expense: expense });
            }
            
            return result;
        };

        const originalAddDebt = window.appInstance.addPersonalDebt;
        window.appInstance.addPersonalDebt = function() {
            const result = originalAddDebt.apply(this, arguments);
            
            if (window.realTime && window.realTime.isConnected && this.personalDebts.length > 0) {
                const debt = this.personalDebts[this.personalDebts.length - 1];
                window.realTime.emitEvent('add-personal-debt', { debt: debt });
            }
            
            return result;
        };

        const originalDelete = window.appInstance.confirmDelete;
        window.appInstance.confirmDelete = function() {
            const itemToDelete = this.itemToDelete;
            const deleteType = this.deleteType;
            
            const result = originalDelete.apply(this, arguments);
            
            if (window.realTime && window.realTime.isConnected && itemToDelete && deleteType) {
                window.realTime.emitEvent('delete-item', { 
                    itemId: itemToDelete, 
                    itemType: deleteType 
                });
            }
            
            return result;
        };

        const originalSettleDebt = window.appInstance.settlePersonalDebt;
        window.appInstance.settlePersonalDebt = function(debtId) {
            const result = originalSettleDebt.apply(this, arguments);
            
            if (window.realTime && window.realTime.isConnected) {
                window.realTime.emitEvent('settle-debt', { debtId: debtId });
            }
            
            return result;
        };

        const originalReset = window.appInstance.resetAllData;
        window.appInstance.resetAllData = function() {
            const result = originalReset.apply(this, arguments);
            
            if (window.realTime && window.realTime.isConnected) {
                window.realTime.emitEvent('reset-data', {});
            }
            
            return result;
        };
    }
});
