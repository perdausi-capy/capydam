import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http'; 
import { Server } from 'socket.io'; 

dotenv.config();

// Import Routes
import authRoutes from './routes/auth.routes';
import assetRoutes from './routes/asset.routes';
import userRoutes from './routes/user.routes';
import collectionRoutes from './routes/collection.routes';
import categoryRoutes from './routes/category.routes'; 
import feedbackRoutes from './routes/feedback.routes';
import adminRoutes from './routes/admin.routes';
import analyticsRoutes from './routes/analytics.routes';
import uploadRoutes from './routes/uploadRoutes'; // ✅ Imported

// Import Services
import { initCronJobs } from './services/cron.service';
import { setupSocketIO } from './socket/socketHandler';

const app: Express = express();
const PORT = process.env.PORT || 5000;

// ✅ CREATE HTTP SERVER
const server = http.createServer(app);

// ✅ INITIALIZE SOCKET.IO
const io = new Server(server, {
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
app.use(cors({
  origin: [
    'http://localhost:5173', 
    process.env.CLIENT_URL || "" 
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true 
}));

app.use(express.json());

// ✅ REGISTER ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/feedback', feedbackRoutes);

// ✅ NEW: Chat Upload Route (This was missing!)
app.use('/api/upload', uploadRoutes); 

// ✅ Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ✅ SOCKET LOGIC (Only call this once)
console.log('🛠️ [Server] Initializing Socket.io...');
setupSocketIO(io);

// Debug Route
app.get('/', (req: Request, res: Response) => {
  res.send('Capydam API is running 🐹');
});

// ✅ START SERVER
server.listen(PORT, () => {
  console.log(`⚡️ [server]: Server is running at http://localhost:${PORT}`);
  console.log(`   - Auth Routes: /api/auth`);
  console.log(`   - Asset Routes: /api/assets`);
  console.log(`   - Upload Route: /api/upload`); // ✅ Verify this shows up
  console.log(`   - Socket.io: Enabled 🟢`);

  // Initialize Cron Jobs
  initCronJobs();
});