const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../config/db');
const { verifyToken, verifyCustomer, verifyOwner, verifyAdmin } = require('../middlewares/auth');

// Helper: calculate duration between dates in days
function calculateRentalDurationDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

// POST /api/bookings - Create new rental booking
router.post('/', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const {
      equipmentId,
      startDate,
      endDate,
      quantity,
      contactNumber,
      deliveryAddress,
      additionalNotes
    } = req.body;

    if (!equipmentId || !startDate || !endDate || !quantity || !contactNumber || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'All booking fields (dates, quantity, contact, address) are required.'
      });
    }

    const reqQty = parseInt(quantity, 10);
    if (isNaN(reqQty) || reqQty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ success: false, message: 'Rental End Date cannot be earlier than Start Date.' });
    }

    const db = getDB();
    const equipmentCollection = db.collection('equipment');
    const bookingsCollection = db.collection('bookings');

    let equipment = await equipmentCollection.findOne({ _id: equipmentId });
    if (!equipment && ObjectId.isValid(equipmentId)) {
      equipment = await equipmentCollection.findOne({ _id: new ObjectId(equipmentId) });
    }

    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    // Availability Check
    if (equipment.availableQuantity < reqQty) {
      return res.status(400).json({
        success: false,
        message: `Only ${equipment.availableQuantity} units available. You requested ${reqQty}.`
      });
    }

    // Duration calculation
    const durationDays = calculateRentalDurationDays(startDate, endDate);

    // Rental amount calculation based on rentalType
    let baseRate = equipment.rentalPrice;
    let totalAmount = 0;

    if (equipment.rentalType === 'Weekly') {
      const weeks = Math.ceil(durationDays / 7);
      totalAmount = baseRate * weeks * reqQty;
    } else if (equipment.rentalType === 'Monthly') {
      const months = Math.ceil(durationDays / 30);
      totalAmount = baseRate * months * reqQty;
    } else {
      // Daily default
      totalAmount = baseRate * durationDays * reqQty;
    }

    const newBooking = {
      equipmentId: String(equipment._id),
      equipmentName: equipment.name,
      equipmentImage: equipment.image,
      category: equipment.category,
      rentalPrice: equipment.rentalPrice,
      rentalType: equipment.rentalType,
      customerName: req.user.name,
      customerEmail: req.user.email.toLowerCase(),
      ownerName: equipment.ownerName,
      ownerEmail: equipment.ownerEmail.toLowerCase(),
      ownerPhone: equipment.ownerPhone || '',
      startDate,
      endDate,
      durationDays,
      quantity: reqQty,
      totalAmount,
      contactNumber,
      deliveryAddress,
      additionalNotes: additionalNotes || '',
      paymentStatus: 'pending', // pending -> paid upon Stripe success
      bookingStatus: 'confirmed', // confirmed -> active -> completed
      createdAt: new Date().toISOString()
    };

    const result = await bookingsCollection.insertOne(newBooking);
    newBooking._id = result.insertedId;

    return res.status(201).json({
      success: true,
      message: 'Booking initiated successfully! Proceeding to payment.',
      booking: newBooking
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating booking.' });
  }
});

// GET /api/bookings/my - Customer: My Rentals
router.get('/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const db = getDB();
    const bookingsCollection = db.collection('bookings');
    const customerEmail = req.user.email.toLowerCase();

    const bookings = await (
      await bookingsCollection
        .find({ customerEmail })
        .sort({ createdAt: -1 })
    ).toArray();

    return res.json({
      success: true,
      bookings
    });
  } catch (err) {
    console.error('Fetch my bookings error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving bookings.' });
  }
});

// GET /api/bookings/owner - Owner: My Equipment Rental
router.get('/owner', verifyToken, verifyOwner, async (req, res) => {
  try {
    const db = getDB();
    const bookingsCollection = db.collection('bookings');
    const ownerEmail = req.user.email.toLowerCase();

    const bookings = await (
      await bookingsCollection
        .find({ ownerEmail })
        .sort({ createdAt: -1 })
    ).toArray();

    return res.json({
      success: true,
      bookings
    });
  } catch (err) {
    console.error('Fetch owner bookings error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving owner rentals.' });
  }
});

// GET /api/bookings/admin - Admin: All Rentals
router.get('/admin', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const bookingsCollection = db.collection('bookings');

    const bookings = await (
      await bookingsCollection
        .find({})
        .sort({ createdAt: -1 })
    ).toArray();

    return res.json({
      success: true,
      bookings
    });
  } catch (err) {
    console.error('Fetch admin bookings error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving all rentals.' });
  }
});

// GET /api/bookings/:id - Single booking details
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const bookingsCollection = db.collection('bookings');

    let booking = await bookingsCollection.findOne({ _id: id });
    if (!booking && ObjectId.isValid(id)) {
      booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Role check: Admin, Owner of the equipment, or Customer who booked
    const userEmail = req.user.email.toLowerCase();
    const isCustomer = booking.customerEmail === userEmail;
    const isOwner = booking.ownerEmail === userEmail;
    const isAdmin = req.user.role === 'Admin';

    if (!isCustomer && !isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this booking.' });
    }

    return res.json({
      success: true,
      booking
    });
  } catch (err) {
    console.error('Fetch booking details error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving booking details.' });
  }
});

// PATCH /api/bookings/:id/status - Update booking status
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingStatus } = req.body;

    const allowedStatuses = ['confirmed', 'active', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(bookingStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid booking status.' });
    }

    const db = getDB();
    const bookingsCollection = db.collection('bookings');

    let booking = await bookingsCollection.findOne({ _id: id });
    if (!booking && ObjectId.isValid(id)) {
      booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Role check: Admin or Owner
    const userEmail = req.user.email.toLowerCase();
    const isOwner = booking.ownerEmail === userEmail;
    const isAdmin = req.user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only equipment owner or admin can update booking status.' });
    }

    await bookingsCollection.updateOne({ _id: booking._id }, { $set: { bookingStatus } });

    return res.json({
      success: true,
      message: `Booking status updated to ${bookingStatus}!`
    });
  } catch (err) {
    console.error('Update booking status error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating booking status.' });
  }
});

// DELETE /api/bookings/:id - Admin: Cancel and delete rental booking
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const bookingsCollection = db.collection('bookings');

    let booking = await bookingsCollection.findOne({ _id: id });
    if (!booking && ObjectId.isValid(id)) {
      booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    await bookingsCollection.deleteOne({ _id: booking._id });

    return res.json({
      success: true,
      message: 'Rental booking record removed successfully by Admin.'
    });
  } catch (err) {
    console.error('Delete booking error:', err);
    return res.status(500).json({ success: false, message: 'Server error removing rental booking.' });
  }
});

module.exports = router;
