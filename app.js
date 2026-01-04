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
    let selectedRoommates = new Set(ROOMMATE_IDS); // Default: all selected

    // ============ DOM ELEMENTS ============
    // Shared Expense Elements
    const expenseType = document.getElementById('expense-type');
    const expenseName = document.getElementById('expense-name');
    const expenseAmount = document.getElementById('expense-amount');
    const invoiceDate = document.getElementById('invoice-date');
    const todayBtn = document.getElementById('today-btn');
    const paidBy = document.getElementById('paid-by');
    const addExpenseBtn = document.getElementById('add-expense-btn');

    // Roommate Quick Selection Elements
    const roommateTagsContainer = document.getElementById('roommate-tags-container');
    const selectAllBtn = document.getElementById('select-all-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const includeExcludeSection = document.getElementById('include-exclude-section');
    const selectedCountEl = document.getElementById('selected-count');

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

        // Setup roommate tags
        setupRoommateTags();

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

    function setupRoommateTags() {
        if (!roommateTagsContainer) return;

        // Clear container
        roommateTagsContainer.innerHTML = '';

        // Create tags for each roommate
        ROOMMATE_IDS.forEach(id => {
            const tag = document.createElement('div');
            tag.className = `roommate-tag ${selectedRoommates.has(id) ? 'selected' : ''}`;
            tag.dataset.id = id;
            tag.innerHTML = `
                <span class="tag-avatar" style="background-color: ${getPersonColor(id)}">${ROOMMATES[id].charAt(0)}</span>
                <span class="tag-name">${ROOMMATES[id]}</span>
                <span class="tag-checkmark">${selectedRoommates.has(id) ? '✓' : '✗'}</span>
            `;
            roommateTagsContainer.appendChild(tag);
        });

        updateSelectedCount();
    }

    function getPersonColor(personId) {
        const colors = {
            person1: '#3498db',
            person2: '#e74c3c',
            person3: '#2ecc71',
            person4: '#f39c12',
            person5: '#9b59b6',
            person6: '#1abc9c',
            person7: '#e67e22'
        };
        return colors[personId] || '#95a5a6';
    }

    function updateSelectedCount() {
        if (selectedCountEl) {
            selectedCountEl.textContent = `${selectedRoommates.size}/${ROOMMATE_IDS.length} selected`;
            // Update color based on selection status
            if (selectedRoommates.size === ROOMMATE_IDS.length) {
                selectedCountEl.style.color = '#2ecc71';
            } else if (selectedRoommates.size === 0) {
                selectedCountEl.style.color = '#e74c3c';
            } else {
                selectedCountEl.style.color = '#f39c12';
            }
        }
    }

    function toggleRoommateSelection(id) {
        if (selectedRoommates.has(id)) {
            selectedRoommates.delete(id);
        } else {
            selectedRoommates.add(id);
        }

        const tag = document.querySelector(`.roommate-tag[data-id="${id}"]`);
        if (tag) {
            tag.classList.toggle('selected', selectedRoommates.has(id));
            const checkmark = tag.querySelector('.tag-checkmark');
            if (checkmark) {
                checkmark.textContent = selectedRoommates.has(id) ? '✓' : '✗';
            }
        }

        updateSelectedCount();
        updatePaidByOptions();
    }

    function updatePaidByOptions() {
        // Filter paid by dropdown to only include selected roommates
        if (paidBy) {
            const currentValue = paidBy.value;
            paidBy.innerHTML = '<option value="" disabled>Select payer</option>';

            ROOMMATE_IDS.forEach(id => {
                if (selectedRoommates.has(id)) {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = ROOMMATES[id];
                    if (currentValue === id) {
                        option.selected = true;
                    }
                    paidBy.appendChild(option);
                }
            });

            // If current value is not in selected roommates, select the first available
            if (!selectedRoommates.has(currentValue) && selectedRoommates.size > 0) {
                paidBy.value = Array.from(selectedRoommates)[0];
            }
        }
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

        // Roommate selection
        if (roommateTagsContainer) {
            roommateTagsContainer.addEventListener('click', (e) => {
                const tag = e.target.closest('.roommate-tag');
                if (tag) {
                    const id = tag.dataset.id;
                    toggleRoommateSelection(id);
                    
                    // Add visual feedback
                    tag.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        tag.style.transform = '';
                    }, 150);
                }
            });
        }

        // Select All button
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                ROOMMATE_IDS.forEach(id => selectedRoommates.add(id));
                document.querySelectorAll('.roommate-tag').forEach(tag => {
                    tag.classList.add('selected');
                    const checkmark = tag.querySelector('.tag-checkmark');
                    if (checkmark) checkmark.textContent = '✓';
                });
                updateSelectedCount();
                updatePaidByOptions();
            });
        }

        // Clear All button
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                selectedRoommates.clear();
                document.querySelectorAll('.roommate-tag').forEach(tag => {
                    tag.classList.remove('selected');
                    const checkmark = tag.querySelector('.tag-checkmark');
                    if (checkmark) checkmark.textContent = '✗';
                });
                updateSelectedCount();
                updatePaidByOptions();
            });
        }

        // Add Expense button - FIXED: Use direct reference to function
        if (addExpenseBtn) {
            addExpenseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                addSharedExpense();
            });
        }

        // Add Debt button
        if (addDebtBtn) {
            addDebtBtn.addEventListener('click', function(e) {
                e.preventDefault();
                addPersonalDebt();
            });
        }

        // Calculate button
        if (calculateBtn) {
            calculateBtn.addEventListener('click', calculateSettlements);
        }

        // Reset button
        if (resetBtn) {
            resetBtn.addEventListener('click', showResetConfirmation);
        }

        // Reset confirmation buttons
        if (confirmResetBtn) {
            confirmResetBtn.addEventListener('click', resetAllData);
        }
        if (cancelResetBtn) {
            cancelResetBtn.addEventListener('click', hideResetConfirmation);
        }

        // Delete confirmation buttons
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', confirmDelete);
        }
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', hideDeleteConfirmation);
        }

        // Tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                switchTab(tabId);
            });
        });

        // Form submission on Enter key
        if (expenseName) {
            expenseName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addSharedExpense();
                }
            });
        }

        if (debtDescription) {
            debtDescription.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addPersonalDebt();
                }
            });
        }

        // Auto-select all roommates when focusing on expense form
        if (expenseName) {
            expenseName.addEventListener('focus', () => {
                if (selectedRoommates.size === 0) {
                    ROOMMATE_IDS.forEach(id => selectedRoommates.add(id));
                    setupRoommateTags();
                    updatePaidByOptions();
                }
            });
        }

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
        window.selectedRoommates = selectedRoommates;
        window.ROOMMATES = ROOMMATES;
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
        const type = expenseType ? expenseType.value : '';
        const name = expenseName ? expenseName.value.trim() : '';
        const amount = expenseAmount ? parseFloat(expenseAmount.value) : 0;
        const date = invoiceDate ? invoiceDate.value : '';
        const paidByValue = paidBy ? paidBy.value : '';

        // Convert selectedRoommates Set to array
        const selectedRoommatesArray = Array.from(selectedRoommates);

        // Debug logging
        console.log('Expense name:', name);
        console.log('Expense amount:', amount);
        console.log('Selected roommates:', selectedRoommatesArray);
        console.log('Paid by:', paidByValue);

        // Validation - FIXED: Check if name has at least 1 character after trim
        if (!name || name.length === 0) {
            alert('Please enter an expense name');
            if (expenseName) expenseName.focus();
            return;
        }

        if (!amount || amount <= 0 || isNaN(amount)) {
            alert('Please enter a valid amount');
            if (expenseAmount) expenseAmount.focus();
            return;
        }

        if (!date) {
            alert('Please select a date');
            if (invoiceDate) invoiceDate.focus();
            return;
        }

        if (selectedRoommatesArray.length === 0) {
            alert('Please select at least one roommate to include in this expense');
            return;
        }

        if (!paidByValue || !selectedRoommatesArray.includes(paidByValue)) {
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
            paidBy: paidByValue,
            paidByName: ROOMMATES[paidByValue],
            includedPersons: selectedRoommatesArray,
            sharePerPerson: amount / selectedRoommatesArray.length,
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
        if (expenseName) {
            expenseName.value = '';
        }
        if (expenseAmount) {
            expenseAmount.value = '';
        }
        if (expenseName) {
            expenseName.focus();
        }

        // Reset roommate selection to all
        selectedRoommates = new Set(ROOMMATE_IDS);
        setupRoommateTags();
        updatePaidByOptions();

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

            // Create included persons badges
            const includedBadges = (expense.includedPersons || ROOMMATE_IDS)
                .map(id => `<span class="included-badge" style="background-color: ${getPersonColor(id)}">${ROOMMATES[id].charAt(0)}</span>`)
                .join('');

            expenseItem.innerHTML = `
                <div class="expense-details">
                    <div class="expense-title-row">
                        <div class="expense-title">${expense.name}</div>
                        <div class="expense-included-badges">${includedBadges}</div>
                    </div>
                    <div class="expense-meta">
                        <span>${formattedDate}</span>
                        <span>•</span>
                        <span>${expense.type}</span>
                        <span>•</span>
                        <span>Paid by <strong>${expense.paidByName}</strong></span>
                    </div>
                    <div class="expense-share-row">
                        <div class="expense-share">$${expense.sharePerPerson ? expense.sharePerPerson.toFixed(2) : (expense.amount / 7).toFixed(2)} each</div>
                        <div class="expense-split-note">Split among ${expense.includedPersons ? expense.includedPersons.length : '7'} people</div>
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
        const from = debtFrom ? debtFrom.value : '';
        const to = debtTo ? debtTo.value : '';
        const amount = debtAmount ? parseFloat(debtAmount.value) : 0;
        const description = debtDescription ? debtDescription.value.trim() : '';
        const date = debtDate ? debtDate.value : '';
        const notes = debtNotes ? debtNotes.value.trim() : '';

        // Validation - FIXED: Check for minimum length
        if (from === to) {
            alert('The debtor and creditor cannot be the same person');
            return;
        }

        if (!description || description.length < 2) {
            alert('Please enter a valid description (at least 2 characters)');
            if (debtDescription) debtDescription.focus();
            return;
        }

        if (!amount || amount <= 0 || isNaN(amount)) {
            alert('Please enter a valid amount');
            if (debtAmount) debtAmount.focus();
            return;
        }

        if (!date) {
            alert('Please select a date');
            if (debtDate) debtDate.focus();
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
        if (debtDescription) {
            debtDescription.value = '';
        }
        if (debtAmount) {
            debtAmount.value = '';
        }
        if (debtNotes) {
            debtNotes.value = '';
        }
        if (debtDescription) {
            debtDescription.focus();
        }

        // Show success message
        showAutoSaveIndicator('Personal debt added successfully!');

        // Add to activity feed
        addActivity(`${ROOMMATES[from]} owes ${ROOMMATES[to]} $${amount.toFixed(2)}`);

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
                    <div class="debt-title-row">
                        <div class="debt-title">${debt.description}</div>
                        ${statusBadge}
                    </div>
                    <div class="debt-meta">
                        <span>${formattedDate}</span>
                        <span>•</span>
                        <span><span class="debtor" style="color: ${getPersonColor(debt.from)}">${debt.fromName}</span> → <span class="creditor" style="color: ${getPersonColor(debt.to)}">${debt.toName}</span></span>
                        ${debt.notes ? '<span>•</span><span class="debt-notes">' + debt.notes + '</span>' : ''}
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

            // Get included persons for this expense (default to all if not specified)
            const includedPersons = expense.includedPersons || ROOMMATE_IDS;

            // Calculate share per person for this specific expense
            const sharePerPerson = amount / includedPersons.length;

            balances[paidBy] += amount;
            includedPersons.forEach(id => {
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

        // Calculate average share per person
        let totalShareAmount = 0;
        sharedExpenses.forEach(expense => {
            const includedPersons = expense.includedPersons || ROOMMATE_IDS;
            const sharePerPerson = expense.amount / includedPersons.length;
            totalShareAmount += sharePerPerson * (includedPersons.length / ROOMMATE_IDS.length);
        });

        const sharePerPerson = sharedExpenses.length > 0 ? totalShareAmount : 0;

        // Update UI
        if (totalExpensesEl) {
            totalExpensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
        }
        if (totalPersonalDebtsEl) {
            totalPersonalDebtsEl.textContent = `$${totalPersonalDebts.toFixed(2)}`;
        }
        if (sharePerPersonEl) {
            sharePerPersonEl.textContent = `$${sharePerPerson.toFixed(2)}`;
        }
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
            const includedPersons = expense.includedPersons || ROOMMATE_IDS;

            const sharePerPerson = amount / includedPersons.length;

            balances[paidBy] += amount;
            includedPersons.forEach(id => {
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
                <strong style="color: ${getPersonColor(settlement.from)}">${settlement.fromName}</strong> should pay
                <strong style="color: ${getPersonColor(settlement.to)}">${settlement.toName}</strong>
                <strong class="settlement-amount">$${settlement.amount.toFixed(2)}</strong>
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
            tableHTML += `<th style="color: ${getPersonColor(id)}">${ROOMMATES[id]}</th>`;
        });

        tableHTML += '</tr></thead><tbody>';

        // Create matrix rows
        ROOMMATE_IDS.forEach(fromId => {
            tableHTML += `<tr><th style="color: ${getPersonColor(fromId)}">${ROOMMATES[fromId]}</th>`;

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

        if (document.getElementById('delete-message')) {
            document.getElementById('delete-message').textContent =
                `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
        }

        if (deleteConfirmation) {
            deleteConfirmation.classList.add('active');
        }
        if (deleteOverlay) {
            deleteOverlay.classList.add('active');
        }
    }

    function hideDeleteConfirmation() {
        if (deleteConfirmation) {
            deleteConfirmation.classList.remove('active');
        }
        if (deleteOverlay) {
            deleteOverlay.classList.remove('active');
        }
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
        if (resetConfirmation) {
            resetConfirmation.classList.add('active');
        }
    }

    function hideResetConfirmation() {
        if (resetConfirmation) {
            resetConfirmation.classList.remove('active');
        }
    }

    function resetAllData() {
        // Clear all data
        sharedExpenses = [];
        personalDebts = [];
        settlements = [];
        selectedRoommates = new Set(ROOMMATE_IDS);

        // Clear localStorage
        localStorage.removeItem('warsan305_sharedExpenses');
        localStorage.removeItem('warsan305_personalDebts');

        // Reset UI
        renderExpenses();
        renderPersonalDebts();
        calculateBalances();
        setupRoommateTags();
        updatePaidByOptions();

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
            selectedRoommates: selectedRoommates,

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
            renderSettlements: renderSettlements,
            setupRoommateTags: setupRoommateTags,
            updatePaidByOptions: updatePaidByOptions
        };
    }

    // ============ INITIALIZE APP ============
    init();
});
