const express = require('express');
const connectDB = require('./config/db');
const http = require('http');
const cors = require('cors'); // 📌 הוספת CORS
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// התחברות למסד הנתונים
connectDB();

// 📌 שימוש ב-CORS כדי לאפשר תקשורת בין ה-Frontend ל-Backend
app.use(cors({
    origin: 'http://localhost:5173', // מתיר קריאות מה-Frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // מתיר רק את הפעולות האלו
    allowedHeaders: ['Content-Type', 'Authorization'] // מתיר שליחת טוקנים ונתונים
}));

app.use(express.json());

// 📌 ניתובים
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/users', require('./routes/users'));

// WebSockets
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// הפעלת השרת
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = io;
