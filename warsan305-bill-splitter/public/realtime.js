// Real-time collaboration functionality
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
            
            // Update local data with server data
            if (data.expenses) {
                window.expenses = data.expenses;
                updateExpenseList();
            }
            
            if (data.personalDebts) {
                window.personalDebts = data.personalDebts;
                updateDebtList();
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
            
            // Add to local expenses if not already present
            if (!window.expenses.some(e => e.id === expense.id)) {
                window.expenses.unshift(expense);
                updateExpenseList();
                updateTotalSummary();
                
                this.showNotification(`${data.addedBy} added expense: ${expense.name}`);
            }
        });
        
        this.socket.on('debt-added', (data) => {
            const debt = data.debt;
            
            if (!window.personalDebts.some(d => d.id === debt.id)) {
                window.personalDebts.unshift(debt);
                updateDebtList();
                updateTotalSummary();
                
                this.showNotification(`${data.addedBy} added personal debt: ${debt.description}`);
            }
        });
        
        this.socket.on('item-deleted', (data) => {
            if (data.itemType === 'expense') {
                const index = window.expenses.findIndex(e => e.id === data.itemId);
                if (index !== -1) {
                    window.expenses.splice(index, 1);
                    updateExpenseList();
                    updateTotalSummary();
                }
            } else if (data.itemType === 'debt') {
                const index = window.personalDebts.findIndex(d => d.id === data.itemId);
                if (index !== -1) {
                    window.personalDebts.splice(index, 1);
                    updateDebtList();
                    updateTotalSummary();
                }
            }
        });
        
        this.socket.on('debt-settled', (data) => {
            const debt = window.personalDebts.find(d => d.id === data.debtId);
            if (debt) {
                debt.status = 'settled';
                updateDebtList();
            }
        });
        
        this.socket.on('data-reset', (data) => {
            window.expenses = [];
            window.personalDebts = [];
            
            updateExpenseList();
            updateDebtList();
            updateTotalSummary();
            
            this.showNotification(`${data.resetBy} reset all data`);
        });
        
        this.socket.on('new-activity', (activity) => {
            this.addActivityToFeed(activity);
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
                        ${this.currentUser.charAt(0)}
                    </div>
                    <div>
                        <strong>${this.currentUser} (You)</strong>
                    </div>
                </li>
            `;
            
            // Add other users
            users.forEach(user => {
                userListElement.innerHTML += `
                    <li id="user-${user.id}">
                        <div class="user-avatar" style="background-color: ${user.color}">
                            ${user.name.charAt(0)}
                        </div>
                        <div>
                            <strong>${user.name}</strong>
                            ${user.isTyping ? '<span class="user-typing">is typing...</span>' : ''}
                        </div>
                    </li>
                `;
            });
            
            // Show/hide active users panel
            const activeUsersPanel = document.getElementById('active-users');
            if (users.length > 0) {
                activeUsersPanel.style.display = 'block';
            }
        }
    }
    
    addUserToList(user) {
        const userListElement = document.getElementById('user-list');
        if (userListElement) {
            userListElement.innerHTML += `
                <li id="user-${user.id}">
                    <div class="user-avatar" style="background-color: ${user.color}">
                        ${user.name.charAt(0)}
                    </div>
                    <div>
                        <strong>${user.name}</strong>
                    </div>
                </li>
            `;
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
            activityFeed.scrollTop = activityFeed.scrollHeight;
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
            activityFeed.scrollTop = activityFeed.scrollHeight;
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
        // Override existing functions to emit socket events
        
        // Override addExpense function
        const originalAddExpense = window.addExpense;
        window.addExpense = () => {
            const type = document.getElementById('expense-type').value;
            const name = document.getElementById('expense-name').value.trim();
            const amount = parseFloat(document.getElementById('expense-amount').value);
            const invoiceDate = document.getElementById('invoice-date').value;
            const paidBy = document.getElementById('paid-by').value;
            
            // Validate input
            if (!name || isNaN(amount) || amount <= 0) {
                alert('Please enter a valid expense name and amount');
                return;
            }
            
            if (!invoiceDate) {
                alert('Please select an invoice date');
                return;
            }
            
            // Create expense object
            const expense = {
                type: type,
                name: name,
                amount: amount,
                invoiceDate: invoiceDate,
                formattedDate: formatDate(invoiceDate),
                paidBy: paidBy,
                entryDate: new Date().toLocaleDateString()
            };
            
            // Emit to server
            if (this.socket && this.isConnected) {
                this.socket.emit('add-expense', {
                    roomId: this.roomId,
                    expense: expense,
                    userName: this.currentUser
                });
            } else {
                // Fallback to original function
                originalAddExpense();
            }
            
            // Clear form
            document.getElementById('expense-name').value = '';
            document.getElementById('expense-amount').value = '';
            document.getElementById('expense-name').focus();
            
            // Reset date to today
            setDefaultDate();
        };
        
        // Override addPersonalDebt function
        const originalAddPersonalDebt = window.addPersonalDebt;
        window.addPersonalDebt = () => {
            const from = document.getElementById('debt-from').value;
            const to = document.getElementById('debt-to').value;
            const amount = parseFloat(document.getElementById('debt-amount').value);
            const description = document.getElementById('debt-description').value.trim();
            const date = document.getElementById('debt-date').value;
            const notes = document.getElementById('debt-notes').value.trim();
            
            // Validate input
            if (from === to) {
                alert('The debtor and creditor cannot be the same person');
                return;
            }
            
            if (!description || isNaN(amount) || amount <= 0) {
                alert('Please enter a valid description and amount');
                return;
            }
            
            if (!date) {
                alert('Please select a date');
                return;
            }
            
            // Create debt object
            const debt = {
                from: from,
                to: to,
                amount: amount,
                description: description,
                date: date,
                formattedDate: formatDate(date),
                notes: notes,
                status: 'pending',
                entryDate: new Date().toLocaleDateString()
            };
            
            // Emit to server
            if (this.socket && this.isConnected) {
                this.socket.emit('add-personal-debt', {
                    roomId: this.roomId,
                    debt: debt,
                    userName: this.currentUser
                });
            } else {
                // Fallback to original function
                originalAddPersonalDebt();
            }
            
            // Clear form
            document.getElementById('debt-description').value = '';
            document.getElementById('debt-amount').value = '';
            document.getElementById('debt-notes').value = '';
            document.getElementById('debt-description').focus();
            
            // Reset date to today
            setDefaultDebtDate();
        };
        
        // Override deleteItem function
        const originalDeleteItem = window.deleteItem;
        window.deleteItem = () => {
            if (!itemToDelete || !itemTypeToDelete) return;
            
            // Emit to server
            if (this.socket && this.isConnected) {
                this.socket.emit('delete-item', {
                    roomId: this.roomId,
                    itemId: itemToDelete,
                    itemType: itemTypeToDelete,
                    userName: this.currentUser
                });
            } else {
                // Fallback to original function
                originalDeleteItem();
            }
            
            hideDeleteConfirmation();
        };
        
        // Override settleDebt function
        const originalSettleDebt = window.settleDebt;
        window.settleDebt = (debtId) => {
            // Emit to server
            if (this.socket && this.isConnected) {
                this.socket.emit('settle-debt', {
                    roomId: this.roomId,
                    debtId: debtId,
                    userName: this.currentUser
                });
            } else {
                // Fallback to original function
                originalSettleDebt(debtId);
            }
        };
        
        // Override resetAllData function
        const originalResetAllData = window.resetAllData;
        window.resetAllData = () => {
            // Emit to server
            if (this.socket && this.isConnected) {
                this.socket.emit('reset-data', {
                    roomId: this.roomId,
                    userName: this.currentUser
                });
            } else {
                // Fallback to original function
                originalResetAllData();
            }
            
            hideResetConfirmation();
        };
        
        // Typing indicators for input fields
        const expenseInputs = document.querySelectorAll('#shared-expense-tab input, #shared-expense-tab textarea');
        const debtInputs = document.querySelectorAll('#personal-debt-tab input, #personal-debt-tab textarea');
        
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

// Initialize real-time collaboration when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.realTime = new RealTimeCollaboration();
});