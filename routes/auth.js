const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_equiprent_2026_secure';

// Helper: validate password rules
function validatePassword(password) {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  return null;
}

// Generate JWT helper
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role || 'Customer'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, photoURL, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role === 'Owner' ? 'Owner' : (role === 'Admin' ? 'Admin' : 'Customer');

    const newUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      photoURL: photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      role: assignedRole,
      phone: req.body.phone || '',
      address: req.body.address || '',
      createdAt: new Date().toISOString()
    };

    const result = await usersCollection.insertOne(newUser);
    newUser._id = result.insertedId;

    const token = generateToken(newUser);

    const safeUser = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      photoURL: newUser.photoURL,
      role: newUser.role,
      phone: newUser.phone,
      address: newUser.address,
      createdAt: newUser.createdAt
    };

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to EquipRent.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
      role: user.role || 'Customer',
      phone: user.phone || '',
      address: user.address || '',
      createdAt: user.createdAt
    };

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { email, name, photoURL } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account email is required.' });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    let user = await usersCollection.findOne({ email: email.toLowerCase() });

    if (!user) {
      // By default, users registering through Google receive Customer role
      const newUser = {
        name: name || 'Google User',
        email: email.toLowerCase(),
        password: '',
        photoURL: photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        role: 'Customer',
        phone: '',
        address: '',
        isGoogleAuth: true,
        createdAt: new Date().toISOString()
      };
      const result = await usersCollection.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const token = generateToken(user);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
      role: user.role || 'Customer',
      phone: user.phone || '',
      address: user.address || '',
      createdAt: user.createdAt
    };

    return res.json({
      success: true,
      message: 'Google login successful!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during Google login.' });
  }
});

module.exports = router;
