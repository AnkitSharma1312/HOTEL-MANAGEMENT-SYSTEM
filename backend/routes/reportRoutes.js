const express = require("express");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { pool } = require("../config/db");

const router = express.Router();

router.get(
  "/dashboard",
  auth,
  role("admin", "staff"),
  async (req, res, next) => {
    try {
      const [roomRows] = await pool.query(
        'SELECT COUNT(*) AS totalRooms, SUM(CASE WHEN status = "available" THEN 1 ELSE 0 END) AS availableRooms, SUM(CASE WHEN status IN ("occupied", "reserved") THEN 1 ELSE 0 END) AS occupied FROM rooms',
      );
      const [guestRows] = await pool.query(
        'SELECT COUNT(*) AS totalGuests FROM users WHERE role = "guest"',
      );
      const [todayRows] = await pool.query(
        "SELECT COUNT(*) AS checkInsToday FROM bookings WHERE DATE(created_at) = CURDATE()",
      );
      const [revenueRows] = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) AS revenueToday FROM payments WHERE payment_status = "paid"',
      );
      const [pendingRows] = await pool.query(
        'SELECT COUNT(*) AS pendingBookings FROM bookings WHERE booking_status = "pending"',
      );
      const [recentRows] = await pool.query(
        "SELECT id, booking_status AS status, created_at AS createdAt FROM bookings ORDER BY created_at DESC LIMIT 8",
      );

      res.status(200).json({
        success: true,
        message: "Dashboard data fetched successfully",
        data: {
          totalRooms: roomRows[0].totalRooms,
          availableRooms: roomRows[0].availableRooms,
          occupied: roomRows[0].occupied,
          totalGuests: guestRows[0].totalGuests,
          checkInsToday: todayRows[0].checkInsToday,
          revenueToday: revenueRows[0].revenueToday,
          pendingBookings: pendingRows[0].pendingBookings,
          recentBookings: recentRows,
          weeklyRevenue: [],
        },
        totalRooms: roomRows[0].totalRooms,
        occupied: roomRows[0].occupied,
        checkInsToday: todayRows[0].checkInsToday,
        revenueToday: revenueRows[0].revenueToday,
        pendingBookings: pendingRows[0].pendingBookings,
        recentBookings: recentRows,
        weeklyRevenue: [],
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
