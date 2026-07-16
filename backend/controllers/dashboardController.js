const { pool } = require("../config/db");

const getStats = async (res, role) => {
  const [rooms] = await pool.query(
    'SELECT COUNT(*) AS totalRooms, SUM(CASE WHEN room_status = "available" THEN 1 ELSE 0 END) AS availableRooms, SUM(CASE WHEN room_status IN ("occupied", "reserved") THEN 1 ELSE 0 END) AS occupied FROM rooms',
  );
  const [guests] = await pool.query(
    'SELECT COUNT(*) AS totalGuests FROM users WHERE role = "guest"',
  );
  const [todayBookings] = await pool.query(
    "SELECT COUNT(*) AS checkInsToday FROM bookings WHERE DATE(created_at) = CURDATE()",
  );
  const [revenue] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS revenueToday FROM payments WHERE payment_status = "paid"',
  );
  const [pending] = await pool.query(
    'SELECT COUNT(*) AS pendingBookings FROM bookings WHERE booking_status = "pending"',
  );
  const [recentActivities] = await pool.query(
    "SELECT id, booking_status AS status, created_at AS createdAt FROM bookings ORDER BY created_at DESC LIMIT 5",
  );

  res.status(200).json({
    success: true,
    message: "Dashboard data fetched successfully",
    data: {
      role,
      stats: {
        totalRooms: rooms[0].totalRooms,
        availableRooms: rooms[0].availableRooms,
        occupied: rooms[0].occupied,
        totalGuests: guests[0].totalGuests,
        checkInsToday: todayBookings[0].checkInsToday,
        revenueToday: revenue[0].revenueToday,
        pendingBookings: pending[0].pendingBookings,
      },
      recentActivities,
      weeklyRevenue: [],
    },
  });
};

const adminDashboard = async (req, res, next) => {
  try {
    await getStats(res, "admin");
  } catch (error) {
    next(error);
  }
};

const staffDashboard = async (req, res, next) => {
  try {
    await getStats(res, "staff");
  } catch (error) {
    next(error);
  }
};

const guestDashboard = async (req, res, next) => {
  try {
    const [bookings] = await pool.query(
      "SELECT * FROM bookings WHERE guest_id = ? ORDER BY created_at DESC LIMIT 5",
      [req.user.id],
    );
    res.status(200).json({
      success: true,
      message: "Guest dashboard data fetched successfully",
      data: { role: "guest", bookings },
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminDashboard,
  staffDashboard,
  guestDashboard,
};
