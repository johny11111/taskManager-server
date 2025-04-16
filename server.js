const express = require('express');
const connectDB = require('./config/db');
const http = require('http');
const googleRoutes = require('./routes/googleAuth');
const cors = require('cors'); 
const { Server } = require('socket.io');
require('dotenv').config();
const cookieParser = require('cookie-parser');



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// connect to database
connectDB();


const allowedOrigins = [
  'http://localhost:5173',
  'https://taskmanager-client-2pyw.onrender.com',
  'https://localhost',
  "https://managertask.com",
  'capacitor://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('❌ חסימת CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());
app.use(express.json());

// routes
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/google', googleRoutes);

// WebSockets
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// start server 
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = io;
