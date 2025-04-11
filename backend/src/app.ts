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
import payoutRoutes from './routes/payout.routes';
import paymentRoutes from './routes/payment.routes';
import orderRoutes from './routes/order.routes';
import orderItemRoutes from './routes/orderitem.routes';
import locationRoutes from './routes/location.routes';
import deliveryRoutes from './routes/delivery.routes';
import driverRoutes from './routes/driver.routes';
import notificationRoutes from './routes/notification.routes';

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
app.use('/api/payments', paymentRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/order-items', orderItemRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/notifications', notificationRoutes);

export default app;