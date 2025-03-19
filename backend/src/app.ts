import express from 'express';
import { PrismaClient } from '@prisma/client';



const cors = require('cors');
const app = express();
export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());



export default app;