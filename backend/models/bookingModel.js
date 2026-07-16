const { pool } = require("../config/db");

const createBooking = async ({
  user_id,
  room_id,
  check_in_date,
  check_out_date,
  guests,
  total_amount,
  status = "pending",
}) => {
  const [result] = await pool.execute(
    "INSERT INTO bookings (guest_id, room_id, check_in, check_out, adults, children, total_amount, booking_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      user_id,
      room_id,
      check_in_date,
      check_out_date,
      guests,
      0,
      total_amount,
      status,
    ],
  );
  return result.insertId;
};

const getBookings = async (userId = null, role = null) => {
  let query = `
    SELECT b.id, b.guest_id AS guestId, b.room_id AS roomId,
           b.check_in AS checkIn, b.check_out AS checkOut,
           b.adults, b.children, b.total_amount AS totalAmount,
           b.booking_status AS status, b.created_at AS createdAt,
           r.room_number AS roomNumber, u.full_name AS guestName
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN users u ON b.guest_id = u.id`;
  const params = [];

  if (userId && role !== "admin") {
    query += " WHERE b.guest_id = ?";
    params.push(userId);
  }

  query += " ORDER BY b.created_at DESC";
  const [rows] = await pool.execute(query, params);
  return rows;
};

const getBookingById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT b.id, b.guest_id AS guestId, b.room_id AS roomId,
            b.check_in AS checkIn, b.check_out AS checkOut,
            b.adults, b.children, b.total_amount AS totalAmount,
            b.booking_status AS status, b.created_at AS createdAt,
            r.room_number AS roomNumber, u.full_name AS guestName
     FROM bookings b
     JOIN rooms r ON b.room_id = r.id
     JOIN users u ON b.guest_id = u.id
     WHERE b.id = ?`,
    [id],
  );
  return rows[0];
};

const updateBooking = async (id, data) => {
  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      const mappedKey = key === "status" ? "booking_status" : key;
      fields.push(`${mappedKey} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    return false;
  }

  values.push(id);
  await pool.execute(
    `UPDATE bookings SET ${fields.join(", ")} WHERE id = ?`,
    values,
  );
  return true;
};

const deleteBooking = async (id) => {
  await pool.execute("DELETE FROM bookings WHERE id = ?", [id]);
};

const getBookingOverlap = async (room_id, check_in_date, check_out_date) => {
  const [rows] = await pool.execute(
    'SELECT id FROM bookings WHERE room_id = ? AND booking_status IN ("pending", "confirmed", "checked_in") AND ((check_in <= ? AND check_out > ?) OR (check_in < ? AND check_out >= ?) OR (check_in >= ? AND check_out <= ?))',
    [
      room_id,
      check_in_date,
      check_in_date,
      check_out_date,
      check_out_date,
      check_in_date,
      check_out_date,
    ],
  );
  return rows;
};

const createPayment = async ({
  booking_id,
  amount,
  payment_method,
  status = "paid",
  transaction_id,
}) => {
  await pool.execute(
    "INSERT INTO payments (booking_id, amount, payment_method, payment_status, transaction_id) VALUES (?, ?, ?, ?, ?)",
    [booking_id, amount, payment_method, status, transaction_id || null],
  );
};

const getPayments = async (userId = null) => {
  let query = `
    SELECT p.id, p.booking_id AS bookingId, p.amount, p.payment_method AS paymentMethod,
           p.payment_status AS paymentStatus, p.transaction_id AS transactionId,
           p.payment_date AS paymentDate, b.check_in AS checkIn, b.check_out AS checkOut,
           u.full_name AS guestName
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN users u ON b.guest_id = u.id`;
  const params = [];

  if (userId) {
    query += " WHERE b.guest_id = ?";
    params.push(userId);
  }

  query += " ORDER BY p.payment_date DESC";
  const [rows] = await pool.execute(query, params);
  return rows;
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  getBookingOverlap,
  createPayment,
  getPayments,
};
