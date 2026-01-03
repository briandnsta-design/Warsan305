// app.js - Warsan 305 Bill Splitter Core Logic

document.addEventListener('DOMContentLoaded', function() {
    // ============ CONFIGURATION ============
    const ROOMMATES = ['Abdi', 'Ali', 'Mohamed', 'Hassan', 'Omar', 'Khalid', 'Ahmed'];
    const ROOM_ID = 'warsan-305';
    
    // ============ STATE MANAGEMENT ============
    let expenses = JSON.parse(localStorage.getItem('warsan305_expenses')) || [];
    let currentUser = localStorage.getItem('warsan305_user') || 
                     ROOMMATES[Math.floor(Math.random() * ROOMMATES.length)];
    let currentUserId = localStorage.getItem('warsan305_userId') || 
                       'user-' + Math.random().toString(36).substr(2, 9);
    
    // ============ DOM ELEMENTS ============
    const expenseList = document.getElementById('expense-list');
    const debtList = document.getElementById('debt-list');
    const totalExpensesEl = document.getElementById('total-expenses');
    const addExpenseBtn = document.getElementById('add-expense-btn');
    const settleUpBtn = document.getElementById('settle-up-btn');
    const expenseModal = document.getElementById('expense-modal');
    const settleModal = document.getElementById('settle-modal');
    const addExpenseForm = document.getElementById('add-expense-form');
    const settleForm = document.getElementById('settle-form');
    const closeButtons = document.querySelectorAll('.close-btn');
    const overlay = document.querySelector('.overlay');
    const userSelection = document.getElementById('user-selection');
    const expenseDescription = document.getElementById('expense-description');
    const expenseAmount = document.getElementById('expense-amount');
    const splitMethod = document.getElementById('split-method');
    const roommateCheckboxes = document.querySelectorAll('.roommate-checkbox');
    const currentUserSpan = document.getElementById('current-user');
    const userNameInput = document.getElementById('user-name');
    
    // Activity feed elements
    const activityList = document.getElementById('activity-list');
    const userList = document.getElementById('user-list');
    const activeUsersPanel = document.getElementById('active-users');
    
    // ============ INITIALIZATION ============
    function init() {
        // Set current user
        currentUserSpan.textContent = currentUser;
        
        // Populate user selection dropdown
        ROOMMATES.forEach(roommate => {
            const option = document.createElement('option');
            option.value = roommate;
            option.textContent = roommate;
            if (roommate === currentUser) option.selected = true;
            userSelection.appendChild(option);
        });
        
        // Load and render data
        renderExpenses();
        calculateDebts();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize UI state
        updateSplitOptions();
        checkSettleButton();
        
        // Save user info if not already saved
        if (!localStorage.getItem('warsan305_user')) {
            localStorage.setItem('warsan305_user', currentUser);
            localStorage.setItem('warsan305_userId', currentUserId);
        }
        
        // Add welcome activity
        addActivity(`${currentUser} joined the room`);
    }
    
    // ============ EVENT LISTENERS ============
    function setupEventListeners() {
        // Add Expense button
        addExpenseBtn.addEventListener('click', () => {
            expenseModal.style.display = 'block';
            overlay.style.display = 'block';
        });
        
        // Settle Up button
        settleUpBtn.addEventListener('click', () => {
            settleModal.style.display = 'block';
            populateSettleForm();
            overlay.style.display = 'block';
        });
        
        // Close buttons
        closeButtons.forEach(btn => {
            btn.addEventListener('click', closeModals);
        });
        
        // Overlay click to close
        overlay.addEventListener('click', closeModals);
        
        // Add Expense form submission
        addExpenseForm.addEventListener('submit', addExpense);
        
        // Settle form submission
        settleForm.addEventListener('submit', settleDebt);
        
        // Split method change
        splitMethod.addEventListener('change', updateSplitOptions);
        
        // Roommate checkboxes
        roommateCheckboxes.forEach(cb => {
            cb.addEventListener('change', updateSelectedCount);
        });
        
        // Expense amount input validation
        expenseAmount.addEventListener('input', validateAmount);
        
        // User name change
        userNameInput.addEventListener('change', updateUserName);
        
        // Typing indicators for real-time
        expenseDescription.addEventListener('input', () => {
            if (window.realtime && window.realtime.sendTypingIndicator) {
                window.realtime.sendTypingIndicator(true);
            }
        });
        
        // Show active users panel on click
        document.querySelector('header h1').addEventListener('click', () => {
            activeUsersPanel.style.display = 
                activeUsersPanel.style.display === 'block' ? 'none' : 'block';
        });
    }
    
    // ============ EXPENSE MANAGEMENT ============
    function addExpense(e) {
        e.preventDefault();
        
        const payer = userSelection.value;
        const description = expenseDescription.value.trim();
        const amount = parseFloat(expenseAmount.value);
        const splitType = splitMethod.value;
        
        // Validation
        if (!description || !amount || amount <= 0) {
            alert('Please enter valid expense details');
            return;
        }
        
        // Get selected roommates
        const selectedRoommates = [];
        const checkboxes = document.querySelectorAll('.roommate-checkbox:checked');
        
        if (checkboxes.length === 0) {
            alert('Please select at least one roommate to split with');
            return;
        }
        
        checkboxes.forEach(cb => {
            selectedRoommates.push(cb.value);
        });
        
        // Create expense object
        const expense = {
            id: Date.now().toString(),
            payer: payer,
            description: description,
            amount: amount,
            date: new Date().toISOString(),
            splitType: splitType,
            splitWith: selectedRoommates,
            createdBy: currentUser,
            createdAt: new Date().toISOString()
        };
        
        // Add to expenses array
        expenses.push(expense);
        
        // Save to localStorage
        saveExpenses();
        
        // Re-render UI
        renderExpenses();
        calculateDebts();
        
        // Reset form
        addExpenseForm.reset();
        updateSplitOptions();
        
        // Close modal
        closeModals();
        
        // Add activity
        addActivity(`${currentUser} added expense: ${description} ($${amount.toFixed(2)})`);
        
        // Send real-time update
        if (window.realtime && window.realtime.sendExpenseUpdate) {
            window.realtime.sendExpenseUpdate({
                type: 'expense_added',
                expense: expense,
                user: currentUser
            });
        }
    }
    
    function renderExpenses() {
        if (!expenseList) return;
        
        expenseList.innerHTML = '';
        
        if (expenses.length === 0) {
            expenseList.innerHTML = '<div class="empty-state">No expenses yet. Add one to get started!</div>';
            totalExpensesEl.textContent = '0.00';
            return;
        }
        
        let total = 0;
        
        // Sort expenses by date (newest first)
        const sortedExpenses = [...expenses].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        sortedExpenses.forEach(expense => {
            total += expense.amount;
            
            const expenseEl = document.createElement('div');
            expenseEl.className = 'expense-item';
            expenseEl.innerHTML = `
                <div class="expense-header">
                    <span class="expense-description">${expense.description}</span>
                    <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                </div>
                <div class="expense-details">
                    <span class="expense-payer"><i class="fas fa-user"></i> Paid by ${expense.payer}</span>
                    <span class="expense-date"><i class="fas fa-calendar"></i> ${formatDate(expense.date)}</span>
                    <span class="expense-split"><i class="fas fa-users"></i> Split with ${expense.splitWith.length}</span>
                </div>
                <div class="expense-actions">
                    <button class="action-btn delete-btn" data-id="${expense.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            
            expenseList.appendChild(expenseEl);
        });
        
        // Update total
        totalExpensesEl.textContent = total.toFixed(2);
        
        // Add delete event listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const expenseId = this.getAttribute('data-id');
                deleteExpense(expenseId);
            });
        });
    }
    
    function deleteExpense(expenseId) {
        if (confirm('Are you sure you want to delete this expense?')) {
            const expense = expenses.find(e => e.id === expenseId);
            expenses = expenses.filter(e => e.id !== expenseId);
            
            saveExpenses();
            renderExpenses();
            calculateDebts();
            
            // Add activity
            addActivity(`${currentUser} deleted expense: ${expense.description}`);
            
            // Send real-time update
            if (window.realtime && window.realtime.sendExpenseUpdate) {
                window.realtime.sendExpenseUpdate({
                    type: 'expense_deleted',
                    expenseId: expenseId,
                    user: currentUser
                });
            }
        }
    }
    
    // ============ DEBT CALCULATION ============
    function calculateDebts() {
        if (!debtList) return;
        
        // Initialize balances
        const balances = {};
        ROOMMATES.forEach(roommate => {
            balances[roommate] = 0;
        });
        
        // Calculate balances
        expenses.forEach(expense => {
            const payer = expense.payer;
            const amount = expense.amount;
            const splitWith = expense.splitWith;
            
            if (splitWith.length === 0) return;
            
            const share = amount / splitWith.length;
            
            // Payer gets positive balance (money to receive)
            balances[payer] += amount;
            
            // Each split person gets negative balance (money to pay)
            splitWith.forEach(person => {
                if (person !== payer) { // Don't pay yourself
                    balances[person] -= share;
                } else {
                    // If payer is also in split, they effectively pay less
                    balances[payer] -= share;
                }
            });
        });
        
        // Calculate debts
        const debts = [];
        const debtors = [];
        const creditors = [];
        
        // Separate debtors and creditors
        Object.entries(balances).forEach(([person, balance]) => {
            if (balance < 0) {
                debtors.push({ person, amount: Math.abs(balance) });
            } else if (balance > 0) {
                creditors.push({ person, amount: balance });
            }
        });
        
        // Match debtors to creditors
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);
        
        let dIdx = 0, cIdx = 0;
        
        while (dIdx < debtors.length && cIdx < creditors.length) {
            const debtor = debtors[dIdx];
            const creditor = creditors[cIdx];
            
            const debtAmount = Math.min(debtor.amount, creditor.amount);
            
            if (debtAmount > 0.01) { // Ignore tiny amounts
                debts.push({
                    from: debtor.person,
                    to: creditor.person,
                    amount: debtAmount
                });
            }
            
            debtor.amount -= debtAmount;
            creditor.amount -= debtAmount;
            
            if (debtor.amount < 0.01) dIdx++;
            if (creditor.amount < 0.01) cIdx++;
        }
        
        // Render debts
        renderDebts(debts);
        checkSettleButton();
    }
    
    function renderDebts(debts) {
        debtList.innerHTML = '';
        
        if (debts.length === 0) {
            debtList.innerHTML = '<div class="empty-state">All settled up! No debts.</div>';
            return;
        }
        
        debts.forEach(debt => {
            const debtEl = document.createElement('div');
            debtEl.className = 'debt-item';
            debtEl.innerHTML = `
                <div class="debt-details">
                    <span class="debt-from"><i class="fas fa-arrow-right"></i> ${debt.from}</span>
                    <span class="debt-to"><i class="fas fa-arrow-right"></i> ${debt.to}</span>
                    <span class="debt-amount">$${debt.amount.toFixed(2)}</span>
                </div>
            `;
            debtList.appendChild(debtEl);
        });
    }
    
    // ============ SETTLE UP FUNCTIONALITY ============
    function populateSettleForm() {
        const settleTo = document.getElementById('settle-to');
        const settleAmount = document.getElementById('settle-amount');
        
        // Find debts involving current user
        const userDebts = [];
        
        // Simple calculation for demo - in reality, use the same logic as calculateDebts
        const settleOptions = document.getElementById('settle-options');
        settleOptions.innerHTML = '';
        
        // Add option for each roommate (except self)
        ROOMMATES.forEach(roommate => {
            if (roommate !== currentUser) {
                const option = document.createElement('option');
                option.value = roommate;
                option.textContent = roommate;
                settleOptions.appendChild(option);
            }
        });
        
        settleTo.value = ROOMMATES.find(r => r !== currentUser) || ROOMMATES[0];
        settleAmount.value = '';
    }
    
    function settleDebt(e) {
        e.preventDefault();
        
        const to = document.getElementById('settle-to').value;
        const amount = parseFloat(document.getElementById('settle-amount').value);
        const description = document.getElementById('settle-description').value || 'Settlement';
        
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        
        // Create settlement as a negative expense
        const settlement = {
            id: 'settle-' + Date.now(),
            payer: currentUser,
            description: `Settlement: ${description}`,
            amount: -amount,
            date: new Date().toISOString(),
            splitType: 'equal',
            splitWith: [to],
            createdBy: currentUser,
            createdAt: new Date().toISOString(),
            isSettlement: true
        };
        
        expenses.push(settlement);
        saveExpenses();
        
        // Recalculate
        renderExpenses();
        calculateDebts();
        
        // Close modal
        closeModals();
        
        // Add activity
        addActivity(`${currentUser} settled $${amount.toFixed(2)} with ${to}`);
        
        // Send real-time update
        if (window.realtime && window.realtime.sendExpenseUpdate) {
            window.realtime.sendExpenseUpdate({
                type: 'settlement',
                from: currentUser,
                to: to,
                amount: amount,
                user: currentUser
            });
        }
    }
    
    function checkSettleButton() {
        if (!settleUpBtn) return;
        
        // Enable/disable based on whether there are debts
        const hasDebts = debtList && !debtList.querySelector('.empty-state');
        settleUpBtn.disabled = !hasDebts;
        settleUpBtn.title = hasDebts ? 'Settle debts' : 'No debts to settle';
    }
    
    // ============ UI HELPER FUNCTIONS ============
    function updateSplitOptions() {
        const splitType = splitMethod.value;
        const checkboxesContainer = document.querySelector('.roommate-checkboxes');
        
        if (splitType === 'equal') {
            // Auto-check all roommates
            roommateCheckboxes.forEach(cb => {
                cb.checked = true;
                cb.disabled = false;
            });
        } else if (splitType === 'custom') {
            // Enable all checkboxes
            roommateCheckboxes.forEach(cb => {
                cb.disabled = false;
            });
        }
        
        updateSelectedCount();
    }
    
    function updateSelectedCount() {
        const selectedCount = document.querySelectorAll('.roommate-checkbox:checked').length;
        const countDisplay = document.getElementById('selected-count') || 
                           (() => {
                               const span = document.createElement('span');
                               span.id = 'selected-count';
                               document.querySelector('.split-section').appendChild(span);
                               return span;
                           })();
        
        countDisplay.textContent = ` (${selectedCount} selected)`;
        countDisplay.style.marginLeft = '5px';
        countDisplay.style.color = 'var(--primary-color)';
    }
    
    function validateAmount() {
        const value = expenseAmount.value;
        if (value && parseFloat(value) < 0) {
            expenseAmount.value = Math.abs(parseFloat(value));
        }
    }
    
    function updateUserName() {
        const newName = userNameInput.value.trim();
        if (newName && ROOMMATES.includes(newName)) {
            const oldName = currentUser;
            currentUser = newName;
            currentUserSpan.textContent = newName;
            
            localStorage.setItem('warsan305_user', newName);
            
            // Add activity
            addActivity(`${oldName} changed name to ${newName}`);
            
            // Update all expenses by this user
            expenses.forEach(expense => {
                if (expense.createdBy === oldName) {
                    expense.createdBy = newName;
                }
                if (expense.payer === oldName) {
                    expense.payer = newName;
                }
                expense.splitWith = expense.splitWith.map(p => 
                    p === oldName ? newName : p
                );
            });
            
            saveExpenses();
            renderExpenses();
            calculateDebts();
        } else {
            alert('Please select a valid roommate name');
            userNameInput.value = currentUser;
        }
    }
    
    function closeModals() {
        expenseModal.style.display = 'none';
        settleModal.style.display = 'none';
        overlay.style.display = 'none';
    }
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    function saveExpenses() {
        localStorage.setItem('warsan305_expenses', JSON.stringify(expenses));
    }
    
    // ============ ACTIVITY FEED ============
    function addActivity(message) {
        if (!activityList) return;
        
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div>${message}</div>
            <div class="activity-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        
        activityList.prepend(activityItem);
        
        // Keep only last 20 activities
        const activities = activityList.querySelectorAll('.activity-item');
        if (activities.length > 20) {
            activities[activities.length - 1].remove();
        }
    }
    
    // ============ REAL-TIME INTEGRATION ============
    // These functions will be called by realtime.js
    window.updateExpensesFromServer = function(newExpenses) {
        expenses = newExpenses;
        saveExpenses();
        renderExpenses();
        calculateDebts();
    };
    
    window.addServerActivity = function(activity) {
        addActivity(activity);
    };
    
    window.updateActiveUsers = function(users) {
        if (!userList) return;
        
        userList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            const firstLetter = user.name.charAt(0).toUpperCase();
            const color = stringToColor(user.name);
            
            li.innerHTML = `
                <div class="user-avatar" style="background-color: ${color}">${firstLetter}</div>
                <div>
                    <strong>${user.name}</strong>
                    ${user.isTyping ? '<span class="user-typing">typing...</span>' : ''}
                </div>
            `;
            userList.appendChild(li);
        });
    };
    
    // Helper function to generate color from string
    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
            '#9b59b6', '#1abc9c', '#d35400'
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    // ============ INITIALIZE APP ============
    init();
    
    // Make currentUser available globally for realtime.js
    window.currentUser = currentUser;
    window.currentUserId = currentUserId;
});