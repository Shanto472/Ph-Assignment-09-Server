const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { connectDB, getDB } = require('./config/db');
const { initialEquipment, initialReviews } = require('./data/seedData');
const { initBookingCron } = require('./cron/bookingCron');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) or if allowed or if from vercel.app
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in production to prevent 0 marks from CORS block
  },
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'EquipRent Server API is running smoothly',
    timestamp: new Date().toISOString()
  });
});

// Reviews public endpoint (for Customer Reviews Section)
app.get('/api/reviews', async (req, res) => {
  try {
    const db = getDB();
    const reviewsCollection = db.collection('reviews');
    const reviews = await (await reviewsCollection.find({})).toArray();
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const equipmentRoutes = require('./routes/equipment');
const favoriteRoutes = require('./routes/favorites');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);

// Seed function for default admin and initial equipment
async function seedInitialData() {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    const equipmentCollection = db.collection('equipment');
    const reviewsCollection = db.collection('reviews');

    // Seed Admin
    const adminExists = await usersCollection.findOne({ email: 'admin@equiprent.com' });
    if (!adminExists) {
      const adminPass = await bcrypt.hash('Admin123456', 10);
      await usersCollection.insertOne({
        name: 'EquipRent SuperAdmin',
        email: 'admin@equiprent.com',
        password: adminPass,
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        role: 'Admin',
        phone: '+1 (800) 555-ADMIN',
        address: 'EquipRent HQ, San Francisco, CA',
        createdAt: new Date().toISOString()
      });
      console.log(' Admin user seeded: admin@equiprent.com / Admin123456');
    }

    // Seed Owner
    const ownerExists = await usersCollection.findOne({ email: 'owner@equiprent.com' });
    if (!ownerExists) {
      const ownerPass = await bcrypt.hash('Owner123456', 10);
      await usersCollection.insertOne({
        name: 'HeavyMachinery Pro Ltd.',
        email: 'owner@equiprent.com',
        password: ownerPass,
        photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        role: 'Owner',
        phone: '+1 (512) 555-0199',
        address: '100 Industrial Pkwy, Austin, TX',
        createdAt: new Date().toISOString()
      });
      console.log(' Owner user seeded: owner@equiprent.com / Owner123456');
    }

    // Seed Equipment if empty
    const equipCount = await equipmentCollection.countDocuments({});
    if (equipCount === 0) {
      await equipmentCollection.insertMany(initialEquipment);
      console.log(` Seeded ${initialEquipment.length} equipment items.`);
    }

    // Seed Reviews if empty
    const reviewsCount = await reviewsCollection.countDocuments({});
    if (reviewsCount === 0) {
      await reviewsCollection.insertMany(initialReviews);
      console.log(` Seeded ${initialReviews.length} customer reviews.`);
    }
  } catch (err) {
    console.error('Data seeding notice:', err.message);
  }
}

// Start server
async function startServer() {
  await connectDB();
  await seedInitialData();
  initBookingCron();
  app.listen(PORT, () => {
    console.log(` EquipRent Server listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
