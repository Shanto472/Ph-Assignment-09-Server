const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { verifyToken, verifyOwner, verifyAdmin } = require('../middlewares/auth');

// Helper: generate last 6 months list
function getLast6Months() {
  const months = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
      monthName: monthNames[d.getMonth()]
    });
  }
  return months;
}

// GET /api/analytics/admin - Dynamic Admin Dashboard Analytics (Challenge 3)
router.get('/admin', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    const equipmentCollection = db.collection('equipment');
    const bookingsCollection = db.collection('bookings');
    const paymentsCollection = db.collection('payments');

    const [allUsers, allEquipment, allBookings, allPayments] = await Promise.all([
      (await usersCollection.find({})).toArray(),
      (await equipmentCollection.find({})).toArray(),
      (await bookingsCollection.find({})).toArray(),
      (await paymentsCollection.find({})).toArray()
    ]);

    const totalUsers = allUsers.length;
    const totalEquipment = allEquipment.length;
    const pendingApprovals = allEquipment.filter(e => e.status === 'pending').length;
    const approvedEquipment = allEquipment.filter(e => e.status === 'approved').length;
    const totalBookings = allBookings.length;
    const completedRentals = allBookings.filter(b => b.bookingStatus === 'completed').length;
    const activeRentals = allBookings.filter(b => b.bookingStatus === 'active' || b.bookingStatus === 'confirmed').length;

    // Total Revenue from payments collection
    const totalRevenue = allPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // Monthly booking & revenue statistics
    const months = getLast6Months();
    const monthlyStats = months.map(m => {
      const monthBookings = allBookings.filter(b => (b.createdAt || '').startsWith(m.key));
      const monthPayments = allPayments.filter(p => (p.paidAt || '').startsWith(m.key));
      const revenue = monthPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      return {
        month: m.label,
        bookings: monthBookings.length,
        revenue: revenue
      };
    });

    // Category Distribution
    const categoryCounts = {};
    allEquipment.forEach(e => {
      const cat = e.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryDistribution = Object.keys(categoryCounts).map(name => ({
      name,
      count: categoryCounts[name]
    }));

    // User Roles Count
    const userRoles = {
      customers: allUsers.filter(u => u.role === 'Customer').length,
      owners: allUsers.filter(u => u.role === 'Owner').length,
      admins: allUsers.filter(u => u.role === 'Admin').length
    };

    return res.json({
      success: true,
      analytics: {
        totalUsers,
        totalEquipment,
        pendingApprovals,
        approvedEquipment,
        totalBookings,
        completedRentals,
        activeRentals,
        totalRevenue,
        monthlyStats,
        categoryDistribution,
        userRoles
      }
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error computing admin analytics.' });
  }
});

// GET /api/analytics/owner - Dynamic Owner Dashboard Analytics (Challenge 3)
router.get('/owner', verifyToken, verifyOwner, async (req, res) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');
    const bookingsCollection = db.collection('bookings');
    const paymentsCollection = db.collection('payments');

    const ownerEmail = req.user.email.toLowerCase();

    const [ownerEquipment, ownerBookings, ownerPayments] = await Promise.all([
      (await equipmentCollection.find({ ownerEmail })).toArray(),
      (await bookingsCollection.find({ ownerEmail })).toArray(),
      (await paymentsCollection.find({ ownerEmail })).toArray()
    ]);

    const totalListedEquipment = ownerEquipment.length;
    const approvedEquipment = ownerEquipment.filter(e => e.status === 'approved').length;
    const pendingEquipment = ownerEquipment.filter(e => e.status === 'pending').length;
    const totalBookings = ownerBookings.length;
    const completedRentals = ownerBookings.filter(b => b.bookingStatus === 'completed').length;
    const activeRentals = ownerBookings.filter(b => b.bookingStatus === 'active' || b.bookingStatus === 'confirmed').length;

    // Total earnings from payments
    const totalEarnings = ownerPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // Monthly Earnings
    const months = getLast6Months();
    const monthlyEarnings = months.map(m => {
      const monthBookings = ownerBookings.filter(b => (b.createdAt || '').startsWith(m.key));
      const monthPayments = ownerPayments.filter(p => (p.paidAt || '').startsWith(m.key));
      const earnings = monthPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      return {
        month: m.label,
        bookings: monthBookings.length,
        earnings
      };
    });

    return res.json({
      success: true,
      analytics: {
        totalListedEquipment,
        approvedEquipment,
        pendingEquipment,
        totalBookings,
        completedRentals,
        activeRentals,
        totalEarnings,
        monthlyEarnings,
        recentBookings: ownerBookings.slice(0, 5)
      }
    });
  } catch (err) {
    console.error('Owner analytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error computing owner analytics.' });
  }
});

module.exports = router;
