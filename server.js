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
const allowedOrigins = [
    'http://localhost:5173',
    'http://taskmanager-client-2pyw.onrender.com'
  ];
  
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true); // מאשר את הבקשה
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
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
