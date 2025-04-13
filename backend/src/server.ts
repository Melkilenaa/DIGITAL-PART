import app from "./app";
import dotenv from "dotenv";
import cors from 'cors';
import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import messageService from './services/message.service';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = new HttpServer(app);

// Initialize Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: "*", // Allow all origins for testing
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"]
  }
});

// Add debugging information
io.engine.on("connection_error", (err) => {
  console.log(`Socket.IO connection error: ${err.message}`);
  console.log(`Error code: ${err.code}`);
  console.log(`Context: ${JSON.stringify(err.context)}`);
});

// Connect Socket.IO to MessageService
messageService.setSocketServer(io);

// CORS configuration
app.use(cors({
    origin: ['http://localhost:4200', 'https://79tnt9g9-4200.uks1.devtunnels.ms/'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Socket.IO server running on ws://localhost:${PORT}`);
    console.log(`Server time: ${new Date().toLocaleString('en-US', { timeZone: process.env.TZ })}`);
});