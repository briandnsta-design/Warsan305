// server.js - Real-time collaboration server for Warsan 305 Bill Splitter
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// IMPORTANT: Configure CORS for your Render URL
const io = socketIo(server, {
  cors: {
    origin: [
      "https://warsan305.onrender.com",
      "http://localhost:3000",
      "http://localhost:8080",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:8080"
    ],
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['websocket', 'polling']
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));
app.use(cors({
  origin: ["https://warsan305.onrender.com", "http://localhost:3000"],
  credentials: true
}));

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
        const activity = {
            type: type,
            message: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            user: userName || 'System',
            timestamp: new Date().toISOString()
        };
        
        room.activityLog.push(activity);

        // Keep only last 50 activities
        if (room.activityLog.length > 50) {
            room.activityLog.shift();
        }
        
        return activity;
    }
    return null;
}

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('🔗 New user connected:', socket.id);

    // Ping-pong for connection testing
    socket.on('ping', () => {
        socket.emit('pong', Date.now());
    });

    socket.on('join-room', (data) => {
        const { roomId, userName } = data;
        console.log(`👤 ${userName} (${socket.id}) joined room: ${roomId}`);

        socket.join(roomId);

        // Initialize room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = {
                expenses: [],
                personalDebts: [],
                users: [],
                activityLog: []
            };
            console.log(`🏠 Created new room: ${roomId}`);
        }

        const room = rooms[roomId];

        // Remove user if already exists (reconnection)
        room.users = room.users.filter(u => u.id !== socket.id);

        // Add user to room
        const user = {
            id: socket.id,
            name: userName,
            color: getUserColor(userName),
            isTyping: false,
            joinedAt: new Date().toISOString()
        };

        room.users.push(user);

        // Send current room data to the new user
        socket.emit('room-data', {
            expenses: room.expenses,
            personalDebts: room.personalDebts,
            users: room.users.filter(u => u.id !== socket.id),
            activityLog: room.activityLog.slice(-10), // Last 10 activities
            roomInfo: {
                id: roomId,
                userCount: room.users.length,
                expenseCount: room.expenses.length,
                debtCount: room.personalDebts.length
            }
        });

        // Notify other users
        socket.to(roomId).emit('user-joined', user);
        
        // Update user list for all
        io.to(roomId).emit('update-users', room.users.filter(u => u.id !== socket.id));

        // Add to activity log
        const activity = addActivity(roomId, 'join', `${userName} joined the room`, userName);
        if (activity) {
            io.to(roomId).emit('new-activity', activity);
        }
        
        console.log(`📊 Room ${roomId} now has ${room.users.length} users`);
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
                userName: userName,
                isTyping: isTyping
            });
        }
    });

    socket.on('add-expense', (data) => {
        const { roomId, expense, userName } = data;
        const room = rooms[roomId];

        if (room) {
            // Ensure expense has an ID
            if (!expense.id) {
                expense.id = Date.now();
            }
            
            // Add timestamp if not present
            if (!expense.createdAt) {
                expense.createdAt = new Date().toISOString();
            }
            
            // Add expense to room (at beginning)
            room.expenses.unshift(expense);
            
            // Keep only last 100 expenses
            if (room.expenses.length > 100) {
                room.expenses.pop();
            }

            // Broadcast to all users in the room (including sender)
            io.to(roomId).emit('expense-added', {
                expense: expense,
                addedBy: userName,
                timestamp: new Date().toISOString()
            });

            // Add to activity log
            const activity = addActivity(roomId, 'expense', 
                `${userName} added expense: ${expense.name} ($${expense.amount.toFixed(2)})`, 
                userName
            );
            if (activity) {
                io.to(roomId).emit('new-activity', activity);
            }
            
            console.log(`💰 Expense added to ${roomId} by ${userName}: ${expense.name} ($${expense.amount})`);
        }
    });

    socket.on('add-personal-debt', (data) => {
        const { roomId, debt, userName } = data;
        const room = rooms[roomId];

        if (room) {
            // Ensure debt has an ID
            if (!debt.id) {
                debt.id = Date.now();
            }
            
            // Add timestamp if not present
            if (!debt.createdAt) {
                debt.createdAt = new Date().toISOString();
            }
            
            // Set default status
            if (!debt.status) {
                debt.status = 'pending';
            }
            
            // Add debt to room (at beginning)
            room.personalDebts.unshift(debt);
            
            // Keep only last 100 debts
            if (room.personalDebts.length > 100) {
                room.personalDebts.pop();
            }

            // Broadcast to all users in the room
            io.to(roomId).emit('debt-added', {
                debt: debt,
                addedBy: userName,
                timestamp: new Date().toISOString()
            });

            // Add to activity log
            const activity = addActivity(roomId, 'debt', 
                `${userName} added debt: ${debt.description} ($${debt.amount.toFixed(2)})`, 
                userName
            );
            if (activity) {
                io.to(roomId).emit('new-activity', activity);
            }
            
            console.log(`💳 Debt added to ${roomId} by ${userName}: ${debt.description} ($${debt.amount})`);
        }
    });

    socket.on('delete-item', (data) => {
        const { roomId, itemId, itemType, userName } = data;
        const room = rooms[roomId];

        if (room) {
            let itemName = 'item';
            
            if (itemType === 'expense') {
                const expense = room.expenses.find(e => e.id === itemId);
                itemName = expense ? expense.name : 'expense';
                room.expenses = room.expenses.filter(e => e.id !== itemId);
            } else if (itemType === 'debt') {
                const debt = room.personalDebts.find(d => d.id === itemId);
                itemName = debt ? debt.description : 'debt';
                room.personalDebts = room.personalDebts.filter(d => d.id !== itemId);
            }

            // Broadcast to all users in the room
            io.to(roomId).emit('item-deleted', {
                itemId: itemId,
                itemType: itemType,
                deletedBy: userName,
                timestamp: new Date().toISOString()
            });

            // Add to activity log
            const activity = addActivity(roomId, 'delete', 
                `${userName} deleted a ${itemType}: ${itemName}`, 
                userName
            );
            if (activity) {
                io.to(roomId).emit('new-activity', activity);
            }
            
            console.log(`🗑️ ${itemType} deleted from ${roomId} by ${userName}: ${itemName}`);
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
                debt.settledBy = userName;

                // Broadcast to all users in the room
                io.to(roomId).emit('debt-settled', {
                    debtId: debtId,
                    settledBy: userName,
                    timestamp: new Date().toISOString(),
                    debt: debt
                });

                // Add to activity log
                const activity = addActivity(roomId, 'settle', 
                    `${userName} settled debt: ${debt.description} ($${debt.amount.toFixed(2)})`, 
                    userName
                );
                if (activity) {
                    io.to(roomId).emit('new-activity', activity);
                }
                
                console.log(`✅ Debt settled in ${roomId} by ${userName}: ${debt.description}`);
            }
        }
    });

    socket.on('calculate-settlements', (data) => {
        const { roomId, settlements, userName } = data;
        const room = rooms[roomId];

        if (room) {
            // Broadcast settlements to all users in the room
            io.to(roomId).emit('settlements-calculated', {
                settlements: settlements,
                calculatedBy: userName,
                timestamp: new Date().toISOString()
            });

            // Add to activity log
            const activity = addActivity(roomId, 'calculate', 
                `${userName} calculated settlements`, 
                userName
            );
            if (activity) {
                io.to(roomId).emit('new-activity', activity);
            }
            
            console.log(`🧮 Settlements calculated in ${roomId} by ${userName}`);
        }
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
                resetBy: userName,
                timestamp: new Date().toISOString()
            });

            // Add to activity log
            const activity = addActivity(roomId, 'reset', 
                `${userName} reset all data`, 
                userName
            );
            if (activity) {
                io.to(roomId).emit('new-activity', activity);
            }
            
            console.log(`🔄 Data reset in ${roomId} by ${userName}`);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`👋 User disconnected: ${socket.id}, Reason: ${reason}`);

        // Remove user from all rooms
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const userIndex = room.users.findIndex(u => u.id === socket.id);

            if (userIndex !== -1) {
                const userName = room.users[userIndex].name;
                room.users.splice(userIndex, 1);

                // Notify other users in the room
                socket.to(roomId).emit('user-left', {
                    userId: socket.id,
                    userName: userName,
                    reason: reason
                });
                
                // Update user list for all
                io.to(roomId).emit('update-users', room.users);

                // Add to activity log
                const activity = addActivity(roomId, 'leave', 
                    `${userName} left the room`, 
                    'System'
                );
                if (activity) {
                    io.to(roomId).emit('new-activity', activity);
                }
                
                console.log(`📉 Room ${roomId} now has ${room.users.length} users`);
            }
        }
    });

    // Error handling
    socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        rooms: Object.keys(rooms).length,
        roomData: Object.keys(rooms).map(roomId => ({
            roomId: roomId,
            users: rooms[roomId].users.length,
            expenses: rooms[roomId].expenses.length,
            debts: rooms[roomId].personalDebts.length
        }))
    });
});

// Room info endpoint
app.get('/api/room/:roomId', (req, res) => {
    const roomId = req.params.roomId;
    const room = rooms[roomId];
    
    if (room) {
        res.json({
            roomId: roomId,
            userCount: room.users.length,
            expenseCount: room.expenses.length,
            debtCount: room.personalDebts.length,
            users: room.users.map(u => ({ name: u.name, color: u.color })),
            lastActivity: room.activityLog[room.activityLog.length - 1]
        });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Use Render's PORT environment variable
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log(`🌍 Your Render URL: https://warsan305.onrender.com`);
    console.log(`📊 Health check: https://warsan305.onrender.com/health`);
    console.log('🔌 Socket.IO server ready for connections');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Export for testing
module.exports = { app, server, io, rooms };
