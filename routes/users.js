const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../config/db');
const { verifyToken, verifyAdmin } = require('../middlewares/auth');

// PATCH /api/users/profile - Update current user profile
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, photoURL, phone, address } = req.body;
    const db = getDB();
    const usersCollection = db.collection('users');

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (photoURL !== undefined) updateFields.photoURL = photoURL;
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;

    const result = await usersCollection.updateOne(
      { email: req.user.email.toLowerCase() },
      { $set: updateFields }
    );

    const updatedUser = await usersCollection.findOne({ email: req.user.email.toLowerCase() });

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        photoURL: updatedUser.photoURL,
        role: updatedUser.role,
        phone: updatedUser.phone,
        address: updatedUser.address,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
});

// GET /api/users - Admin: Get all registered users
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');

    const users = await (await usersCollection.find({})).toArray();
    const safeUsers = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role || 'Customer',
      photoURL: u.photoURL,
      phone: u.phone || '',
      address: u.address || '',
      createdAt: u.createdAt
    }));

    return res.json({
      success: true,
      users: safeUsers
    });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching all users.' });
  }
});

// PATCH /api/users/:id/role - Admin: Change user role (Customer, Owner, Admin)
router.patch('/:id/role', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (!['Customer', 'Owner', 'Admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be Customer, Owner, or Admin.' });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    let query = { _id: id };
    try {
      if (ObjectId.isValid(id)) {
        query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
      }
    } catch (e) {}

    const result = await usersCollection.updateOne(
      { _id: id },
      { $set: { role } }
    );

    return res.json({
      success: true,
      message: `User role successfully changed to ${role}!`
    });
  } catch (err) {
    console.error('Change role error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating user role.' });
  }
});

// DELETE /api/users/:id - Admin: Delete a user
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const usersCollection = db.collection('users');

    await usersCollection.deleteOne({ _id: id });

    return res.json({
      success: true,
      message: 'User removed successfully.'
    });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting user.' });
  }
});

module.exports = router;
