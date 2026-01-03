// server.js - Updated with real-time collaboration
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Store room data
const rooms = {
    'warsan305': {
        expenses: [],
        personalDebts: [],
        users: [],
        activityLog: []
    }
};

// Helper to get user color
function getUserColor(userName) {
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

// Add activity to room log
function addActivity(roomId, type, message, userName) {
    const room = rooms[roomId];
    if (room) {
        room.activityLog.push({
            type: type,
            message: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            user: userName
        });
        
        // Keep only last 20 activities
        if (room.activityLog.length > 20) {
            room.activityLog.shift();
        }
    }
}

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    socket.on('join-room', (data) => {
        const { roomId, userName } = data;
        console.log(`${userName} joined room: ${roomId}`);
        
        socket.join(roomId);
        
        // Add user to room
        const user = {
            id: socket.id,
            name: userName,
            color: getUserColor(userName),
            isTyping: false
        };
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                expenses: [],
                personalDebts: [],
                users: [],
                activityLog: []
            };
        }
        
        rooms[roomId].users.push(user);
        
        // Send current room data to the new user
        socket.emit('room-data', {
            expenses: rooms[roomId].expenses,
            personalDebts: rooms[roomId].personalDebts,
            users: rooms[roomId].users.filter(u => u.id !== socket.id),
            activityLog: rooms[roomId].activityLog
        });
        
        // Notify other users
        socket.to(roomId).emit('user-joined', user);
        
        // Add to activity log
        addActivity(roomId, 'join', `${userName} joined the room`, userName);
        io.to(roomId).emit('new-activity', {
            type: 'join',
            message: `${userName} joined the room`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });
    
    socket.on('typing', (data) => {
        const { roomId, userName, isTyping } = data;
        
        // Update user typing status
        const room = rooms[roomId];
        if (room) {
            const user = room.users.find(u => u.id === socket.id);
            if (user) {
                user.isTyping = isTyping;
            }
            
            // Broadcast to other users
            socket.to(roomId).emit('user-typing', {
                userId: socket.id,
                isTyping: isTyping
            });
        }
    });
    
    socket.on('add-expense', (data) => {
        const { roomId, expense, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            // Add expense to room
            room.expenses.push(expense);
            
            // Broadcast to all users in the room
            io.to(roomId).emit('expense-added', {
                expense: expense,
                addedBy: userName
            });
            
            // Add to activity log
            addActivity(roomId, 'expense', `${userName} added expense: ${expense.name} ($${expense.amount.toFixed(2)})`, userName);
            io.to(roomId).emit('new-activity', {
                type: 'expense',
                message: `${userName} added expense: ${expense.name}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });
    
    socket.on('add-personal-debt', (data) => {
        const { roomId, debt, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            // Add debt to room
            room.personalDebts.push(debt);
            
            // Broadcast to all users in the room
            io.to(roomId).emit('debt-added', {
                debt: debt,
                addedBy: userName
            });
            
            // Add to activity log
            addActivity(roomId, 'debt', `${userName} added debt: ${debt.description} ($${debt.amount.toFixed(2)})`, userName);
            io.to(roomId).emit('new-activity', {
                type: 'debt',
                message: `${userName} added debt: ${debt.description}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });
    
    socket.on('delete-item', (data) => {
        const { roomId, itemId, itemType, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            if (itemType === 'expense') {
                room.expenses = room.expenses.filter(e => e.id !== itemId);
            } else if (itemType === 'debt') {
                room.personalDebts = room.personalDebts.filter(d => d.id !== itemId);
            }
            
            // Broadcast to all users in the room
            io.to(roomId).emit('item-deleted', {
                itemId: itemId,
                itemType: itemType,
                deletedBy: userName
            });
            
            // Add to activity log
            addActivity(roomId, 'delete', `${userName} deleted a ${itemType}`, userName);
            io.to(roomId).emit('new-activity', {
                type: 'delete',
                message: `${userName} deleted a ${itemType}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });
    
    socket.on('settle-debt', (data) => {
        const { roomId, debtId, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            const debt = room.personalDebts.find(d => d.id === debtId);
            if (debt) {
                debt.status = 'settled';
                debt.settledAt = new Date().toISOString();
                
                // Broadcast to all users in the room
                io.to(roomId).emit('debt-settled', {
                    debtId: debtId,
                    settledBy: userName
                });
                
                // Add to activity log
                addActivity(roomId, 'settle', `${userName} settled a debt of $${debt.amount.toFixed(2)}`, userName);
                io.to(roomId).emit('new-activity', {
                    type: 'settle',
                    message: `${userName} settled a debt`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        }
    });
    
    socket.on('calculate-settlements', (data) => {
        const { roomId, settlements, userName } = data;
        
        // Broadcast settlements to all users in the room
        io.to(roomId).emit('settlements-calculated', {
            settlements: settlements,
            calculatedBy: userName
        });
        
        // Add to activity log
        addActivity(roomId, 'calculate', `${userName} calculated settlements`, userName);
        io.to(roomId).emit('new-activity', {
            type: 'calculate',
            message: `${userName} calculated settlements`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });
    
    socket.on('reset-data', (data) => {
        const { roomId, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            // Reset room data
            room.expenses = [];
            room.personalDebts = [];
            
            // Broadcast to all users in the room
            io.to(roomId).emit('data-reset', {
                resetBy: userName
            });
            
            // Add to activity log
            addActivity(roomId, 'reset', `${userName} reset all data`, userName);
            io.to(roomId).emit('new-activity', {
                type: 'reset',
                message: `${userName} reset all data`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove user from all rooms
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const userIndex = room.users.findIndex(u => u.id === socket.id);
            
            if (userIndex !== -1) {
                const userName = room.users[userIndex].name;
                room.users.splice(userIndex, 1);
                
                // Notify other users in the room
                io.to(roomId).emit('user-left', {
                    userId: socket.id,
                    userName: userName
                });
                
                // Add to activity log
                addActivity(roomId, 'leave', `${userName} left the room`, 'System');
                io.to(roomId).emit('new-activity', {
                    type: 'leave',
                    message: `${userName} left the room`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        }
    });
});

// Serve the main HTML file
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
