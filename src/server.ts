import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import routes from "./routes";
import mongoose from 'mongoose';
import path from 'path';

dotenv.config();

// Create an instance of express
const app = express();

// Define a port
const PORT = process.env.DB_PORT || 4040;

// Middleware to parse JSON with increased payload limit
app.use(express.json({ limit: '50mb' })); // Increase limit to 50MB (adjust as needed)
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increase limit for form data

// Use CORS
app.use(cors()); // Enable CORS for all routes
app.use("/uploads", express.static(path.resolve("uploads")));

app.use("/api", routes);
// Example route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, YOCO Stays with TypeScript with Node.js!');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || '')
  .then(() => {
    console.log('MongoDB connected');
    // Start the server only after the connection is successful
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit the process with failure
  });
