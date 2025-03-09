import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authRouter } from './routes/auth.routes';
import { patentRouter } from './routes/patent.routes';
import { subscriptionRouter } from './routes/subscription.routes';
import { authenticateToken } from './middleware/auth';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!require('fs').existsSync(uploadsDir)) {
      require('fs').mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

export const upload = multer({ storage });

// Configure middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(json({ limit: '50mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/patents', authenticateToken, patentRouter);
app.use('/api/subscriptions', authenticateToken, subscriptionRouter);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR'
    }
  });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
  console.log(`📁 File uploads available at http://localhost:${PORT}/uploads`);
}); 