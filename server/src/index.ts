import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import path from 'path';
import assetRoutes from './routes/asset.routes';
import collectionRoutes from './routes/collection.routes';
import userRoutes from './routes/user.routes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allow frontend to talk to backend
app.use(express.json()); // Parse JSON bodies

// Serve static files (uploads)
// accessing http://localhost:5000/uploads/filename.jpg
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/thumbnails', express.static(path.join(__dirname, '../uploads/thumbnails')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/users', userRoutes);

// Health Check
app.get('/', (req: Request, res: Response) => {
  res.send('AI DAM API is running 🚀');
});

// Start Server
app.listen(PORT, () => {
  console.log(`⚡️ [server]: Server is running at http://localhost:${PORT}`);
});