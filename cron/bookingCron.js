const cron = require('node-cron');
const { getDB, ObjectId } = require('../config/db');

// Simulation helper for email notifications (PDF page 15 Optional Requirement 4)
function sendRentalCompletedEmailNotification({ customerEmail, ownerEmail, equipmentName, bookingId }) {
  console.log(`\n======================================================`);
  console.log(` [NOTIFICATION] AUTOMATED EMAIL DISPATCHED`);
  console.log(` To Renter: ${customerEmail}`);
  console.log(` To Owner: ${ownerEmail}`);
  console.log(` Subject: Rental Completed - ${equipmentName} (ID: ${bookingId})`);
  console.log(` Message: Your rental period has officially concluded. Thank you for using EquipRent!`);
  console.log(`======================================================\n`);
}

// Function to scan and complete expired bookings
async function checkAndCompleteExpiredBookings() {
  try {
    const db = getDB();
    const bookingsCollection = db.collection('bookings');
    const equipmentCollection = db.collection('equipment');

    const now = new Date();
    const activeBookings = await (
      await bookingsCollection.find({
        bookingStatus: { $in: ['confirmed', 'active'] }
      })
    ).toArray();

    let completedCount = 0;

    for (const booking of activeBookings) {
      const endDate = new Date(booking.endDate);
      // If the rental end date has passed
      if (endDate < now) {
        await bookingsCollection.updateOne(
          { _id: booking._id },
          { $set: { bookingStatus: 'completed', completedAt: now.toISOString() } }
        );

        // Restore equipment available quantity
        const qtyToRestore = Number(booking.quantity) || 1;
        let equip = await equipmentCollection.findOne({ _id: booking.equipmentId });
        if (!equip && ObjectId.isValid(booking.equipmentId)) {
          equip = await equipmentCollection.findOne({ _id: new ObjectId(booking.equipmentId) });
        }
        if (equip) {
          await equipmentCollection.updateOne(
            { _id: equip._id },
            { $inc: { availableQuantity: qtyToRestore } }
          );
        }

        // Send automated email notifications
        sendRentalCompletedEmailNotification({
          customerEmail: booking.customerEmail,
          ownerEmail: booking.ownerEmail,
          equipmentName: booking.equipmentName,
          bookingId: booking._id
        });

        completedCount++;
      }
    }

    if (completedCount > 0) {
      console.log(` [node-cron] Automatically marked ${completedCount} expired rentals as completed.`);
    }

    return { success: true, updated: completedCount };
  } catch (err) {
    console.error(' [node-cron] Error during automated booking status update:', err.message);
    return { success: false, error: err.message };
  }
}

// Schedule cron job to run at midnight every day (0 0 * * *) and every 30 minutes in dev
function initBookingCron() {
  // Cron schedule: every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running scheduled rental expiry check via node-cron...');
    await checkAndCompleteExpiredBookings();
  });
  console.log(' Node-cron automated booking status updates initialized successfully.');
}

module.exports = { initBookingCron, checkAndCompleteExpiredBookings };
