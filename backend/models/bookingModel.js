const { pool } = require("../config/db");

const createBooking = async ({
  user_id,
  room_id,
  check_in_date,
  check_out_date,
  guests,
  total_amount,
  services = null,
  services_total = 0,
  special_requests = "",
  status = "pending",
}) => {
  const [result] = await pool.execute(
    "INSERT INTO bookings (user_id, room_id, check_in, check_out, adults, children, total_amount, booking_status, services, services_total, special_requests) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      user_id,
      room_id,
      check_in_date,
      check_out_date,
      guests,
      0,
      total_amount,
      status,
      services ? JSON.stringify(services) : null,
      services_total || 0,
      special_requests || "",
    ],
  );
  return result.insertId;
};

const getBookings = async (userId = null, role = null) => {
  let query = `
    SELECT b.id, b.user_id AS user_Id, b.room_id AS roomId,
           b.check_in AS checkIn, b.check_out AS checkOut,
           b.adults, b.children, b.total_amount AS totalAmount,
           b.booking_status AS status, b.created_at AS createdAt,
           b.services, b.services_total AS servicesTotal,
           b.special_requests AS specialRequests,
           r.room_number AS roomNumber,
           rt.type_name AS roomType,
           rt.base_price AS roomPrice,
           u.full_name AS guestName, u.email AS guestEmail, u.phone AS guestPhone,
           p.payment_method AS paymentMethod, p.payment_status AS paymentStatus,
           p.transaction_id AS transactionId, p.amount AS paidAmount
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN room_types rt ON r.room_type_id = rt.id
    JOIN users u ON b.user_id = u.id
    LEFT JOIN payments p ON p.booking_id = b.id`;
  const params = [];

  if (userId && role !== "admin" && role !== "staff") {
    query += " WHERE b.user_id = ?";
    params.push(userId);
  }

  query += " ORDER BY b.created_at DESC";
  const [rows] = await pool.execute(query, params);
  return rows.map((r) => ({
    ...r,
    services: r.services
      ? typeof r.services === "string"
        ? JSON.parse(r.services)
        : r.services
      : [],
  }));
};

const getBookingById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT b.id, b.user_id AS userId, b.room_id AS roomId,
            b.check_in AS checkIn, b.check_out AS checkOut,
            b.adults, b.children, b.total_amount AS totalAmount,
            b.booking_status AS status, b.created_at AS createdAt,
            b.services, b.services_total AS servicesTotal,
            b.special_requests AS specialRequests,
            r.room_number AS roomNumber,
            rt.type_name AS roomType,
            rt.base_price AS roomPrice,
            u.full_name AS guestName, u.email AS guestEmail, u.phone AS guestPhone,
            p.payment_method AS paymentMethod, p.payment_status AS paymentStatus,
            p.transaction_id AS transactionId, p.amount AS paidAmount
     FROM bookings b
     JOIN rooms r ON b.room_id = r.id
     JOIN room_types rt ON r.room_type_id = rt.id
     JOIN users u ON b.user_id = u.id
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE b.id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return undefined;
  return {
    ...row,
    services: row.services
      ? typeof row.services === "string"
        ? JSON.parse(row.services)
        : row.services
      : [],
  };
};

const updateBooking = async (id, data) => {
  // Only allow updating these specific columns — prevents SQL errors from extra fields
  const ALLOWED = {
    booking_status: "booking_status",
    status: "booking_status",
    adults: "adults",
    children: "children",
    special_requests: "special_requests",
    total_amount: "total_amount",
  };

  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    const col = ALLOWED[key];
    if (col && value !== undefined && value !== null) {
      fields.push(`${col} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return false;

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
    JOIN users u ON b.user_id = u.id`;
  const params = [];

  if (userId) {
    query += " WHERE b.user_id = ?";
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
