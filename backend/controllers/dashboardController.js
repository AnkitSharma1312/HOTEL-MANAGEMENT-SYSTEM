const { pool } = require("../config/db");

const getStats = async (res, role) => {
  const [rooms] = await pool.query(`
    SELECT
      COUNT(*) AS totalRooms,
      SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) AS availableRooms,
      SUM(CASE WHEN status IN ('occupied','reserved') THEN 1 ELSE 0 END) AS occupied
    FROM rooms
  `);

  const [guests] = await pool.query(`
    SELECT COUNT(*) AS totalGuests
    FROM users
    WHERE role='guest'
  `);

  const [todayBookings] = await pool.query(`
    SELECT COUNT(*) AS checkInsToday
    FROM bookings
    WHERE DATE(created_at)=CURDATE()
  `);

  const [revenue] = await pool.query(`
    SELECT COALESCE(SUM(amount),0) AS revenueToday
    FROM payments
    WHERE payment_status='completed'
  `);

  const [pending] = await pool.query(`
    SELECT COUNT(*) AS pendingBookings
    FROM bookings
    WHERE booking_status='pending'
  `);

  const [recentActivities] = await pool.query(`
    SELECT id,
           booking_status AS status,
           created_at AS createdAt
    FROM bookings
    ORDER BY created_at DESC
    LIMIT 5
  `);

  res.json({
    success: true,
    data: {
      role,
      stats: {
        totalRooms: rooms[0].totalRooms || 0,
        availableRooms: rooms[0].availableRooms || 0,
        occupied: rooms[0].occupied || 0,
        totalGuests: guests[0].totalGuests || 0,
        checkInsToday: todayBookings[0].checkInsToday || 0,
        revenueToday: revenue[0].revenueToday || 0,
        pendingBookings: pending[0].pendingBookings || 0,
      },
      recentActivities,
      weeklyRevenue: [],
    },
  });
};

const adminDashboard = async (req, res, next) => {
  try {
    await getStats(res, "admin");
  } catch (err) {
    console.error("Dashboard Error:", err);
    next(err);
  }
};

const staffDashboard = async (req, res, next) => {
  try {
    await getStats(res, "staff");
  } catch (err) {
    console.error("Dashboard Error:", err);
    next(err);
  }
};

const guestDashboard = async (req, res, next) => {
  try {
    const [bookings] = await pool.query(
      "SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC LIMIT 5",
      [req.user.id],
    );

    res.json({
      success: true,
      data: {
        role: "guest",
        bookings,
      },
    });
  } catch (err) {
    console.error("Guest Dashboard Error:", err);
    next(err);
  }
};

module.exports = {
  adminDashboard,
  staffDashboard,
  guestDashboard,
};
