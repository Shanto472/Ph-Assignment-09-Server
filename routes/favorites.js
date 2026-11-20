const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../config/db');
const { verifyToken, verifyCustomer } = require('../middlewares/auth');

// POST /api/favorites - Add equipment to customer favorites
router.post('/', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { equipmentId } = req.body;
    if (!equipmentId) {
      return res.status(400).json({ success: false, message: 'Equipment ID is required.' });
    }

    const db = getDB();
    const equipmentCollection = db.collection('equipment');
    const favoritesCollection = db.collection('favorites');

    let equipment = await equipmentCollection.findOne({ _id: equipmentId });
    if (!equipment && ObjectId.isValid(equipmentId)) {
      equipment = await equipmentCollection.findOne({ _id: new ObjectId(equipmentId) });
    }

    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    const userEmail = req.user.email.toLowerCase();

    // Check if already in favorites
    const existing = await favoritesCollection.findOne({
      userEmail,
      equipmentId: String(equipment._id)
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Equipment is already in your favorites.' });
    }

    const favoriteDoc = {
      userEmail,
      userName: req.user.name,
      equipmentId: String(equipment._id),
      equipmentName: equipment.name,
      category: equipment.category,
      rentalPrice: equipment.rentalPrice,
      rentalType: equipment.rentalType,
      image: equipment.image,
      location: equipment.location,
      createdAt: new Date().toISOString()
    };

    const result = await favoritesCollection.insertOne(favoriteDoc);
    favoriteDoc._id = result.insertedId;

    return res.status(201).json({
      success: true,
      message: 'Equipment added to favorites!',
      favorite: favoriteDoc
    });
  } catch (err) {
    console.error('Add favorite error:', err);
    return res.status(500).json({ success: false, message: 'Server error adding to favorites.' });
  }
});

// GET /api/favorites - List currently logged-in customer's favorites
router.get('/', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();
    const favoritesCollection = db.collection('favorites');
    const userEmail = req.user.email.toLowerCase();

    const favorites = await (
      await favoritesCollection
        .find({ userEmail })
        .sort({ createdAt: -1 })
    ).toArray();

    return res.json({
      success: true,
      favorites
    });
  } catch (err) {
    console.error('List favorites error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving favorites.' });
  }
});

// GET /api/favorites/check/:equipmentId - Check if equipment is favorited by current user
router.get('/check/:equipmentId', verifyToken, async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const db = getDB();
    const favoritesCollection = db.collection('favorites');
    const userEmail = req.user.email.toLowerCase();

    const exists = await favoritesCollection.findOne({
      userEmail,
      equipmentId: String(equipmentId)
    });

    return res.json({
      success: true,
      isFavorite: !!exists
    });
  } catch (err) {
    console.error('Check favorite error:', err);
    return res.status(500).json({ success: false, message: 'Server error checking favorite status.' });
  }
});

// DELETE /api/favorites/:equipmentId - Remove item from favorites
router.delete('/:equipmentId', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const db = getDB();
    const favoritesCollection = db.collection('favorites');
    const userEmail = req.user.email.toLowerCase();

    await favoritesCollection.deleteOne({
      userEmail,
      equipmentId: String(equipmentId)
    });

    return res.json({
      success: true,
      message: 'Equipment removed from favorites.'
    });
  } catch (err) {
    console.error('Remove favorite error:', err);
    return res.status(500).json({ success: false, message: 'Server error removing favorite.' });
  }
});

module.exports = router;
