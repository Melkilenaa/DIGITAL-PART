import express from 'express';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import addressRoutes from './routes/address.routes';
import customerRoutes from './routes/customer.routes';
import vehicleRoutes from './routes/vehicle.routes';
import categoryRoutes from './routes/category.routes';
import partRoutes from './routes/part.routes';
import vendorRoutes from './routes/vendor.routes';
import promotionRoutes from './routes/promotion.routes';
import inventoryRoutes from './routes/inventory.routes';

const cors = require('cors');
const app = express();
export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/parts', partRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/promotions', promotionRoutes);

export default app;