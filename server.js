const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ✅ Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: [
      'https://your-frontend.onrender.com',
      'http://localhost:8080',
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'http://localhost:5173'
    ],
    methods: ['GET', 'POST']
  }
});

const allowedOrigins = [
  'https://your-frontend.onrender.com',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://localhost:5173'
];

// CORS configuration
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple in-memory database (for testing)
const db = {
  users: [],
  events: [],
  posts: [],
  notifications: []
};

// File-based storage functions
const DATA_FILE = path.join(__dirname, 'data.json');

// Load data from file
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    Object.assign(db, parsed);
    console.log('✅ Data loaded from file');
  } catch (error) {
    console.log('📁 No existing data file, starting fresh');
    // Initialize with some test data
    db.users = [
      {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        department: 'Computer Science',
        year: 'Junior',
        createdAt: new Date().toISOString()
      }
    ];
    await saveData();
  }
}

// Save data to file
async function saveData() {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
    console.log('💾 Data saved to file');
  } catch (error) {
    console.error('❌ Error saving data:', error.message);
  }
}

// Initialize data storage
loadData();

// Helper functions for local storage
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function findUserByEmail(email) {
  return db.users.find(user => user.email === email);
}

function findUserById(id) {
  return db.users.find(user => user.id === id);
}

// Make db accessible to routes
app.set('db', db);
app.set('saveData', saveData);
app.set('generateId', generateId);

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

// Simple auth routes for testing
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, department, year } = req.body;
    
    // Check if user already exists
    if (findUserByEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Create new user
    const user = {
      id: generateId(),
      name,
      email,
      password, // In real app, hash this!
      department,
      year,
      createdAt: new Date().toISOString()
    };
    
    db.users.push(user);
    await saveData();
    
    console.log('✅ User registered:', email);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        year: user.year
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    console.log('✅ User logged in:', email);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        year: user.year
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Simple test endpoints
app.get('/api/users', (req, res) => {
  res.json({
    success: true,
    users: db.users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      year: user.year
    }))
  });
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, description, date, location } = req.body;
    
    const event = {
      id: generateId(),
      title,
      description,
      date,
      location,
      createdAt: new Date().toISOString(),
      attendees: []
    };
    
    db.events.push(event);
    await saveData();
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.get('/api/events', (req, res) => {
  res.json({
    success: true,
    events: db.events
  });
});

// Enhanced Health check endpoint
app.get('/health', async (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    message: 'UniPulse API Health Check',
    database: 'local-storage',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    stats: {
      users: db.users.length,
      events: db.events.length,
      posts: db.posts.length
    }
  });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: '🚀 UniPulse Backend API (Local Storage)',
    version: '1.0.0',
    status: 'operational',
    database: 'local-storage',
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login'],
      users: 'GET /api/users',
      events: ['GET /api/events', 'POST /api/events'],
      health: 'GET /health'
    },
    note: 'Using local file storage for testing'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.redirect('/api');
});

// Enhanced Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Error Stack:', err.stack);
  
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
      auth: ['POST /api/auth/register', 'POST /api/auth/login'],
      users: 'GET /api/users',
      events: ['GET /api/events', 'POST /api/events'],
      health: 'GET /health'
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎉 =================================');
  console.log(`🚀 UniPulse Server Started!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: Local Storage`);
  console.log(`📁 Data File: ${DATA_FILE}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`📚 API Info: http://localhost:${PORT}/api`);
  console.log('=================================\n');
  console.log('📝 Test Endpoints:');
  console.log(`   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   GET  http://localhost:${PORT}/api/users`);
  console.log('=================================\n');
});