import dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import notesRoutes from './routes/notesRoutes';
import syncRoutes from './routes/syncRoutes';
import { setupSocketHandlers } from './sockets/socketHandler';
import shareRoutes from './routes/shareRoutes';
import teamRoutes from './routes/teamRoutes';


const app = express();
const server = http.createServer(app);

// Enable Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for Flutter (both Mobile/Desktop development environments)
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// Configure Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/teams', teamRoutes);
app.use('/share', shareRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Setup WebSockets
setupSocketHandlers(io);

// Connect Database & Start Server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`SweetNotes Backend running on port ${PORT}`);
  });
});
