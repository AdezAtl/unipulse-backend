const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.io configuration

const allowedOrigins = [
  'https://your-frontend.onrender.com', // your production frontend
  'http://localhost:8080',              // your current dev server
  'http://localhost:3000',              // common React dev server
  'http://127.0.0.1:8080',              // localhost alternative
  'http://localhost:5173'               // Vite dev server
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // increase limit for better UX
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Disable for API
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection with enhanced options
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  console.log('💡 Please set MONGODB_URI in your Render environment variables');
  process.exit(1);
}

// Enhanced MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority',
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 1 // Maintain at least 1 socket connection
};

console.log('🔗 Attempting to connect to MongoDB...');
console.log(`📊 Database: ${MONGODB_URI.split('/').pop().split('?')[0]}`);

mongoose.connect(MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log(`🏠 Host: ${mongoose.connection.host}`);
  console.log(`🗃️ Database: ${mongoose.connection.db.databaseName}`);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('\n🔧 Troubleshooting tips:');
  console.log('   1. Check MONGODB_URI in environment variables');
  console.log('   2. Verify MongoDB Atlas Network Access (IP Whitelist)');
  console.log('   3. Check database user permissions');
  console.log('   4. Ensure cluster is running in MongoDB Atlas');
  process.exit(1);
});

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🗄️ Mongoose connected to MongoDB cluster');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed through app termination');
  process.exit(0);
});

// Socket.io for real-time notifications
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);
  
  socket.on('join-user', (userId) => {
    socket.join(userId);
    console.log(`🎯 User ${userId} joined their room`);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('👋 User disconnected:', socket.id, 'Reason:', reason);
  });
});

// Make io accessible to routes
app.set('io', io);

// Import and use routes with error handling
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/events', require('./routes/events'));
  app.use('/api/posts', require('./routes/posts'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ All routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
}

// Enhanced Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const healthStatus = dbStatus === 1 ? 'healthy' : 'unhealthy';
  
  res.status(dbStatus === 1 ? 200 : 503).json({ 
    status: healthStatus,
    message: 'UniPulse API Health Check',
    database: statusMap[dbStatus],
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: '🚀 UniPulse Backend API',
    version: '1.0.0',
    status: 'operational',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users', 
      events: '/api/events',
      posts: '/api/posts',
      notifications: '/api/notifications',
      admin: '/api/admin',
      health: '/health'
    },
    documentation: 'Add Swagger docs later'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.redirect('/api');
});

// Enhanced Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Error Stack:', err.stack);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: messages
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler - API style
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    availableEndpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
      users: ['GET /api/users', 'GET /api/users/:id', 'PUT /api/users/profile'],
      events: ['GET /api/events', 'POST /api/events', 'POST /api/events/:id/rsvp'],
      posts: ['GET /api/posts', 'POST /api/posts', 'POST /api/posts/:id/like'],
      health: 'GET /health'
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎉 =================================');
  console.log(`🚀 UniPulse Server Started!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 Database: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`📚 API Info: http://localhost:${PORT}/api`);
  console.log('=================================\n');
});