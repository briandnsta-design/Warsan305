// app.js - Warsan 305 Bill Splitter Core Logic (Fixed Version with Real-time)

document.addEventListener('DOMContentLoaded', function() {
    // ============ CONFIGURATION ============
    const ROOMMATES = {
        person1: 'Brian',
        person2: 'Tessa', 
        person3: 'Robert',
        person4: 'Hershey',
        person5: 'Wilson',
        person6: 'Joselle',
        person7: 'Chona'
    };
    
    const ROOMMATE_IDS = Object.keys(ROOMMATES);
    const ROOMMATE_NAMES = Object.values(ROOMMATES);
    
    // ============ STATE MANAGEMENT ============
    let sharedExpenses = JSON.parse(localStorage.getItem('warsan305_sharedExpenses')) || [];
    let personalDebts = JSON.parse(localStorage.getItem('warsan305_personalDebts')) || [];
    let settlements = [];
    
    // ============ DOM ELEMENTS ============
    // Shared Expense Elements
    const expenseType = document.getElementById('expense-type');
    const expenseName = document.getElementById('expense-name');
    const expenseAmount = document.getElementById('expense-amount');
    const invoiceDate = document.getElementById('invoice-date');
    const todayBtn = document.getElementById('today-btn');
    const paidBy = document.getElementById('paid-by');
    const addExpenseBtn = document.getElementById('add-expense-btn');
    
    // Personal Debt Elements
    const debtFrom = document.getElementById('debt-from');
    const debtTo = document.getElementById('debt-to');
    const debtAmount = document.getElementById('debt-amount');
    const debtDescription = document.getElementById('debt-description');
    const debtDate = document.getElementById('debt-date');
    const debtTodayBtn = document.getElementById('debt-today-btn');
    const debtNotes = document.getElementById('debt-notes');
    const addDebtBtn = document.getElementById('add-debt-btn');
    
    // Display Elements
    const expenseList = document.getElementById('expense-list');
    const debtList = document.getElementById('debt-list');
    const settlementContainer = document.getElementById('settlement-container');
    const circularDebtSection = document.getElementById('circular-debt-section');
    const debtMatrixContainer = document.getElementById('debt-matrix-container');
    
    // Balance Elements
    const balanceElements = {
        person1: document.getElementById('balance1'),
        person2: document.getElementById('balance2'),
        person3: document.getElementById('balance3'),
        person4: document.getElementById('balance4'),
        person5: document.getElementById('balance5'),
        person6: document.getElementById('balance6'),
        person7: document.getElementById('balance7')
    };
    
    // Summary Elements
    const totalExpensesEl = document.getElementById('total-expenses');
    const totalPersonalDebtsEl = document.getElementById('total-personal-debts');
    const sharePerPersonEl = document.getElementById('share-per-person');
    
    // Button Elements
    const calculateBtn = document.getElementById('calculate-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    // Tab Elements
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Confirmation Dialogs
    const resetConfirmation = document.getElementById('reset-confirmation');
    const deleteConfirmation = document.getElementById('delete-confirmation');
    const deleteOverlay = document.getElementById('delete-overlay');
    const confirmResetBtn = document.getElementById('confirm-reset-btn');
    const cancelResetBtn = document.getElementById('cancel-reset-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    
    // Delete State
    let itemToDelete = null;
    let deleteType = null; // 'expense' or 'debt'
    
    // ============ INITIALIZATION ============
    function init() {
        // Set today's date
        setTodayDate();
        
        // Load and render data
        renderExpenses();
        renderPersonalDebts();
        calculateBalances();
        
        // Set up event listeners
        setupEventListeners();
        
        // Setup auto-save indicator
        setupAutoSaveIndicator();
        
        // Expose functions to global scope for realtime.js
        exposeToGlobalScope();
    }
    
    function setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        invoiceDate.value = today;
        debtDate.value = today;
    }
    
    // ============ EVENT LISTENERS ============
    function setupEventListeners() {
        // Today buttons
        todayBtn.addEventListener('click', () => {
            invoiceDate.value = new Date().toISOString().split('T')[0];
        });
        
        debtTodayBtn.addEventListener('click', () => {
            debtDate.value = new Date().toISOString().split('T')[0];
        });
        
        // Add Expense button
        addExpenseBtn.addEventListener('click', addSharedExpense);
        
        // Add Debt button
        addDebtBtn.addEventListener('click', addPersonalDebt);
        
        // Calculate button
        calculateBtn.addEventListener('click', calculateSettlements);
        
        // Reset button
        resetBtn.addEventListener('click', showResetConfirmation);
        
        // Reset confirmation buttons
        confirmResetBtn.addEventListener('click', resetAllData);
        cancelResetBtn.addEventListener('click', hideResetConfirmation);
        
        // Delete confirmation buttons
        confirmDeleteBtn.addEventListener('click', confirmDelete);
        cancelDeleteBtn.addEventListener('click', hideDeleteConfirmation);
        
        // Tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
        
        // Form submission on Enter key
        expenseName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addSharedExpense();
        });
        
        debtDescription.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPersonalDebt();
        });
        
        // Backward compatibility for realtime.js
        setupRealtimeCompatibility();
    }
    
    function setupRealtimeCompatibility() {
        // Expose global functions for backward compatibility
        window.addExpense = addSharedExpense;
        window.addPersonalDebt = addPersonalDebt;
        window.calculateSettlements = calculateSettlements;
        window.resetAllData = resetAllData;
        window.settleDebt = settlePersonalDebt;
        window.deleteItem = confirmDelete;
        window.hideDeleteConfirmation = hideDeleteConfirmation;
        window.hideResetConfirmation = hideResetConfirmation;
        
        // Expose variables for realtime.js
        window.expenses = sharedExpenses;
        window.personalDebts = personalDebts;
        window.itemToDelete = itemToDelete;
        window.itemTypeToDelete = deleteType;
    }
    
    // ============ TAB MANAGEMENT ============
    function switchTab(tabId) {
        // Update active tab
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-tab') === tabId) {
                tab.classList.add('active');
            }
        });
        
        // Show active content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabId}-tab`) {
                content.classList.add('active');
            }
        });
    }
    
    // ============ SHARED EXPENSE MANAGEMENT ============
    function addSharedExpense() {
        // Get form values
        const type = expenseType.value;
        const name = expenseName.value.trim();
        const amount = parseFloat(expenseAmount.value);
        const date = invoiceDate.value;
        const paidByValue = paidBy.value;
        
        // Validation
        if (!name) {
            alert('Please enter an expense name');
            expenseName.focus();
            return;
        }
        
        if (!amount || amount <= 0 || isNaN(amount)) {
            alert('Please enter a valid amount');
            expenseAmount.focus();
            return;
        }
        
        if (!date) {
            alert('Please select a date');
            invoiceDate.focus();
            return;
        }
        
        // Create expense object
        const expense = {
            id: Date.now(),
            type: type,
            name: name,
            amount: amount,
            date: date,
            paidBy: paidByValue,
            paidByName: ROOMMATES[paidByValue],
            createdAt: new Date().toISOString()
        };
        
        // Add to expenses array
        sharedExpenses.push(expense);
        
        // Save to localStorage
        saveData();
        
        // Update UI
        renderExpenses();
        calculateBalances();
        
        // Reset form
        expenseName.value = '';
        expenseAmount.value = '';
        
        // Show success message
        showAutoSaveIndicator('Expense added successfully!');
        
        // Add to activity feed
        addActivity(`Added shared expense: ${name} ($${amount.toFixed(2)})`);
        
        // Emit to server if real-time is active
        if (window.realTime && window.realTime.socket && window.realTime.isConnected) {
            window.realTime.socket.emit('add-expense', {
                roomId: 'warsan305',
                expense: expense,
                userName: window.realTime.currentUser || 'Anonymous'
            });
        }
    }
    
    function renderExpenses() {
        if (!expenseList) return;
        
        // Clear current list
        expenseList.innerHTML = '';
        
        if (sharedExpenses.length === 0) {
            expenseList.innerHTML = '<div class="no-expenses">No shared expenses added yet</div>';
            return;
        }
        
        // Sort by date (newest first)
        const sortedExpenses = [...sharedExpenses].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        // Render each expense
        sortedExpenses.forEach(expense => {
            const expenseItem = document.createElement('div');
            expenseItem.className = 'expense-item';
            expenseItem.dataset.id = expense.id;
            
            const formattedDate = new Date(expense.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            
            expenseItem.innerHTML = `
                <div class="expense-details">
                    <div class="expense-title">${expense.name}</div>
                    <div class="expense-meta">
                        <span>${formattedDate}</span>
                        <span>•</span>
                        <span>${expense.type}</span>
                        <span>•</span>
                        <span>Paid by ${expense.paidByName}</span>
                    </div>
                </div>
                <div class="expense-amount-container">
                    <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                    <button class="delete-btn" data-id="${expense.id}" data-type="expense">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            expenseList.appendChild(expenseItem);
        });
        
        // Add delete event listeners
        document.querySelectorAll('.expense-item .delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-id'));
                showDeleteConfirmation(id, 'expense');
            });
        });
    }
    
    // ============ PERSONAL DEBT MANAGEMENT ============
    function addPersonalDebt() {
        // Get form values
        const from = debtFrom.value;
        const to = debtTo.value;
        const amount = parseFloat(debtAmount.value);
        const description = debtDescription.value.trim();
        const date = debtDate.value;
        const notes = debtNotes.value.trim();
        
        // Validation
        if (from === to) {
            alert('The debtor and creditor cannot be the same person');
            return;
        }
        
        if (!description) {
            alert('Please enter a description');
            debtDescription.focus();
            return;
        }
        
        if (!amount || amount <= 0 || isNaN(amount)) {
            alert('Please enter a valid amount');
            debtAmount.focus();
            return;
        }
        
        if (!date) {
            alert('Please select a date');
            debtDate.focus();
            return;
        }
        
        // Create debt object
        const debt = {
            id: Date.now(),
            from: from,
            fromName: ROOMMATES[from],
            to: to,
            toName: ROOMMATES[to],
            amount: amount,
            description: description,
            date: date,
            notes: notes,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Add to debts array
        personalDebts.push(debt);
        
        // Save to localStorage
        saveData();
        
        // Update UI
        renderPersonalDebts();
        
        // Reset form
        debtDescription.value = '';
        debtAmount.value = '';
        debtNotes.value = '';
        
        // Show success message
        showAutoSaveIndicator('Personal debt added successfully!');
        
        // Add to activity feed
        addActivity(`Added personal debt: ${ROOMMATES[from]} owes ${ROOMMATES[to]} $${amount.toFixed(2)}`);
        
        // Emit to server if real-time is active
        if (window.realTime && window.realTime.socket && window.realTime.isConnected) {
            window.realTime.socket.emit('add-personal-debt', {
                roomId: 'warsan305',
                debt: debt,
                userName: window.realTime.currentUser || 'Anonymous'
            });
        }
    }
    
    function renderPersonalDebts() {
        if (!debtList) return;
        
        // Clear current list
        debtList.innerHTML = '';
        
        if (personalDebts.length === 0) {
            debtList.innerHTML = '<div class="no-debts">No personal debts added yet</div>';
            return;
        }
        
        // Sort by date (newest first)
        const sortedDebts = [...personalDebts].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        // Render each debt
        sortedDebts.forEach(debt => {
            const debtItem = document.createElement('div');
            debtItem.className = 'debt-item';
            debtItem.dataset.id = debt.id;
            
            const formattedDate = new Date(debt.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            
            const statusBadge = debt.status === 'settled' ? 
                '<span class="status-badge status-settled">Settled</span>' : 
                '<span class="status-badge status-pending">Pending</span>';
            
            debtItem.innerHTML = `
                <div class="debt-details">
                    <div class="debt-title">${debt.description}</div>
                    <div class="debt-meta">
                        <span>${formattedDate}</span>
                        <span>•</span>
                        <span>${debt.fromName} → ${debt.toName}</span>
                        ${debt.notes ? '<span>•</span><span>Note: ' + debt.notes + '</span>' : ''}
                    </div>
                </div>
                <div class="debt-amount-container">
                    <span class="debt-amount">$${debt.amount.toFixed(2)}</span>
                    ${debt.status === 'pending' ? 
                        `<button class="settle-debt-btn" data-id="${debt.id}">Settle</button>` : 
                        ''}
                    <button class="delete-btn" data-id="${debt.id}" data-type="debt">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            debtList.appendChild(debtItem);
        });
        
        // Add event listeners
        document.querySelectorAll('.debt-item .delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-id'));
                showDeleteConfirmation(id, 'debt');
            });
        });
        
        document.querySelectorAll('.settle-debt-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-id'));
                settlePersonalDebt(id);
            });
        });
    }
    
    // ============ BALANCE CALCULATION ============
    function calculateBalances() {
        // Reset all balances to 0
        const balances = {};
        ROOMMATE_IDS.forEach(id => {
            balances[id] = 0;
        });
        
        // Calculate from shared expenses
        sharedExpenses.forEach(expense => {
            const amount = expense.amount;
            const paidBy = expense.paidBy;
            
            // Each person owes 1/7 of the expense
            const sharePerPerson = amount / 7;
            
            // The payer paid the full amount, so they get credited
            balances[paidBy] += amount;
            
            // Everyone (including payer) owes their share
            ROOMMATE_IDS.forEach(id => {
                balances[id] -= sharePerPerson;
            });
        });
        
        // Calculate from personal debts
        personalDebts.forEach(debt => {
            if (debt.status === 'pending') {
                balances[debt.from] -= debt.amount;
                balances[debt.to] += debt.amount;
            }
        });
        
        // Update UI
        ROOMMATE_IDS.forEach(id => {
            const balance = balances[id];
            const element = balanceElements[id];
            if (element) {
                element.textContent = `$${balance.toFixed(2)}`;
                element.className = balance >= 0 ? 'positive' : 'negative';
            }
        });
        
        // Update summary
        updateSummary(balances);
    }
    
    function updateSummary(balances) {
        // Calculate totals
        const totalExpenses = sharedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalPersonalDebts = personalDebts
            .filter(debt => debt.status === 'pending')
            .reduce((sum, debt) => sum + debt.amount, 0);
        
        // Calculate share per person (from shared expenses only)
        const sharePerPerson = sharedExpenses.length > 0 ? totalExpenses / 7 : 0;
        
        // Update UI
        totalExpensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
        totalPersonalDebtsEl.textContent = `$${totalPersonalDebts.toFixed(2)}`;
        sharePerPersonEl.textContent = `$${sharePerPerson.toFixed(2)}`;
    }
    
    // ============ SETTLEMENT CALCULATION ============
    function calculateSettlements() {
        // First calculate balances
        const balances = {};
        ROOMMATE_IDS.forEach(id => {
            balances[id] = 0;
        });
        
        // Calculate from shared expenses
        sharedExpenses.forEach(expense => {
            const amount = expense.amount;
            const paidBy = expense.paidBy;
            
            const sharePerPerson = amount / 7;
            
            balances[paidBy] += amount;
            ROOMMATE_IDS.forEach(id => {
                balances[id] -= sharePerPerson;
            });
        });
        
        // Calculate from personal debts
        personalDebts.forEach(debt => {
            if (debt.status === 'pending') {
                balances[debt.from] -= debt.amount;
                balances[debt.to] += debt.amount;
            }
        });
        
        // Separate debtors and creditors
        const debtors = [];
        const creditors = [];
        
        ROOMMATE_IDS.forEach(id => {
            const balance = balances[id];
            if (balance < -0.01) { // Debtor (owes money)
                debtors.push({
                    id: id,
                    name: ROOMMATES[id],
                    amount: Math.abs(balance)
                });
            } else if (balance > 0.01) { // Creditor (owed money)
                creditors.push({
                    id: id,
                    name: ROOMMATES[id],
                    amount: balance
                });
            }
        });
        
        // Sort by amount (largest first)
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);
        
        // Calculate settlements
        settlements = [];
        let debtorIndex = 0;
        let creditorIndex = 0;
        
        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];
            
            const amountToSettle = Math.min(debtor.amount, creditor.amount);
            
            if (amountToSettle > 0.01) { // Only add if amount is significant
                settlements.push({
                    from: debtor.id,
                    fromName: debtor.name,
                    to: creditor.id,
                    toName: creditor.name,
                    amount: amountToSettle
                });
                
                // Update remaining amounts
                debtor.amount -= amountToSettle;
                creditor.amount -= amountToSettle;
            }
            
            // Move to next debtor/creditor if settled
            if (debtor.amount < 0.01) debtorIndex++;
            if (creditor.amount < 0.01) creditorIndex++;
        }
        
        // Update UI
        renderSettlements();
        renderDebtMatrix(balances);
        
        // Show circular debt section
        if (circularDebtSection) {
            circularDebtSection.style.display = 'block';
        }
        
        // Show success message
        showAutoSaveIndicator('Settlements calculated successfully!');
        
        // Add to activity feed
        addActivity('Calculated settlement plan');
        
        // Emit to server if real-time is active
        if (window.realTime && window.realTime.socket && window.realTime.isConnected) {
            window.realTime.socket.emit('calculate-settlements', {
                roomId: 'warsan305',
                settlements: settlements,
                userName: window.realTime.currentUser || 'Anonymous'
            });
        }
    }
    
    function renderSettlements() {
        if (!settlementContainer) return;
        
        // Clear current content
        settlementContainer.innerHTML = '';
        
        if (settlements.length === 0) {
            settlementContainer.innerHTML = '<p class="no-expenses">All balances are settled!</p>';
            return;
        }
        
        // Create settlement list
        const settlementList = document.createElement('ul');
        settlementList.className = 'settlement-list';
        
        settlements.forEach(settlement => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <i class="fas fa-arrow-right"></i>
                <strong>${settlement.fromName}</strong> should pay 
                <strong>${settlement.toName}</strong> 
                <strong>$${settlement.amount.toFixed(2)}</strong>
            `;
            settlementList.appendChild(listItem);
        });
        
        settlementContainer.appendChild(settlementList);
        
        // Add summary
        const totalSettlement = settlements.reduce((sum, s) => sum + s.amount, 0);
        const summary = document.createElement('div');
        summary.className = 'settlement-summary';
        summary.innerHTML = `
            <p><strong>Total to be transferred:</strong> $${totalSettlement.toFixed(2)}</p>
            <p><strong>Number of transactions:</strong> ${settlements.length}</p>
            <p>This minimizes the total number of payments needed to settle all balances.</p>
        `;
        settlementContainer.appendChild(summary);
    }
    
    function renderDebtMatrix(balances) {
        if (!debtMatrixContainer) return;
        
        // Create matrix table
        let tableHTML = `
            <table class="debt-matrix">
            <thead>
                <tr>
                    <th></th>
        `;
        
        // Header row with names
        ROOMMATE_IDS.forEach(id => {
            tableHTML += `<th>${ROOMMATES[id]}</th>`;
        });
        
        tableHTML += '</tr></thead><tbody>';
        
        // Create matrix rows
        ROOMMATE_IDS.forEach(fromId => {
            tableHTML += `<tr><th>${ROOMMATES[fromId]}</th>`;
            
            ROOMMATE_IDS.forEach(toId => {
                if (fromId === toId) {
                    tableHTML += '<td class="diagonal-cell">-</td>';
                } else {
                    // Calculate net debt between these two people
                    let netDebt = 0;
                    
                    // Check personal debts
                    personalDebts.forEach(debt => {
                        if (debt.status === 'pending') {
                            if (debt.from === fromId && debt.to === toId) {
                                netDebt -= debt.amount; // from owes to
                            } else if (debt.from === toId && debt.to === fromId) {
                                netDebt += debt.amount; // to owes from
                            }
                        }
                    });
                    
                    // Format cell
                    if (Math.abs(netDebt) < 0.01) {
                        tableHTML += '<td>$0.00</td>';
                    } else if (netDebt > 0) {
                        tableHTML += `<td class="debt-cell positive">$${netDebt.toFixed(2)}</td>`;
                    } else {
                        tableHTML += `<td class="debt-cell negative">$${Math.abs(netDebt).toFixed(2)}</td>`;
                    }
                }
            });
            
            tableHTML += '</tr>';
        });
        
        tableHTML += '</tbody></table>';
        debtMatrixContainer.innerHTML = tableHTML;
    }
    
    // ============ PERSONAL DEBT FUNCTIONS ============
    function settlePersonalDebt(debtId) {
        const debtIndex = personalDebts.findIndex(d => d.id === debtId);
        if (debtIndex !== -1) {
            personalDebts[debtIndex].status = 'settled';
            personalDebts[debtIndex].settledAt = new Date().toISOString();
            
            saveData();
            renderPersonalDebts();
            calculateBalances();
            
            // Add to activity feed
            const debt = personalDebts[debtIndex];
            addActivity(`${debt.fromName} settled debt of $${debt.amount.toFixed(2)} with ${debt.toName}`);
            
            // Emit to server if real-time is active
            if (window.realTime && window.realTime.socket && window.realTime.isConnected) {
                window.realTime.socket.emit('settle-debt', {
                    roomId: 'warsan305',
                    debtId: debtId,
                    userName: window.realTime.currentUser || 'Anonymous'
                });
            }
        }
    }
    
    // ============ DELETE FUNCTIONALITY ============
    function showDeleteConfirmation(id, type) {
        itemToDelete = id;
        deleteType = type;
        
        // Set message based on type
        let itemName = '';
        if (type === 'expense') {
            const expense = sharedExpenses.find(e => e.id === id);
            itemName = expense ? expense.name : 'this expense';
        } else {
            const debt = personalDebts.find(d => d.id === id);
            itemName = debt ? debt.description : 'this debt';
        }
        
        document.getElementById('delete-message').textContent = 
            `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
        
        deleteConfirmation.classList.add('active');
        deleteOverlay.classList.add('active');
    }
    
    function hideDeleteConfirmation() {
        deleteConfirmation.classList.remove('active');
        deleteOverlay.classList.remove('active');
        itemToDelete = null;
        deleteType = null;
    }
    
    function confirmDelete() {
        if (itemToDelete && deleteType) {
            if (deleteType === 'expense') {
                sharedExpenses = sharedExpenses.filter(e => e.id !== itemToDelete);
            } else {
                personalDebts = personalDebts.filter(d => d.id !== itemToDelete);
            }
            
            saveData();
            
            if (deleteType === 'expense') {
                renderExpenses();
                calculateBalances();
                addActivity('Deleted a shared expense');
            } else {
                renderPersonalDebts();
                addActivity('Deleted a personal debt');
            }
            
            hideDeleteConfirmation();
            showAutoSaveIndicator('Item deleted successfully!');
            
            // Emit to server if real-time is active
            if (window.realTime && window.realTime.socket && window.realTime.isConnected) {
                window.realTime.socket.emit('delete-item', {
                    roomId: 'warsan305',
                    itemId: itemToDelete,
                    itemType: deleteType,
                    userName: window.realTime.currentUser || 'Anonymous'
                });
            }
        }
    }
    
    // ============ RESET FUNCTIONALITY ============
    function showResetConfirmation() {
        resetConfirmation.classList.add('active');
    }
    
    function hideResetConfirmation() {
        resetConfirmation.classList.remove('active');
    }
    
    function resetAllData() {
        // Clear all data
        sharedExpenses = [];
        personalDebts = [];
        settlements = [];
        
        // Clear localStorage
        localStorage.removeItem('warsan305_sharedExpenses');
        localStorage.removeItem('warsan305_personalDebts');
        
        // Reset UI
        renderExpenses();
        renderPersonalDebts();
        calculateBalances();
        
        // Clear settlement display
        if (settlementContainer) {
            settlementContainer.innerHTML = '<p class="no-expenses">Click "Calculate" to see who owes whom (including personal debts)</p>';
        }
        
        // Hide circular debt section
        if (circularDebtSection) {
            circularDebtSection.style.display = 'none';
        }
        
        // Hide confirmation
        hideResetConfirmation();
        
        // Show success message
        showAutoSaveIndicator('All data has been reset!');
        
        // Add to activity feed
        addActivity('Reset all data');
        
        // Emit to server if real-time is active
        if (window.realTime && window.realTime.socket && window.realTime.isConnected) {
            window.realTime.socket.emit('reset-data', {
                roomId: 'warsan305',
                userName: window.realTime.currentUser || 'Anonymous'
            });
        }
    }
    
    // ============ DATA PERSISTENCE ============
    function saveData() {
        localStorage.setItem('warsan305_sharedExpenses', JSON.stringify(sharedExpenses));
        localStorage.setItem('warsan305_personalDebts', JSON.stringify(personalDebts));
    }
    
    // ============ AUTO-SAVE INDICATOR ============
    function setupAutoSaveIndicator() {
        // Auto-save is handled by localStorage, just show indicator on changes
    }
    
    function showAutoSaveIndicator(message) {
        const indicator = document.getElementById('auto-save-indicator');
        if (indicator) {
            indicator.innerHTML = `<i class="fas fa-save"></i> ${message}`;
            indicator.classList.add('show');
            
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 3000);
        }
    }
    
    // ============ ACTIVITY FEED ============
    function addActivity(message) {
        const activityFeed = document.getElementById('activity-list');
        if (!activityFeed) return;
        
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        activityItem.innerHTML = `
            <div>${message}</div>
            <div class="activity-time">${timeString}</div>
        `;
        
        // Add to top of feed
        activityFeed.insertBefore(activityItem, activityFeed.firstChild);
        
        // Limit to 20 activities
        const activities = activityFeed.querySelectorAll('.activity-item');
        if (activities.length > 20) {
            activities[20].remove();
        }
    }
    
    // ============ EXPOSE TO GLOBAL SCOPE ============
    function exposeToGlobalScope() {
        // Create a global app instance that realtime.js can access
        window.appInstance = {
            // Variables
            sharedExpenses: sharedExpenses,
            personalDebts: personalDebts,
            settlements: settlements,
            itemToDelete: itemToDelete,
            deleteType: deleteType,
            ROOMMATES: ROOMMATES,
            
            // Functions
            addSharedExpense: addSharedExpense,
            addPersonalDebt: addPersonalDebt,
            settlePersonalDebt: settlePersonalDebt,
            calculateSettlements: calculateSettlements,
            confirmDelete: confirmDelete,
            resetAllData: resetAllData,
            saveData: saveData,
            showAutoSaveIndicator: showAutoSaveIndicator,
            hideDeleteConfirmation: hideDeleteConfirmation,
            hideResetConfirmation: hideResetConfirmation,
            renderExpenses: renderExpenses,
            renderPersonalDebts: renderPersonalDebts,
            calculateBalances: calculateBalances,
            renderSettlements: renderSettlements
        };
    }
    
    // ============ INITIALIZE APP ============
    init();
});
