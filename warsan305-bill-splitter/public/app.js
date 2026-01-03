// Define the 7 people with their assigned names
const people = [
    { id: 'person1', name: 'Brian', balance: 0, color: 'person-1', personalDebtsOwed: 0, personalDebtsReceived: 0 },
    { id: 'person2', name: 'Tessa', balance: 0, color: 'person-2', personalDebtsOwed: 0, personalDebtsReceived: 0 },
    { id: 'person3', name: 'Robert', balance: 0, color: 'person-3', personalDebtsOwed: 0, personalDebtsReceived: 0 },
    { id: 'person4', name: 'Hershey', balance: 0, color: 'person-4', personalDebtsOwed: 0, personalDebtsReceived: 0 },
    { id: 'person5', name: 'Wilson', balance: 0, color: 'person-5', personalDebtsOwed: 0, personalDebtsReceived: 0 },
    { id: 'person6', name: 'Joselle', balance: 0, color: 'person-6', personalDebtsOwed: 0, personalDebtsReceived: 0 },
    { id: 'person7', name: 'Chona', balance: 0, color: 'person-7', personalDebtsOwed: 0, personalDebtsReceived: 0 }
];

// Store all shared expenses
let expenses = [];

// Store all personal debts
let personalDebts = [];

// Variables for delete functionality
let itemToDelete = null;
let itemTypeToDelete = null; // 'expense' or 'debt'

// Store settlements for export
let currentSettlements = [];

// DOM elements
const expenseListElement = document.getElementById('expense-list');
const debtListElement = document.getElementById('debt-list');
const addExpenseBtn = document.getElementById('add-expense-btn');
const addDebtBtn = document.getElementById('add-debt-btn');
const calculateBtn = document.getElementById('calculate-btn');
const resetBtn = document.getElementById('reset-btn');
const settlementContainer = document.getElementById('settlement-container');
const resetConfirmation = document.getElementById('reset-confirmation');
const confirmResetBtn = document.getElementById('confirm-reset-btn');
const cancelResetBtn = document.getElementById('cancel-reset-btn');
const todayBtn = document.getElementById('today-btn');
const debtTodayBtn = document.getElementById('debt-today-btn');
const invoiceDateInput = document.getElementById('invoice-date');
const debtDateInput = document.getElementById('debt-date');
const circularDebtSection = document.getElementById('circular-debt-section');
const debtMatrixContainer = document.getElementById('debt-matrix-container');
const personalDebtSummary = document.getElementById('personal-debt-summary');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const deleteConfirmation = document.getElementById('delete-confirmation');
const deleteOverlay = document.getElementById('delete-overlay');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const deleteMessage = document.getElementById('delete-message');
const autoSaveIndicator = document.getElementById('auto-save-indicator');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const clearDataBtn = document.getElementById('clear-data-btn');
const exportExcelBtn = document.getElementById('export-excel-btn');
const excelLoading = document.getElementById('excel-loading');

// Export options checkboxes
const exportExpensesCheck = document.getElementById('export-expenses');
const exportDebtsCheck = document.getElementById('export-debts');
const exportSettlementsCheck = document.getElementById('export-settlements');
const exportSummaryCheck = document.getElementById('export-summary');

// Storage keys
const STORAGE_KEYS = {
    EXPENSES: 'warsan305_expenses',
    PERSONAL_DEBTS: 'warsan305_personal_debts',
    LAST_SAVED: 'warsan305_last_saved'
};

// Set default date to today for shared expenses
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    invoiceDateInput.value = today;
    invoiceDateInput.min = '2020-01-01';
    invoiceDateInput.max = new Date().toISOString().split('T')[0];
}

// Set default date to today for personal debts
function setDefaultDebtDate() {
    const today = new Date().toISOString().split('T')[0];
    debtDateInput.value = today;
    debtDateInput.min = '2020-01-01';
    debtDateInput.max = new Date().toISOString().split('T')[0];
}

// Tab switching functionality
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show active tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Initialize balance displays
function updateBalanceDisplays() {
    people.forEach(person => {
        const balanceElement = document.getElementById(`balance${person.id.slice(-1)}`);
        const balanceValue = person.balance.toFixed(2);
        balanceElement.textContent = `$${balanceValue}`;

        // Add color class based on balance
        if (person.balance > 0) {
            balanceElement.className = 'positive';
        } else if (person.balance < 0) {
            balanceElement.className = 'negative';
        } else {
            balanceElement.className = '';
        }
    });
}

// Format date to dd/mm/yyyy format
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Format date to Excel-friendly format (yyyy-mm-dd)
function formatDateForExcel(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// Format currency with USD symbol
function formatCurrency(amount) {
    return `$${amount.toFixed(2)}`;
}

// Show auto-save indicator
function showAutoSaveIndicator() {
    autoSaveIndicator.classList.add('show');
    setTimeout(() => {
        autoSaveIndicator.classList.remove('show');
    }, 2000);
}

// Save data to local storage
function saveToLocalStorage() {
    try {
        // Save expenses
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));

        // Save personal debts
        localStorage.setItem(STORAGE_KEYS.PERSONAL_DEBTS, JSON.stringify(personalDebts));

        // Save timestamp
        localStorage.setItem(STORAGE_KEYS.LAST_SAVED, new Date().toISOString());

        // Show auto-save indicator
        showAutoSaveIndicator();

        return true;
    } catch (error) {
        console.error('Error saving to local storage:', error);
        showToast('Error saving data to local storage');
        return false;
    }
}

// Load data from local storage
function loadFromLocalStorage() {
    try {
        // Load expenses
        const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
        if (savedExpenses) {
            expenses = JSON.parse(savedExpenses);
        }

        // Load personal debts
        const savedDebts = localStorage.getItem(STORAGE_KEYS.PERSONAL_DEBTS);
        if (savedDebts) {
            personalDebts = JSON.parse(savedDebts);
        }

        // Update UI with loaded data
        updateExpenseList();
        updateDebtList();
        updateTotalSummary();

        // Show message if data was loaded
        if (savedExpenses || savedDebts) {
            const lastSaved = localStorage.getItem(STORAGE_KEYS.LAST_SAVED);
            if (lastSaved) {
                const lastSavedDate = new Date(lastSaved);
                showToast(`Data loaded from ${formatDate(lastSavedDate)}`);
            } else {
                showToast('Data loaded from local storage');
            }
        }

        return true;
    } catch (error) {
        console.error('Error loading from local storage:', error);
        showToast('Error loading data from local storage');
        return false;
    }
}

// Export data to JSON file
function exportData() {
    try {
        const data = {
            expenses: expenses,
            personalDebts: personalDebts,
            exportDate: new Date().toISOString(),
            appName: 'Warsan 305 Bill Splitter',
            version: '1.0'
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `warsan305-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        showToast('Backup exported successfully');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting backup');
    }
}

// Import data from JSON file
function importData(file) {
    try {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);

                // Validate imported data
                if (!data.expenses || !data.personalDebts) {
                    throw new Error('Invalid backup file format');
                }

                // Ask for confirmation before importing
                if (confirm(`Import backup data? This will replace your current data with ${data.expenses.length} expenses and ${data.personalDebts.length} personal debts.`)) {
                    expenses = data.expenses;
                    personalDebts = data.personalDebts;

                    // Update UI
                    updateExpenseList();
                    updateDebtList();
                    updateTotalSummary();

                    // Save to local storage
                    saveToLocalStorage();

                    showToast('Backup imported successfully');
                }
            } catch (error) {
                console.error('Error parsing backup file:', error);
                showToast('Error: Invalid backup file format');
            }
        };

        reader.readAsText(file);
    } catch (error) {
        console.error('Error importing data:', error);
        showToast('Error importing backup');
    }
}

// Clear all local storage data
function clearLocalStorage() {
    if (confirm('Are you sure you want to clear all local storage data? This will delete all saved expenses and personal debts from your browser.')) {
        try {
            localStorage.removeItem(STORAGE_KEYS.EXPENSES);
            localStorage.removeItem(STORAGE_KEYS.PERSONAL_DEBTS);
            localStorage.removeItem(STORAGE_KEYS.LAST_SAVED);

            // Reset arrays
            expenses = [];
            personalDebts = [];

            // Update UI
            updateExpenseList();
            updateDebtList();
            updateTotalSummary();
            settlementContainer.innerHTML = '<p class="no-expenses">Click "Calculate" to see who owes whom (including personal debts)</p>';
            circularDebtSection.style.display = 'none';
            personalDebtSummary.style.display = 'none';

            showToast('Local storage data cleared');
        } catch (error) {
            console.error('Error clearing local storage:', error);
            showToast('Error clearing local storage');
        }
    }
}

// Function to export data to Excel
function exportToExcel() {
    try {
        // Show loading overlay
        excelLoading.classList.add('active');

        // Get export options
        const includeExpenses = exportExpensesCheck.checked;
        const includeDebts = exportDebtsCheck.checked;
        const includeSettlements = exportSettlementsCheck.checked;
        const includeSummary = exportSummaryCheck.checked;

        // Create Excel workbook content
        let excelContent = [];

        // Add UTF-8 BOM for Excel compatibility
        excelContent.push('\ufeff');

        // Add header
        excelContent.push('Warsan 305 Bill Splitter - Expense and Debt Tracker');
        excelContent.push(`Exported on: ${new Date().toLocaleString()}`);
        excelContent.push('');

        // Add summary section if selected
        if (includeSummary) {
            excelContent.push('=== SUMMARY ===');

            // Calculate totals
            const totalSharedAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
            const totalPersonalDebts = personalDebts
                .filter(debt => debt.status === 'pending')
                .reduce((sum, debt) => sum + debt.amount, 0);
            const sharePerPerson = expenses.length > 0 ? totalSharedAmount / 7 : 0;

            excelContent.push(`Total Shared Expenses: $${totalSharedAmount.toFixed(2)}`);
            excelContent.push(`Total Personal Debts: $${totalPersonalDebts.toFixed(2)}`);
            excelContent.push(`Share per Person: $${sharePerPerson.toFixed(2)}`);
            excelContent.push('');

            // Add person balances
            excelContent.push('Person Balances:');
            excelContent.push('Name,Balance');
            people.forEach(person => {
                excelContent.push(`${person.name},$${person.balance.toFixed(2)}`);
            });
            excelContent.push('');
        }

        // Add shared expenses section if selected
        if (includeExpenses && expenses.length > 0) {
            excelContent.push('=== SHARED EXPENSES ===');
            excelContent.push('Type,Name,Amount,Invoice Date,Paid By,Entry Date');

            expenses.forEach(expense => {
                const paidByName = people.find(p => p.id === expense.paidBy).name;
                excelContent.push([
                    expense.type,
                    `"${expense.name}"`,
                    expense.amount.toFixed(2),
                    formatDateForExcel(expense.invoiceDate),
                    paidByName,
                    formatDateForExcel(expense.entryDate)
                ].join(','));
            });
            excelContent.push('');
        }

        // Add personal debts section if selected
        if (includeDebts && personalDebts.length > 0) {
            excelContent.push('=== PERSONAL DEBTS ===');
            excelContent.push('From,To,Amount,Description,Date,Notes,Status,Entry Date');

            personalDebts.forEach(debt => {
                const fromName = people.find(p => p.id === debt.from).name;
                const toName = people.find(p => p.id === debt.to).name;
                excelContent.push([
                    fromName,
                    toName,
                    debt.amount.toFixed(2),
                    `"${debt.description}"`,
                    formatDateForExcel(debt.date),
                    `"${debt.notes || ''}"`,
                    debt.status,
                    formatDateForExcel(debt.entryDate)
                ].join(','));
            });
            excelContent.push('');
        }

        // Add settlements section if selected
        if (includeSettlements && currentSettlements.length > 0) {
            excelContent.push('=== SETTLEMENT PLAN ===');
            excelContent.push('From,To,Amount');

            currentSettlements.forEach(settlement => {
                excelContent.push([
                    settlement.from,
                    settlement.to,
                    settlement.amount.toFixed(2)
                ].join(','));
            });
            excelContent.push('');

            // Add settlement summary
            excelContent.push('Settlement Summary:');
            excelContent.push(`Total transactions needed: ${currentSettlements.length}`);
            excelContent.push(`Minimized for optimal settlement`);
            excelContent.push('');
        }

        // Add debt matrix if calculated
        try {
            const debtMatrix = calculateDebtMatrix();
            if (debtMatrix) {
                excelContent.push('=== DEBT MATRIX ===');
                excelContent.push('Note: Shows how much each person owes others (combines shared expenses and personal debts)');
                excelContent.push('');

                // Create header row
                let headerRow = ['Owes → / Paid to ↓'];
                people.forEach(person => {
                    headerRow.push(person.name);
                });
                excelContent.push(headerRow.join(','));

                // Create data rows
                people.forEach(rowPerson => {
                    let row = [rowPerson.name];
                    people.forEach(colPerson => {
                        if (rowPerson.id === colPerson.id) {
                            row.push('-');
                        } else {
                            const amount = debtMatrix[rowPerson.id][colPerson.id];
                            row.push(amount > 0 ? amount.toFixed(2) : '0.00');
                        }
                    });
                    excelContent.push(row.join(','));
                });
                excelContent.push('');
            }
        } catch (error) {
            console.error('Error generating debt matrix for Excel:', error);
        }

        // Add footer
        excelContent.push('=== END OF REPORT ===');
        excelContent.push('Generated by Warsan 305 Bill Splitter');
        excelContent.push('Data is stored locally in your browser');

        // Convert to CSV string
        const csvString = excelContent.join('\n');

        // Create Blob and download
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `Warsan305_Export_${timestamp}.csv`;

        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Hide loading overlay
        setTimeout(() => {
            excelLoading.classList.remove('active');
            showToast('Excel file exported successfully as CSV (compatible with Excel)');
        }, 500);

    } catch (error) {
        console.error('Error exporting to Excel:', error);
        excelLoading.classList.remove('active');
        showToast('Error exporting to Excel: ' + error.message);
    }
}

// Add shared expense function
function addExpense() {
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
        id: Date.now(),
        type: type,
        name: name,
        amount: amount,
        invoiceDate: invoiceDate,
        formattedDate: formatDate(invoiceDate),
        paidBy: paidBy,
        entryDate: new Date().toLocaleDateString()
    };

    // Add to expenses array
    expenses.push(expense);

    // Sort expenses by invoice date (newest first)
    expenses.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

    // Update UI
    updateExpenseList();
    updateTotalSummary();

    // Save to local storage
    saveToLocalStorage();

    // Clear form
    document.getElementById('expense-name').value = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-name').focus();

    // Reset date to today for next entry
    setDefaultDate();

    // Show success message on mobile
    if (window.innerWidth <= 768) {
        showToast('Expense added successfully');
    }
}

// Add personal debt function
function addPersonalDebt() {
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
        id: Date.now(),
        from: from,
        to: to,
        amount: amount,
        description: description,
        date: date,
        formattedDate: formatDate(date),
        notes: notes,
        status: 'pending', // pending or settled
        entryDate: new Date().toLocaleDateString()
    };

    // Add to personalDebts array
    personalDebts.push(debt);

    // Sort debts by date (newest first)
    personalDebts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Update UI
    updateDebtList();
    updateTotalSummary();

    // Save to local storage
    saveToLocalStorage();

    // Clear form
    document.getElementById('debt-description').value = '';
    document.getElementById('debt-amount').value = '';
    document.getElementById('debt-notes').value = '';
    document.getElementById('debt-description').focus();

    // Reset date to today for next entry
    setDefaultDebtDate();

    // Show success message on mobile
    if (window.innerWidth <= 768) {
        showToast('Personal debt added successfully');
    }
}

// Simple toast notification for mobile
function showToast(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 0.9rem;
        max-width: 90%;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: fadeInOut 2.5s ease forwards;
    `;

    document.body.appendChild(toast);

    // Remove toast after animation
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 2500);
}

// Add CSS for toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; bottom: 0px; }
        10% { opacity: 1; bottom: 20px; }
        90% { opacity: 1; bottom: 20px; }
        100% { opacity: 0; bottom: 0px; }
    }
`;
document.head.appendChild(style);

// Mark a personal debt as settled
function settleDebt(debtId) {
    const debtIndex = personalDebts.findIndex(d => d.id === debtId);
    if (debtIndex !== -1) {
        personalDebts[debtIndex].status = 'settled';
        updateDebtList();
        saveToLocalStorage();
        showToast('Debt marked as settled');
    }
}

// Show delete confirmation dialog
function showDeleteConfirmation(itemId, itemType, itemDetails) {
    itemToDelete = itemId;
    itemTypeToDelete = itemType;

    if (itemType === 'expense') {
        const expense = expenses.find(e => e.id === itemId);
        if (expense) {
            const paidByName = people.find(p => p.id === expense.paidBy).name;
            deleteMessage.textContent = `Are you sure you want to delete the expense "${expense.name}" ($${expense.amount.toFixed(2)}) paid by ${paidByName} on ${expense.formattedDate}?`;
        }
    } else if (itemType === 'debt') {
        const debt = personalDebts.find(d => d.id === itemId);
        if (debt) {
            const fromName = people.find(p => p.id === debt.from).name;
            const toName = people.find(p => p.id === debt.to).name;
            deleteMessage.textContent = `Are you sure you want to delete the personal debt "${debt.description}" ($${debt.amount.toFixed(2)}) from ${fromName} to ${toName}?`;
        }
    }

    deleteConfirmation.classList.add('active');
    deleteOverlay.classList.add('active');

    // Prevent body scrolling when modal is open on mobile
    if (window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
    }
}

// Hide delete confirmation dialog
function hideDeleteConfirmation() {
    deleteConfirmation.classList.remove('active');
    deleteOverlay.classList.remove('active');
    itemToDelete = null;
    itemTypeToDelete = null;

    // Restore body scrolling
    document.body.style.overflow = '';
}

// Delete an item (expense or debt)
function deleteItem() {
    if (!itemToDelete || !itemTypeToDelete) return;

    if (itemTypeToDelete === 'expense') {
        // Remove expense from array
        const expenseIndex = expenses.findIndex(e => e.id === itemToDelete);
        if (expenseIndex !== -1) {
            expenses.splice(expenseIndex, 1);
            updateExpenseList();
        }
    } else if (itemTypeToDelete === 'debt') {
        // Remove debt from array
        const debtIndex = personalDebts.findIndex(d => d.id === itemToDelete);
        if (debtIndex !== -1) {
            personalDebts.splice(debtIndex, 1);
            updateDebtList();
        }
    }

    // Update totals and hide confirmation
    updateTotalSummary();
    hideDeleteConfirmation();

    // Save to local storage
    saveToLocalStorage();

    // Show success message
    showToast('Item deleted successfully');
}

// Update shared expense list display with delete buttons
function updateExpenseList() {
    if (expenses.length === 0) {
        expenseListElement.innerHTML = '<div class="no-expenses">No shared expenses added yet</div>';
        return;
    }

    // Show only the last 10 expenses
    const recentExpenses = expenses.slice(0, 10);

    let html = '';
    recentExpenses.forEach(expense => {
        const paidByName = people.find(p => p.id === expense.paidBy).name;
        let icon = 'fa-receipt';
        if (expense.type === 'utility') icon = 'fa-bolt';
        else if (expense.type === 'grocery') icon = 'fa-shopping-cart';

        html += `
            <div class="expense-item">
                <div class="expense-details">
                    <div>
                        <i class="fas ${icon}"></i> ${expense.name}
                    </div>
                    <div class="expense-meta">
                        <span>Paid by ${paidByName}</span>
                        <span>Invoice: ${expense.formattedDate}</span>
                    </div>
                </div>
                <div class="expense-amount-container">
                    <div class="expense-amount">${formatCurrency(expense.amount)}</div>
                    <button class="delete-btn" data-id="${expense.id}" data-type="expense">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });

    expenseListElement.innerHTML = html;

    // Add event listeners to delete buttons
    expenseListElement.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const itemId = parseInt(this.getAttribute('data-id'));
            showDeleteConfirmation(itemId, 'expense');
        });
    });
}

// Update personal debt list display with delete buttons
function updateDebtList() {
    if (personalDebts.length === 0) {
        debtListElement.innerHTML = '<div class="no-debts">No personal debts added yet</div>';
        return;
    }

    // Show only the last 10 debts
    const recentDebts = personalDebts.slice(0, 10);

    let html = '';
    recentDebts.forEach(debt => {
        const fromName = people.find(p => p.id === debt.from).name;
        const toName = people.find(p => p.id === debt.to).name;
        const statusClass = debt.status === 'settled' ? 'status-settled' : 'status-pending';
        const statusText = debt.status === 'settled' ? 'Settled' : 'Pending';

        html += `
            <div class="debt-item">
                <div class="debt-details">
                    <div>
                        <i class="fas fa-hand-holding-usd"></i> ${debt.description}
                        <span class="status-badge ${statusClass}">${statusText}</span>
                        ${debt.status === 'pending' ? `<button class="settle-debt-btn" data-id="${debt.id}">Settle</button>` : ''}
                    </div>
                    <div class="debt-meta">
                        <span>${fromName} → ${toName}</span>
                        <span>Date: ${debt.formattedDate}</span>
                    </div>
                    ${debt.notes ? `<div><small>Notes: ${debt.notes}</small></div>` : ''}
                </div>
                <div class="debt-amount-container">
                    <div class="debt-amount">${formatCurrency(debt.amount)}</div>
                    <button class="delete-btn" data-id="${debt.id}" data-type="debt">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });

    debtListElement.innerHTML = html;

    // Add event listeners to settle debt buttons
    debtListElement.querySelectorAll('.settle-debt-btn').forEach(button => {
        button.addEventListener('click', function() {
            const debtId = parseInt(this.getAttribute('data-id'));
            settleDebt(debtId);
        });
    });

    // Add event listeners to delete buttons
    debtListElement.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const itemId = parseInt(this.getAttribute('data-id'));
            showDeleteConfirmation(itemId, 'debt');
        });
    });
}

// Calculate the combined debt matrix (shared expenses + personal debts)
function calculateDebtMatrix() {
    // Initialize the debt matrix with zeros
    const debtMatrix = {};

    // Initialize matrix for all people
    people.forEach(person => {
        debtMatrix[person.id] = {};
        people.forEach(otherPerson => {
            debtMatrix[person.id][otherPerson.id] = 0;
        });
    });

    // Calculate debts from shared expenses
    expenses.forEach(expense => {
        const payer = expense.paidBy;
        const sharePerPerson = expense.amount / 7;

        // For each person (including the payer), calculate what they owe
        people.forEach(person => {
            if (person.id !== payer) {
                // Person owes the payer their share
                debtMatrix[person.id][payer] += sharePerPerson;
            }
        });
    });

    // Calculate debts from personal debts (only pending ones)
    personalDebts.forEach(debt => {
        if (debt.status === 'pending') {
            debtMatrix[debt.from][debt.to] += debt.amount;
        }
    });

    return debtMatrix;
}

// Create a debt matrix display
function createDebtMatrixDisplay(debtMatrix) {
    let html = '<table class="debt-matrix">';

    // Create header row
    html += '<thead><tr><th>Owes →<br>Paid to ↓</th>';
    people.forEach(person => {
        html += `<th><span class="person-color ${person.color}"></span>${person.name}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Create data rows
    people.forEach(rowPerson => {
        html += `<tr><td><strong><span class="person-color ${rowPerson.color}"></span>${rowPerson.name}</strong></td>`;

        people.forEach(colPerson => {
            const amount = debtMatrix[rowPerson.id][colPerson.id];

            if (rowPerson.id === colPerson.id) {
                // Diagonal cell (person to themselves)
                html += `<td class="diagonal-cell">-</td>`;
            } else if (amount > 0) {
                // Person owes money to another person
                html += `<td class="debt-cell positive">${formatCurrency(amount)}</td>`;
            } else {
                // No debt
                html += `<td>$0.00</td>`;
            }
        });

        html += '</tr>';
    });

    html += '</tbody></table>';

    // Add summary
    html += '<div class="settlement-summary">';
    html += '<p><strong>Note:</strong> This matrix shows combined debts from both shared expenses and personal debts. Personal debts marked as "settled" are not included.</p>';
    html += '</div>';

    return html;
}

// Create personal debt summary cards
function createPersonalDebtSummary() {
    // Reset personal debt tracking in people
    people.forEach(person => {
        person.personalDebtsOwed = 0;
        person.personalDebtsReceived = 0;
    });

    // Calculate personal debts for each person
    personalDebts.forEach(debt => {
        if (debt.status === 'pending') {
            const fromPerson = people.find(p => p.id === debt.from);
            const toPerson = people.find(p => p.id === debt.to);

            if (fromPerson) fromPerson.personalDebtsOwed += debt.amount;
            if (toPerson) toPerson.personalDebtsReceived += debt.amount;
        }
    });

    let html = '';

    people.forEach(person => {
        if (person.personalDebtsOwed > 0 || person.personalDebtsReceived > 0) {
            html += `
                <div class="personal-debt-card">
                    <h4><span class="person-color ${person.color}"></span>${person.name}</h4>
                    <div class="personal-debt-item">
                        <span>Total Owed to Others:</span>
                        <span class="negative">${formatCurrency(person.personalDebtsOwed)}</span>
                    </div>
                    <div class="personal-debt-item">
                        <span>Total Owed by Others:</span>
                        <span class="positive">${formatCurrency(person.personalDebtsReceived)}</span>
                    </div>
                    <div class="personal-debt-item">
                        <span>Net Personal Balance:</span>
                        <span class="${person.personalDebtsReceived - person.personalDebtsOwed >= 0 ? 'positive' : 'negative'}">
                            ${formatCurrency(person.personalDebtsReceived - person.personalDebtsOwed)}
                        </span>
                    </div>
                </div>
            `;
        }
    });

    if (html === '') {
        personalDebtSummary.innerHTML = '<p class="no-debts">No pending personal debts to display</p>';
    } else {
        personalDebtSummary.innerHTML = html;
    }
}

// Calculate shares and settlements with combined debts
function calculateShares() {
    if (expenses.length === 0 && personalDebts.length === 0) {
        showToast('Please add some expenses or personal debts first');
        return;
    }

    // Reset people balances
    people.forEach(person => {
        person.balance = 0;
    });

    // Calculate total shared amount and update balances
    let totalSharedAmount = 0;
    if (expenses.length > 0) {
        totalSharedAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const sharePerPerson = totalSharedAmount / 7;

        // Calculate each person's balance from shared expenses
        people.forEach(person => {
            const amountPaid = expenses
                .filter(expense => expense.paidBy === person.id)
                .reduce((sum, expense) => sum + expense.amount, 0);

            person.balance = amountPaid - sharePerPerson;
        });
    }

    // Adjust balances with personal debts (only pending ones)
    personalDebts.forEach(debt => {
        if (debt.status === 'pending') {
            const fromPerson = people.find(p => p.id === debt.from);
            const toPerson = people.find(p => p.id === debt.to);

            if (fromPerson) fromPerson.balance -= debt.amount;
            if (toPerson) toPerson.balance += debt.amount;
        }
    });

    // Calculate settlements using optimized circular debt algorithm
    currentSettlements = calculateCircularSettlements(people.map(p => ({...p})));

    // Calculate and display debt matrix
    const debtMatrix = calculateDebtMatrix();
    const debtMatrixHtml = createDebtMatrixDisplay(debtMatrix);
    debtMatrixContainer.innerHTML = debtMatrixHtml;
    circularDebtSection.style.display = 'block';

    // Create personal debt summary
    createPersonalDebtSummary();
    personalDebtSummary.style.display = 'flex';

    // Update UI
    updateBalanceDisplays();
    updateSettlementDisplay(currentSettlements, totalSharedAmount);
    updateTotalSummary();

    // Save to local storage
    saveToLocalStorage();

    // Scroll to results on mobile
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            document.querySelector('.results-section').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 300);
    }

    showToast('Calculations completed successfully');
}

// Calculate circular settlements using optimized algorithm
function calculateCircularSettlements(balances) {
    // Create a copy of balances to work with
    const peopleBalances = balances.map(p => ({ ...p }));

    // Separate into creditors and debtors
    const creditors = peopleBalances.filter(p => p.balance > 0)
        .sort((a, b) => b.balance - a.balance);
    const debtors = peopleBalances.filter(p => p.balance < 0)
        .map(p => ({ ...p, balance: Math.abs(p.balance) }))
        .sort((a, b) => b.balance - a.balance);

    const settlements = [];

    // Use a while loop to handle all settlements
    while (creditors.length > 0 && debtors.length > 0) {
        // Sort each time to get the largest creditor and debtor
        creditors.sort((a, b) => b.balance - a.balance);
        debtors.sort((a, b) => b.balance - a.balance);

        const largestCreditor = creditors[0];
        const largestDebtor = debtors[0];

        const amount = Math.min(largestCreditor.balance, largestDebtor.balance);

        if (amount > 0.01) {
            settlements.push({
                from: largestDebtor.name,
                to: largestCreditor.name,
                amount: parseFloat(amount.toFixed(2))
            });

            largestCreditor.balance -= amount;
            largestDebtor.balance -= amount;

            // Remove if balance is close to zero
            if (largestCreditor.balance < 0.01) {
                creditors.shift();
            }
            if (largestDebtor.balance < 0.01) {
                debtors.shift();
            }
        } else {
            // Remove if balance is essentially zero
            if (largestCreditor.balance < 0.01) creditors.shift();
            if (largestDebtor.balance < 0.01) debtors.shift();
        }
    }

    return settlements;
}

// Update settlement display
function updateSettlementDisplay(settlements, totalSharedAmount) {
    if (settlements.length === 0) {
        settlementContainer.innerHTML = '<p class="no-expenses">All balances are settled!</p>';
        return;
    }

    let html = '<ul class="settlement-list">';

    settlements.forEach(settlement => {
        html += `
            <li>
                <i class="fas fa-arrow-right"></i>
                <strong>${settlement.from}</strong> should pay
                <strong>${settlement.to}</strong>
                <strong>${formatCurrency(settlement.amount)}</strong>
            </li>
        `;
    });

    html += '</ul>';

    // Add settlement summary
    html += '<div class="settlement-summary">';
    if (expenses.length > 0) {
        const sharePerPerson = totalSharedAmount / 7;
        html += `<p><strong>Shared Expense Summary:</strong> Each person's share of shared expenses is ${formatCurrency(sharePerPerson)}. Personal debts are included in the calculations above.</p>`;
    }
    html += `<p><strong>Optimized Settlement:</strong> This plan minimizes the number of transactions needed to settle all combined debts. Only <strong>${settlements.length}</strong> transactions are needed.</p>`;
    html += '</div>';

    settlementContainer.innerHTML = html;
}

// Update total summary
function updateTotalSummary() {
    // Calculate total shared expenses
    const totalSharedAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Calculate total personal debts (only pending ones)
    const totalPersonalDebts = personalDebts
        .filter(debt => debt.status === 'pending')
        .reduce((sum, debt) => sum + debt.amount, 0);

    // Calculate share per person (for shared expenses only)
    const sharePerPerson = expenses.length > 0 ? totalSharedAmount / 7 : 0;

    document.getElementById('total-expenses').textContent = formatCurrency(totalSharedAmount);
    document.getElementById('total-personal-debts').textContent = formatCurrency(totalPersonalDebts);
    document.getElementById('share-per-person').textContent = formatCurrency(sharePerPerson);
}

// Reset all expenses, debts, and balances
function resetAllData() {
    // Reset people balances
    people.forEach(person => {
        person.balance = 0;
        person.personalDebtsOwed = 0;
        person.personalDebtsReceived = 0;
    });

    // Clear expenses and personal debts arrays
    expenses = [];
    personalDebts = [];

    // Update UI
    updateExpenseList();
    updateDebtList();
    updateBalanceDisplays();
    updateTotalSummary();
    settlementContainer.innerHTML = '<p class="no-expenses">Click "Calculate" to see who owes whom (including personal debts)</p>';
    circularDebtSection.style.display = 'none';
    personalDebtSummary.style.display = 'none';

    // Save to local storage
    saveToLocalStorage();

    // Hide confirmation dialog
    resetConfirmation.classList.remove('active');

    // Show success message
    showToast('All data has been reset. Balances are now $0.00.');
}

// Show reset confirmation
function showResetConfirmation() {
    if (expenses.length === 0 && personalDebts.length === 0) {
        showToast('There is no data to reset.');
        return;
    }

    resetConfirmation.classList.add('active');
    resetConfirmation.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    // Prevent body scrolling when modal is open on mobile
    if (window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
    }
}

// Hide reset confirmation
function hideResetConfirmation() {
    resetConfirmation.classList.remove('active');

    // Restore body scrolling
    document.body.style.overflow = '';
}

// Add sample data for demonstration
function addSampleData() {
    // Get dates for sample data
    const today = new Date();

    // Add sample shared expenses
    const sampleExpenses = [
        {
            type: 'utility',
            name: 'Electricity Bill',
            amount: 140.00,
            paidBy: 'person1',
            invoiceDate: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0]
        },
        {
            type: 'utility',
            name: 'Water Bill',
            amount: 98.00,
            paidBy: 'person2',
            invoiceDate: new Date(today.getFullYear(), today.getMonth(), 10).toISOString().split('T')[0]
        },
        {
            type: 'utility',
            name: 'Internet Bill',
            amount: 91.00,
            paidBy: 'person3',
            invoiceDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
        },
        {
            type: 'grocery',
            name: 'Weekly Groceries',
            amount: 210.00,
            paidBy: 'person4',
            invoiceDate: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split('T')[0]
        }
    ];

    // Add sample personal debts
    const sampleDebts = [
        {
            from: 'person5',
            to: 'person1',
            amount: 50.00,
            description: 'Borrowed for concert tickets',
            date: new Date(today.getFullYear(), today.getMonth(), 3).toISOString().split('T')[0],
            notes: 'To be paid back by end of month'
        },
        {
            from: 'person6',
            to: 'person2',
            amount: 35.00,
            description: 'Dinner payment',
            date: new Date(today.getFullYear(), today.getMonth(), 8).toISOString().split('T')[0],
            notes: ''
        },
        {
            from: 'person7',
            to: 'person3',
            amount: 20.00,
            description: 'Coffee run',
            date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().split('T')[0],
            notes: 'For team coffee'
        },
        {
            from: 'person1',
            to: 'person5',
            amount: 15.00,
            description: 'Movie tickets',
            date: new Date(today.getFullYear(), today.getMonth(), 18).toISOString().split('T')[0],
            notes: 'Already settled',
            status: 'settled'
        }
    ];

    // Add sample expenses
    sampleExpenses.forEach(expense => {
        expense.id = Date.now() + Math.random();
        expense.formattedDate = formatDate(expense.invoiceDate);
        expense.entryDate = new Date().toLocaleDateString();
        expenses.push(expense);
    });

    // Add sample personal debts
    sampleDebts.forEach(debt => {
        debt.id = Date.now() + Math.random();
        debt.formattedDate = formatDate(debt.date);
        debt.entryDate = new Date().toLocaleDateString();
        if (!debt.status) debt.status = 'pending';
        personalDebts.push(debt);
    });

    // Sort expenses by invoice date
    expenses.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

    // Sort debts by date
    personalDebts.sort((a, b) => new Date(b.date) - new Date(a.date));

    updateExpenseList();
    updateDebtList();
    updateTotalSummary();

    // Save to local storage
    saveToLocalStorage();
}

// Event listeners
addExpenseBtn.addEventListener('click', addExpense);
addDebtBtn.addEventListener('click', addPersonalDebt);
calculateBtn.addEventListener('click', calculateShares);
resetBtn.addEventListener('click', showResetConfirmation);
confirmResetBtn.addEventListener('click', resetAllData);
cancelResetBtn.addEventListener('click', hideResetConfirmation);
todayBtn.addEventListener('click', () => {
    setDefaultDate();
});
debtTodayBtn.addEventListener('click', () => {
    setDefaultDebtDate();
});

// Delete functionality event listeners
confirmDeleteBtn.addEventListener('click', deleteItem);
cancelDeleteBtn.addEventListener('click', hideDeleteConfirmation);
deleteOverlay.addEventListener('click', hideDeleteConfirmation);

// Backup/restore event listeners
exportBtn.addEventListener('click', exportData);
clearDataBtn.addEventListener('click', clearLocalStorage);

// Excel export event listener
exportExcelBtn.addEventListener('click', exportToExcel);

// Import backup file
importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            importData(file);
        }
    };
    input.click();
});

// Allow Enter key to add expense
document.getElementById('expense-amount').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addExpense();
    }
});

// Allow Enter key to add debt
document.getElementById('debt-amount').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addPersonalDebt();
    }
});

// Initialize date inputs and load data on page load
window.addEventListener('DOMContentLoaded', () => {
    setDefaultDate();
    setDefaultDebtDate();

    // Load data from local storage
    loadFromLocalStorage();

    // Only add sample data if no data was loaded
    if (expenses.length === 0 && personalDebts.length === 0) {
        // Ask user if they want sample data
        if (confirm('Would you like to load sample data to see how the app works?')) {
            addSampleData();
            showToast('Sample data loaded. You can start adding your own expenses and debts.');
        }
    }

    // Add touch-friendly improvements
    if ('ontouchstart' in window) {
        // Add active state to buttons on touch
        document.querySelectorAll('.btn, .delete-btn, .settle-debt-btn, .today-btn').forEach(button => {
            button.addEventListener('touchstart', function() {
                this.classList.add('active');
            });

            button.addEventListener('touchend', function() {
                this.classList.remove('active');
            });
        });

        // Prevent zoom on double-tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(event) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    // Auto-save before page unload
    window.addEventListener('beforeunload', () => {
        saveToLocalStorage();
    });
});

// Make functions available globally for realtime.js to override
window.addExpense = addExpense;
window.addPersonalDebt = addPersonalDebt;
window.deleteItem = deleteItem;
window.settleDebt = settleDebt;
window.resetAllData = resetAllData;
window.showToast = showToast;