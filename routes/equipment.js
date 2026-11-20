const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../config/db');
const { verifyToken, verifyOwner, verifyAdmin } = require('../middlewares/auth');

// POST /api/equipment - Owners can add new equipment for rent
router.post('/', verifyToken, verifyOwner, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      location,
      rentalPrice,
      rentalType,
      availableQuantity,
      condition,
      brand,
      model,
      image,
      rentalTerms
    } = req.body;

    if (!name || !category || !location || !rentalPrice || !image) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, location, rental price, and equipment image are required.'
      });
    }

    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const newEquipment = {
      name: name.trim(),
      description: description || '',
      category: category.trim(),
      location: location.trim(),
      rentalPrice: Number(rentalPrice),
      rentalType: rentalType || 'Daily',
      availableQuantity: Math.max(1, Number(availableQuantity) || 1),
      condition: condition || 'Good',
      brand: brand || '',
      model: model || '',
      image: image.trim(),
      rentalTerms: rentalTerms || 'Standard equipment rental agreement applies.',
      status: 'pending', // default pending as requested in PDF page 9 & 11
      ownerName: req.user.name || 'Equipment Owner',
      ownerEmail: req.user.email.toLowerCase(),
      ownerPhone: req.body.ownerPhone || '',
      rating: 5.0,
      reviewsCount: 0,
      createdAt: new Date().toISOString()
    };

    const result = await equipmentCollection.insertOne(newEquipment);
    newEquipment._id = result.insertedId;

    return res.status(201).json({
      success: true,
      message: 'Equipment submitted successfully! Awaiting administrator approval.',
      equipment: newEquipment
    });
  } catch (err) {
    console.error('Create equipment error:', err);
    return res.status(500).json({ success: false, message: 'Server error adding equipment.' });
  }
});

// GET /api/equipment/featured - Display 6 approved equipment items using MongoDB limit
router.get('/featured', async (req, res) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const items = await (
      await equipmentCollection
        .find({ status: 'approved' })
        .sort({ createdAt: -1 })
        .limit(6)
    ).toArray();

    return res.json({
      success: true,
      count: items.length,
      equipment: items
    });
  } catch (err) {
    console.error('Featured equipment error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching featured equipment.' });
  }
});

// GET /api/equipment - All Equipment with server-side search, filters, sorting & pagination (Challenge 1)
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const {
      search,
      category,
      rentalType,
      minPrice,
      maxPrice,
      availability,
      sortBy,
      page = 1,
      limit = 9
    } = req.query;

    const query = { status: 'approved' };

    // Search by Name or Location (Challenge 1 & PDF page 7)
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { location: searchRegex },
        { category: searchRegex },
        { brand: searchRegex }
      ];
    }

    // Filter by Category
    if (category && category !== 'All' && category !== 'all') {
      query.category = category;
    }

    // Filter by Rental Type (Daily, Weekly, Monthly)
    if (rentalType && rentalType !== 'All' && rentalType !== 'all') {
      query.rentalType = rentalType;
    }

    // Filter by Price Range
    if (minPrice || maxPrice) {
      query.rentalPrice = {};
      if (minPrice) query.rentalPrice.$gte = Number(minPrice);
      if (maxPrice) query.rentalPrice.$lte = Number(maxPrice);
    }

    // Filter by Availability
    if (availability === 'available' || availability === 'in-stock') {
      query.availableQuantity = { $gt: 0 };
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // default newest
    if (sortBy === 'price-low') {
      sortOption = { rentalPrice: 1 };
    } else if (sortBy === 'price-high') {
      sortOption = { rentalPrice: -1 };
    } else if (sortBy === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sortBy === 'rating') {
      sortOption = { rating: -1 };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 9);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await equipmentCollection.countDocuments(query);
    const items = await (
      await equipmentCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
    ).toArray();

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    return res.json({
      success: true,
      equipment: items,
      totalCount,
      totalPages,
      currentPage: pageNum,
      limit: limitNum
    });
  } catch (err) {
    console.error('Fetch all equipment error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving equipment.' });
  }
});

// GET /api/equipment/meta/filters - Get metadata for filters and category counts
router.get('/meta/filters', async (req, res) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const approvedItems = await (
      await equipmentCollection.find({ status: 'approved' })
    ).toArray();

    const categories = [
      'Construction Equipment',
      'Photography Equipment',
      'Vehicles & Transportation',
      'Agriculture Equipment',
      'Electronics',
      'Event Equipment'
    ];

    const categoryCounts = {};
    categories.forEach(cat => {
      categoryCounts[cat] = approvedItems.filter(item => item.category === cat).length;
    });

    const prices = approvedItems.map(i => Number(i.rentalPrice) || 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 1000;

    return res.json({
      success: true,
      categories,
      categoryCounts,
      totalApproved: approvedItems.length,
      minPrice,
      maxPrice
    });
  } catch (err) {
    console.error('Meta filters error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving filter metadata.' });
  }
});

// GET /api/equipment/owner/my - Equipment added by logged-in owner
router.get('/owner/my', verifyToken, verifyOwner, async (req, res) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const items = await (
      await equipmentCollection
        .find({ ownerEmail: req.user.email.toLowerCase() })
        .sort({ createdAt: -1 })
    ).toArray();

    return res.json({
      success: true,
      equipment: items
    });
  } catch (err) {
    console.error('Owner equipment error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching owner equipment.' });
  }
});

// GET /api/equipment/admin/all - Admin: All equipment with any status
router.get('/admin/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const items = await (
      await equipmentCollection
        .find({})
        .sort({ createdAt: -1 })
    ).toArray();

    return res.json({
      success: true,
      equipment: items
    });
  } catch (err) {
    console.error('Admin equipment error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching admin equipment.' });
  }
});

// GET /api/equipment/:id - Single equipment details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    let item = await equipmentCollection.findOne({ _id: id });
    if (!item && ObjectId.isValid(id)) {
      item = await equipmentCollection.findOne({ _id: new ObjectId(id) });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    return res.json({
      success: true,
      equipment: item
    });
  } catch (err) {
    console.error('Fetch equipment details error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving equipment details.' });
  }
});

// PATCH /api/equipment/:id - Update equipment (Owner or Admin)
router.patch('/:id', verifyToken, verifyOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    let item = await equipmentCollection.findOne({ _id: id });
    if (!item && ObjectId.isValid(id)) {
      item = await equipmentCollection.findOne({ _id: new ObjectId(id) });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    // Verify ownership unless Admin
    if (req.user.role !== 'Admin' && item.ownerEmail !== req.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this equipment.' });
    }

    const {
      name,
      description,
      category,
      location,
      rentalPrice,
      rentalType,
      availableQuantity,
      condition,
      brand,
      model,
      image,
      rentalTerms
    } = req.body;

    const updates = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (category) updates.category = category.trim();
    if (location) updates.location = location.trim();
    if (rentalPrice !== undefined) updates.rentalPrice = Number(rentalPrice);
    if (rentalType) updates.rentalType = rentalType;
    if (availableQuantity !== undefined) updates.availableQuantity = Number(availableQuantity);
    if (condition) updates.condition = condition;
    if (brand !== undefined) updates.brand = brand;
    if (model !== undefined) updates.model = model;
    if (image) updates.image = image.trim();
    if (rentalTerms !== undefined) updates.rentalTerms = rentalTerms;

    await equipmentCollection.updateOne({ _id: item._id }, { $set: updates });

    const updated = await equipmentCollection.findOne({ _id: item._id });

    return res.json({
      success: true,
      message: 'Equipment updated successfully!',
      equipment: updated
    });
  } catch (err) {
    console.error('Update equipment error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating equipment.' });
  }
});

// DELETE /api/equipment/:id - Delete equipment (Owner or Admin)
router.delete('/:id', verifyToken, verifyOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    let item = await equipmentCollection.findOne({ _id: id });
    if (!item && ObjectId.isValid(id)) {
      item = await equipmentCollection.findOne({ _id: new ObjectId(id) });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    // Verify ownership unless Admin
    if (req.user.role !== 'Admin' && item.ownerEmail !== req.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this equipment.' });
    }

    // Also remove from any customer favorites to keep state consistent
    const favoritesCollection = db.collection('favorites');
    await favoritesCollection.deleteOne({ equipmentId: String(item._id) });

    await equipmentCollection.deleteOne({ _id: item._id });

    return res.json({
      success: true,
      message: 'Equipment deleted successfully.'
    });
  } catch (err) {
    console.error('Delete equipment error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting equipment.' });
  }
});

// PATCH /api/equipment/:id/status - Admin: Approve or Reject equipment
router.patch('/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved, rejected, or pending.' });
    }

    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    let item = await equipmentCollection.findOne({ _id: id });
    if (!item && ObjectId.isValid(id)) {
      item = await equipmentCollection.findOne({ _id: new ObjectId(id) });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    await equipmentCollection.updateOne({ _id: item._id }, { $set: { status } });

    return res.json({
      success: true,
      message: `Equipment status updated to ${status}!`
    });
  } catch (err) {
    console.error('Status update error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating equipment status.' });
  }
});

module.exports = router;
