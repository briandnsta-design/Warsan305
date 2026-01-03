const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store active users and room data
const rooms = {
    'warsan305': {
        expenses: [],
        personalDebts: [],
        users: [],
        lastUpdated: new Date(),
        activityLog: []
    }
};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/room/:roomId', (req, res) => {
    const roomId = req.params.roomId;
    if (rooms[roomId]) {
        res.json({
            success: true,
            room: rooms[roomId]
        });
    } else {
        res.json({
            success: false,
            message: 'Room not found'
        });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);
    
    // User joins the room
    socket.on('join-room', (data) => {
        const { roomId, userName } = data;
        const userColor = getColorForUser(userName);
        
        // Add user to room
        const user = {
            id: socket.id,
            name: userName,
            color: userColor,
            isTyping: false,
            joinedAt: new Date()
        };
        
        rooms['warsan305'].users.push(user);
        
        // Join socket room
        socket.join(roomId);
        
        // Notify others
        socket.broadcast.to(roomId).emit('user-joined', user);
        
        // Send room data to new user
        socket.emit('room-data', {
            expenses: rooms[roomId].expenses,
            personalDebts: rooms[roomId].personalDebts,
            users: rooms[roomId].users.filter(u => u.id !== socket.id),
            activityLog: rooms[roomId].activityLog.slice(-10) // Last 10 activities
        });
        
        // Update user list for everyone
        io.to(roomId).emit('update-users', rooms[roomId].users);
        
        // Log activity
        logActivity(roomId, `${userName} joined the room`, 'join');
    });
    
    // Handle expense addition
    socket.on('add-expense', (data) => {
        const { roomId, expense, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            expense.id = Date.now() + Math.random();
            expense.addedBy = userName;
            expense.timestamp = new Date();
            
            room.expenses.push(expense);
            room.expenses.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
            room.lastUpdated = new Date();
            
            // Broadcast to all users in room
            io.to(roomId).emit('expense-added', {
                expense: expense,
                addedBy: userName
            });
            
            // Log activity
            logActivity(roomId, `${userName} added expense: ${expense.name} ($${expense.amount})`, 'expense');
        }
    });
    
    // Handle personal debt addition
    socket.on('add-personal-debt', (data) => {
        const { roomId, debt, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            debt.id = Date.now() + Math.random();
            debt.addedBy = userName;
            debt.timestamp = new Date();
            
            room.personalDebts.push(debt);
            room.personalDebts.sort((a, b) => new Date(b.date) - new Date(a.date));
            room.lastUpdated = new Date();
            
            // Broadcast to all users in room
            io.to(roomId).emit('debt-added', {
                debt: debt,
                addedBy: userName
            });
            
            // Log activity
            logActivity(roomId, `${userName} added personal debt: ${debt.description} ($${debt.amount})`, 'debt');
        }
    });
    
    // Handle item deletion
    socket.on('delete-item', (data) => {
        const { roomId, itemId, itemType, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            if (itemType === 'expense') {
                const index = room.expenses.findIndex(e => e.id === itemId);
                if (index !== -1) {
                    const deletedExpense = room.expenses.splice(index, 1)[0];
                    
                    io.to(roomId).emit('item-deleted', {
                        itemId: itemId,
                        itemType: itemType
                    });
                    
                    logActivity(roomId, `${userName} deleted expense: ${deletedExpense.name}`, 'delete');
                }
            } else if (itemType === 'debt') {
                const index = room.personalDebts.findIndex(d => d.id === itemId);
                if (index !== -1) {
                    const deletedDebt = room.personalDebts.splice(index, 1)[0];
                    
                    io.to(roomId).emit('item-deleted', {
                        itemId: itemId,
                        itemType: itemType
                    });
                    
                    logActivity(roomId, `${userName} deleted debt: ${deletedDebt.description}`, 'delete');
                }
            }
            
            room.lastUpdated = new Date();
        }
    });
    
    // Handle debt settlement
    socket.on('settle-debt', (data) => {
        const { roomId, debtId, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            const debt = room.personalDebts.find(d => d.id === debtId);
            if (debt) {
                debt.status = 'settled';
                
                io.to(roomId).emit('debt-settled', {
                    debtId: debtId
                });
                
                logActivity(roomId, `${userName} settled debt: ${debt.description}`, 'settle');
                room.lastUpdated = new Date();
            }
        }
    });
    
    // Handle reset data
    socket.on('reset-data', (data) => {
        const { roomId, userName } = data;
        const room = rooms[roomId];
        
        if (room) {
            room.expenses = [];
            room.personalDebts = [];
            room.lastUpdated = new Date();
            
            io.to(roomId).emit('data-reset', {
                resetBy: userName
            });
            
            logActivity(roomId, `${userName} reset all data`, 'reset');
        }
    });
    
    // Handle user typing
    socket.on('typing', (data) => {
        const { roomId, userName, isTyping } = data;
        const room = rooms[roomId];
        
        if (room) {
            const user = room.users.find(u => u.id === socket.id);
            if (user) {
                user.isTyping = isTyping;
                socket.broadcast.to(roomId).emit('user-typing', {
                    userId: socket.id,
                    userName: userName,
                    isTyping: isTyping
                });
            }
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        // Remove user from all rooms
        Object.keys(rooms).forEach(roomId => {
            const room = rooms[roomId];
            const userIndex = room.users.findIndex(u => u.id === socket.id);
            
            if (userIndex !== -1) {
                const userName = room.users[userIndex].name;
                room.users.splice(userIndex, 1);
                
                // Notify others
                socket.broadcast.to(roomId).emit('user-left', {
                    userId: socket.id,
                    userName: userName
                });
                
                // Log activity
                logActivity(roomId, `${userName} left the room`, 'leave');
            }
        });
    });
});

// Helper function to get a color for a user
function getColorForUser(userName) {
    const colors = [
        '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
        '#9b59b6', '#1abc9c', '#e67e22'
    ];
    
    // Simple hash based on username
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
        hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

// Helper function to log activity
function logActivity(roomId, message, type) {
    const room = rooms[roomId];
    if (room) {
        room.activityLog.push({
            message: message,
            type: type,
            timestamp: new Date(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        
        // Keep only last 50 activities
        if (room.activityLog.length > 50) {
            room.activityLog.shift();
        }
        
        // Broadcast new activity
        io.to(roomId).emit('new-activity', room.activityLog[room.activityLog.length - 1]);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});