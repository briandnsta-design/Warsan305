const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the current directory (where server.js is located)
app.use(express.static(path.join(__dirname)));

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle events from clients
    // For example, when a client joins a room, updates an expense, etc.

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Since the HTML file is at the root, we can serve it for all routes that are not static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
