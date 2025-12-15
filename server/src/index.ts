import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';

// Import Routes
import authRoutes from './routes/auth.routes';
import assetRoutes from './routes/asset.routes';
import userRoutes from './routes/user.routes';
import collectionRoutes from './routes/collection.routes';

// ✅ 1. MAKE SURE THIS IMPORT IS HERE
import categoryRoutes from './routes/category.routes'; 



const app: Express = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:5173', 
    process.env.CLIENT_URL || "" // Automatically allows your prod domain
  ],
  credentials: true 
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/collections', collectionRoutes);

// ✅ 2. CRITICAL: REGISTER THE CATEGORY ROUTE
// This tells the server: "When someone asks for /api/categories, go to categoryRoutes"
app.use('/api/categories', categoryRoutes);

// Debug Route to verify server is alive
app.get('/', (req: Request, res: Response) => {
  res.send('Capydam API is running 🐹');
});

app.listen(PORT, () => {
  console.log(`⚡️ [server]: Server is running at http://localhost:${PORT}`);
  console.log(`   - Auth Routes: /api/auth`);
  console.log(`   - Asset Routes: /api/assets`);
  console.log(`   - Category Routes: /api/categories`); // <--- Check your terminal for this line
});