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

// Root API Status Landing Page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SweetNotes API | Online</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-dark: #07080B;
          --bg-card: rgba(15, 16, 23, 0.45);
          --color-primary: #8250FF;
          --color-primary-light: #B494FF;
          --color-accent: #00C8A0;
          --text-white: #F4F4F6;
          --text-gray: rgba(244, 244, 246, 0.7);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: var(--bg-dark);
          color: var(--text-white);
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
          position: relative;
        }
        .glow-circle {
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.15;
          z-index: 1;
        }
        .glow-1 {
          background: radial-gradient(circle, var(--color-primary) 0%, transparent 70%);
          top: -10%;
          right: 10%;
        }
        .glow-2 {
          background: radial-gradient(circle, var(--color-accent) 0%, transparent 70%);
          bottom: -10%;
          left: 10%;
        }
        .container {
          position: relative;
          z-index: 10;
          width: 90%;
          max-width: 480px;
          padding: 40px;
          border-radius: 20px;
          background: var(--bg-card);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(130, 80, 255, 0.2);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), 0 0 30px rgba(130, 80, 255, 0.05);
          text-align: center;
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .logo-row {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .logo-icon {
          color: var(--color-primary-light);
          display: flex;
          align-items: center;
        }
        .logo-text {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #FFF;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 20px;
          background: rgba(0, 200, 160, 0.08);
          border: 1px solid rgba(0, 200, 160, 0.25);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-accent);
          margin-bottom: 20px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          background-color: var(--color-accent);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--color-accent);
          animation: pulse 1.5s infinite alternate;
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          100% { opacity: 1; transform: scale(1.2); }
        }
        h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 28px;
          color: #FFF;
          margin-bottom: 12px;
        }
        p {
          font-size: 14.5px;
          color: var(--text-gray);
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .footer-note {
          font-size: 12px;
          color: rgba(244, 244, 246, 0.35);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="glow-circle glow-1"></div>
      <div class="glow-circle glow-2"></div>
      
      <div class="container">
        <div class="logo-row">
          <span class="logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </span>
          <span class="logo-text">SweetNotes</span>
        </div>
        
        <div>
          <span class="status-badge">
            <span class="status-dot"></span>
            API Gateway Online
          </span>
        </div>
        
        <h1>System Operational</h1>
        <p>The SweetNotes backend database links, synchronization pipelines, and collaborative workspace routes are fully active and healthy.</p>
        
        <div class="footer-note">
          Powered by Kxoproduction • Technology for you
        </div>
      </div>
    </body>
    </html>
  `);
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
