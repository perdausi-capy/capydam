"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
dotenv_1.default.config();
// Import Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const asset_routes_1 = __importDefault(require("./routes/asset.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const collection_routes_1 = __importDefault(require("./routes/collection.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const feedback_routes_1 = __importDefault(require("./routes/feedback.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes")); // ✅ Imported
const itt_routes_1 = __importDefault(require("./routes/itt.routes")); // ✅ ITT System
// Import Services
const cron_service_1 = require("./services/cron.service");
const socketHandler_1 = require("./socket/socketHandler");
const gsap_routes_1 = __importDefault(require("./routes/gsap.routes"));
const daily_routes_1 = __importDefault(require("./routes/daily.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// ✅ CREATE HTTP SERVER
const server = http_1.default.createServer(app);
// ✅ INITIALIZE SOCKET.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            process.env.CLIENT_URL || ""
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});
// ✅ MIDDLEWARES
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN"); // Allows framing only by your own site
    next();
});
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        process.env.CLIENT_URL || ""
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express_1.default.json());
// ✅ REGISTER ROUTES
app.use('/api/auth', auth_routes_1.default);
app.use('/api/assets', asset_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/collections', collection_routes_1.default);
app.use('/api/categories', category_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/feedback', feedback_routes_1.default);
// ✅ NEW ITT ROUTES
app.use('/api/itt', itt_routes_1.default);
// ✅ NEW: Chat Upload Route (This was missing!)
app.use('/api/upload', uploadRoutes_1.default);
app.use('/api/gsap-library', gsap_routes_1.default);
// ✅ Serve uploaded files statically
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/api/daily', daily_routes_1.default);
// ✅ SOCKET LOGIC (Only call this once)
console.log('🛠️ [Server] Initializing Socket.io...');
(0, socketHandler_1.setupSocketIO)(io);
// Debug Route
app.get('/', (req, res) => {
    res.send('Capydam API is running 🐹');
});
// ✅ START SERVER
server.listen(PORT, () => {
    console.log(`⚡️ [server]: Server is running at http://localhost:${PORT}`);
    console.log(`   - Auth Routes: /api/auth`);
    console.log(`   - Asset Routes: /api/assets`);
    console.log(`   - Upload Route: /api/upload`); // ✅ Verify this shows up
    console.log(`   - GSAP Routes: /api/gsap-library`); // ✅ Confirmed
    console.log(`   - Socket.io: Enabled 🟢`);
    // Initialize Cron Jobs
    (0, cron_service_1.initCronJobs)();
});
