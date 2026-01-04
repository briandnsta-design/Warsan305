// realtime.js - Complete version configured for https://warsan305.onrender.com/
class RealTimeCollaboration {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.roomId = 'warsan305';
        this.isConnected = false;
        this.typingTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        
        // Store your Render URL
        this.serverUrl = 'https://warsan305.onrender.com';

        this.init();
    }

    init() {
        console.log('🚀 RealTimeCollaboration initializing for URL:', this.serverUrl);
        
        // Get current user from localStorage or prompt
        this.currentUser = localStorage.getItem('warsan305_user') || '';

        if (!this.currentUser) {
            this.promptForUsername();
        } else {
            console.log('👤 User identified:', this.currentUser);
            this.connectToServer();
        }
    }

    promptForUsername() {
        const username = prompt('Enter your name to join the collaborative bill splitter:');
        if (username && username.trim()) {
            this.currentUser = username.trim();
            localStorage.setItem('warsan305_user', this.currentUser);
            console.log('✅ User set:', this.currentUser);
            this.connectToServer();
        } else {
            // Use a default name if user cancels
            this.currentUser = 'Roommate_' + Math.floor(Math.random() * 1000);
            localStorage.setItem('warsan305_user', this.currentUser);
            console.log('⚠️ Using default name:', this.currentUser);
            this.connectToServer();
        }
    }

    connectToServer() {
        console.log('🔗 Attempting connection to:', this.serverUrl);
        
        try {
            // CRITICAL: Connect to your Render URL
            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                forceNew: true,
                upgrade: true,
                path: '/socket.io/'
            });

            // Connection events
            this.socket.on('connect', () => {
                console.log('✅✅✅ CONNECTED to server:', this.socket.id);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');

                // Join the room
                this.socket.emit('join-room', {
                    roomId: this.roomId,
                    userName: this.currentUser
                });

                this.showNotification('Connected to real-time collaboration!');
                console.log('📤 Emitted join-room for:', this.currentUser);
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ DISCONNECTED from server. Reason:', reason);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                
                // Attempt reconnection
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(3000 * this.reconnectAttempts, 30000);
                    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    setTimeout(() => {
                        console.log('Attempting reconnection...');
                        this.connectToServer();
                    }, delay);
                } else {
                    console.log('❌ Max reconnection attempts reached');
                    this.showNotification('Connection lost - working offline');
                }
            });

            this.socket.on('connect_error', (error) => {
                console.log('🔌 Connection error:', error.message);
                this.updateConnectionStatus('disconnected');
                
                // Try polling only if websocket fails
                if (error.message.includes('websocket')) {
                    console.log('🔄 Trying polling transport as fallback...');
                    this.socket = io(this.serverUrl, {
                        transports: ['polling'],
                        reconnection: true
                    });
                }
                
                this.showNotification('Connection error - working in offline mode');
            });

            // Room data received - SYNC ALL DATA FROM SERVER
            this.socket.on('room-data', (data) => {
                console.log('📥 Room data received from server:', {
                    expenses: data.expenses?.length || 0,
                    debts: data.personalDebts?.length || 0,
                    users: data.users?.length || 0
                });
                
                // IMPORTANT: Replace ALL local data with server data
                if (window.appInstance) {
                    // Clear and replace with server data
                    window.appInstance.sharedExpenses = data.expenses || [];
                    window.appInstance.personalDebts = data.personalDebts || [];
                    
                    // Save to localStorage to ensure consistency
                    window.appInstance.saveData();
                    
                    // Update UI
                    window.appInstance.renderExpenses();
                    window.appInstance.renderPersonalDebts();
                    window.appInstance.calculateBalances();
                    
                    console.log('🔄 Synced local data with server');
                    this.showNotification('Synced with server data');
                } else {
                    console.warn('⚠️ appInstance not available yet');
                }
                
                // Update user list
                if (data.users) {
                    this.updateUserList(data.users);
                }
                
                // Update activity feed
                if (data.activityLog) {
                    this.updateActivityFeed(data.activityLog);
                }
            });

            // User events
            this.socket.on('user-joined', (user) => {
                console.log('👋 User joined:', user.name);
                this.showNotification(`${user.name} joined`);
                this.addUserToList(user);
                this.addActivityToFeed({
                    type: 'join',
                    message: `${user.name} joined`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            });

            this.socket.on('user-left', (data) => {
                console.log('👋 User left:', data.userName);
                this.showNotification(`${data.userName} left`);
                this.removeUserFromList(data.userId);
                this.addActivityToFeed({
                    type: 'leave',
                    message: `${data.userName} left`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            });

            this.socket.on('update-users', (users) => {
                this.updateUserList(users);
            });

            // Data sync events
            this.socket.on('expense-added', (data) => {
                console.log('💰 Expense added by:', data.addedBy, 'Amount:', data.expense?.amount);
                
                if (window.appInstance && data.expense) {
                    const expense = data.expense;
                    const exists = window.appInstance.sharedExpenses.some(e => e.id === expense.id);
                    
                    if (!exists) {
                        window.appInstance.sharedExpenses.unshift(expense);
                        window.appInstance.saveData();
                        window.appInstance.renderExpenses();
                        window.appInstance.calculateBalances();
                        window.appInstance.showAutoSaveIndicator(`New expense from ${data.addedBy}`);
                        console.log('✅ Added remote expense to local data');
                    } else {
                        console.log('⚠️ Expense already exists locally');
                    }
                }
                
                this.showNotification(`${data.addedBy} added expense: ${data.expense?.name || 'Unknown'}`);
                this.addActivityToFeed({
                    type: 'expense',
                    message: `${data.addedBy} added expense: ${data.expense?.name || 'Unknown'}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            });

            this.socket.on('debt-added', (data) => {
                console.log('💳 Debt added by:', data.addedBy, 'Amount:', data.debt?.amount);
                
                if (window.appInstance && data.debt) {
                    const debt = data.debt;
                    const exists = window.appInstance.personalDebts.some(d => d.id === debt.id);
                    
                    if (!exists) {
                        window.appInstance.personalDebts.unshift(debt);
                        window.appInstance.saveData();
                        window.appInstance.renderPersonalDebts();
                        window.appInstance.calculateBalances();
                        window.appInstance.showAutoSaveIndicator(`New debt from ${data.addedBy}`);
                        console.log('✅ Added remote debt to local data');
                    } else {
                        console.log('⚠️ Debt already exists locally');
                    }
                }
                
                this.showNotification(`${data.addedBy} added debt: ${data.debt?.description || 'Unknown'}`);
                this.addActivityToFeed({
                    type: 'debt',
                    message: `${data.addedBy} added a personal debt`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            });

            this.socket.on('item-deleted', (data) => {
                console.log('🗑️ Item deleted by:', data.deletedBy, 'Type:', data.itemType, 'ID:', data.itemId);
                
                if (window.appInstance) {
                    if (data.itemType === 'expense') {
                        window.appInstance.sharedExpenses = window.appInstance.sharedExpenses.filter(e => e.id !== data.itemId);
                        window.appInstance.saveData();
                        window.appInstance.renderExpenses();
                        window.appInstance.calculateBalances();
                        console.log('✅ Removed expense from local data');
                    } else if (data.itemType === 'debt') {
                        window.appInstance.personalDebts = window.appInstance.personalDebts.filter(d => d.id !== data.itemId);
                        window.appInstance.saveData();
                        window.appInstance.renderPersonalDebts();
                        console.log('✅ Removed debt from local data');
                    }
                    
                    window.appInstance.showAutoSaveIndicator(`${data.itemType} deleted by ${data.deletedBy}`);
                }
                
                this.showNotification(`${data.deletedBy} deleted a ${data.itemType}`);
                this.addActivityToFeed({
                    type: 'delete',
                    message: `${data.deletedBy} deleted a ${data.itemType}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            });

            this.socket.on('debt-settled', (data) => {
                console.log('✅ Debt settled by:', data.settledBy, 'Debt ID:', data.debtId);
                
                if (window.appInstance) {
                    const debt = window.appInstance.personalDebts.find(d => d.id === data.debtId);
                    if (debt) {
                        debt.status = 'settled';
                        debt.settledAt = new Date().toISOString();
                        window.appInstance.saveData();
                        window.appInstance.renderPersonalDebts();
                        window.appInstance.calculateBalances();
                        window.appInstance.showAutoSaveIndicator(`Debt settled by ${data.settledBy}`);
                        console.log('✅ Updated debt status to settled');
                    } else {
                        console.log('⚠️ Debt not found locally:', data.debtId);
                    }
                }
                
                this.showNotification(`${data.settledBy} settled a debt`);
                this.addActivityToFeed({
                    type: 'settle',
                    message: `${data.settledBy} settled a debt`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
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
                    
                    console.log('✅ Local data cleared after server reset');
                }
                
                this.showNotification(`${data.resetBy} reset all data`);
                this.addActivityToFeed({
                    type: 'reset',
                    message: `${data.resetBy} reset all data`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            });

            // New activity
            this.socket.on('new-activity', (activity) => {
                this.addActivityToFeed(activity);
            });

            // Connection testing
            this.socket.on('pong', (latency) => {
                console.log(`🏓 Pong received - latency: ${latency}ms`);
            });

        } catch (error) {
            console.error('💥 Error connecting to server:', error);
            this.showNotification('Cannot connect to server - offline mode');
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.className = `connection-status status-${status}`;
            
            const statusMap = {
                'connected': { icon: 'fa-circle', text: 'Connected', color: '#2ecc71' },
                'disconnected': { icon: 'fa-circle', text: 'Disconnected', color: '#e74c3c' },
                'connecting': { icon: 'fa-circle', text: 'Connecting...', color: '#f39c12' }
            };
            
            const current = statusMap[status] || statusMap.disconnected;
            statusElement.innerHTML = `<i class="fas ${current.icon}" style="color: ${current.color}"></i><span>${current.text}</span>`;
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
                        <div style="font-size: 0.8rem; color: #2ecc71;">● Online</div>
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
                                    <div style="font-size: 0.8rem; color: #2ecc71;">● Online</div>
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
                            <div style="font-size: 0.8rem; color: #2ecc71;">● Online</div>
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
            '#9b59b6', '#1abc9c', '#e67e22', '#16a085'
        ];
        
        let hash = 0;
        for (let i = 0; i < userName.length; i++) {
            hash = userName.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }

    showNotification(message) {
        // Check if notifications are enabled
        if (localStorage.getItem('warsan305_notifications') === 'false') {
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease forwards;
            max-width: 300px;
            font-size: 0.9rem;
            font-weight: 500;
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

    // Public method to emit events
    emitEvent(event, data) {
        if (this.socket && this.isConnected) {
            console.log(`📤 Emitting ${event}:`, data);
            this.socket.emit(event, {
                roomId: this.roomId,
                ...data,
                userName: this.currentUser
            });
            return true;
        } else {
            console.warn(`⚠️ Cannot emit ${event}: Socket not connected`);
            return false;
        }
    }

    // Test connection
    testConnection() {
        if (this.socket && this.isConnected) {
            const startTime = Date.now();
            this.socket.emit('ping');
            this.socket.once('pong', () => {
                const latency = Date.now() - startTime;
                console.log(`🏓 Connection test: ${latency}ms latency`);
                this.showNotification(`Connection good (${latency}ms)`);
            });
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, initializing real-time collaboration...');
    
    // Wait a moment for app.js to initialize
    setTimeout(() => {
        if (!window.realTime) {
            window.realTime = new RealTimeCollaboration();
            console.log('🎉 RealTimeCollaboration instance created');
            
            // Expose for debugging
            window.debugRealtime = function() {
                console.log('🔍 RealTime Debug Info:', {
                    connected: window.realTime.isConnected,
                    socketId: window.realTime.socket?.id,
                    currentUser: window.realTime.currentUser,
                    serverUrl: window.realTime.serverUrl,
                    roomId: window.realTime.roomId
                });
            };
        }
    }, 1000); // Give app.js time to load
});

// Override app.js functions to emit events
function setupRealtimeHooks() {
    if (window.appInstance && window.realTime) {
        console.log('🔗 Setting up real-time hooks for app.js functions');
        
        // Store original functions
        const originalFunctions = {
            addSharedExpense: window.appInstance.addSharedExpense,
            addPersonalDebt: window.appInstance.addPersonalDebt,
            confirmDelete: window.appInstance.confirmDelete,
            settlePersonalDebt: window.appInstance.settlePersonalDebt,
            resetAllData: window.appInstance.resetAllData,
            calculateSettlements: window.appInstance.calculateSettlements
        };
        
        // Override addSharedExpense
        window.appInstance.addSharedExpense = function() {
            const result = originalFunctions.addSharedExpense.apply(this, arguments);
            
            if (result !== false && this.sharedExpenses.length > 0) {
                const expense = this.sharedExpenses[this.sharedExpenses.length - 1];
                window.realTime.emitEvent('add-expense', { expense: expense });
            }
            
            return result;
        };
        
        // Override addPersonalDebt
        window.appInstance.addPersonalDebt = function() {
            const result = originalFunctions.addPersonalDebt.apply(this, arguments);
            
            if (result !== false && this.personalDebts.length > 0) {
                const debt = this.personalDebts[this.personalDebts.length - 1];
                window.realTime.emitEvent('add-personal-debt', { debt: debt });
            }
            
            return result;
        };
        
        // Override confirmDelete
        window.appInstance.confirmDelete = function() {
            const itemToDelete = this.itemToDelete;
            const deleteType = this.deleteType;
            
            const result = originalFunctions.confirmDelete.apply(this, arguments);
            
            if (result !== false && itemToDelete && deleteType) {
                window.realTime.emitEvent('delete-item', { 
                    itemId: itemToDelete, 
                    itemType: deleteType 
                });
            }
            
            return result;
        };
        
        // Override settlePersonalDebt
        window.appInstance.settlePersonalDebt = function(debtId) {
            const result = originalFunctions.settlePersonalDebt.apply(this, arguments);
            
            if (result !== false) {
                window.realTime.emitEvent('settle-debt', { debtId: debtId });
            }
            
            return result;
        };
        
        // Override resetAllData
        window.appInstance.resetAllData = function() {
            const result = originalFunctions.resetAllData.apply(this, arguments);
            
            if (result !== false) {
                window.realTime.emitEvent('reset-data', {});
            }
            
            return result;
        };
        
        // Override calculateSettlements
        window.appInstance.calculateSettlements = function() {
            const result = originalFunctions.calculateSettlements.apply(this, arguments);
            
            if (result !== false && this.settlements) {
                window.realTime.emitEvent('calculate-settlements', { 
                    settlements: this.settlements 
                });
            }
            
            return result;
        };
        
        console.log('✅ Real-time hooks installed');
    } else {
        console.warn('⚠️ Cannot setup hooks: appInstance or realTime not available');
    }
}

// Try to setup hooks after a delay
setTimeout(setupRealtimeHooks, 2000);
