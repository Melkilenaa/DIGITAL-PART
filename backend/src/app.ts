import express from 'express';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import addressRoutes from './routes/address.routes';
import customerRoutes from './routes/customer.routes';
import vehicleRoutes from './routes/vehicle.routes';

const cors = require('cors');
const app = express();
export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vehicles', vehicleRoutes);

export default app;