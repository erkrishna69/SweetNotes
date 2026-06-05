"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables immediately
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const db_1 = require("./config/db");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const notesRoutes_1 = __importDefault(require("./routes/notesRoutes"));
const syncRoutes_1 = __importDefault(require("./routes/syncRoutes"));
const socketHandler_1 = require("./sockets/socketHandler");
const shareRoutes_1 = __importDefault(require("./routes/shareRoutes"));
const teamRoutes_1 = __importDefault(require("./routes/teamRoutes"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Enable Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Allow all origins for Flutter (both Mobile/Desktop development environments)
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
});
// Configure Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(limiter);
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/notes', notesRoutes_1.default);
app.use('/api/sync', syncRoutes_1.default);
app.use('/api/teams', teamRoutes_1.default);
app.use('/share', shareRoutes_1.default);
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date() });
});
// Setup WebSockets
(0, socketHandler_1.setupSocketHandlers)(io);
// Connect Database & Start Server
const PORT = process.env.PORT || 5000;
(0, db_1.connectDB)().then(() => {
    server.listen(PORT, () => {
        console.log(`SweetNotes Backend running on port ${PORT}`);
    });
});
