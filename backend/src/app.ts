import express from 'express';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';



const cors = require('cors');
const app = express();
export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

export default app;