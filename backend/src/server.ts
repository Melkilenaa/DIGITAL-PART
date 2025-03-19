import app from "./app";
import dotenv from "dotenv";
import cors from 'cors';
import { Server } from 'http';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = new Server(app);

// CORS configuration
app.use(cors({
    origin: ['http://localhost:4200', 'https://79tnt9g9-4200.uks1.devtunnels.ms/'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server time: ${new Date().toLocaleString('en-US', { timeZone: process.env.TZ })}`);
});

