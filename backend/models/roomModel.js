const { pool } = require("../config/db");

const normalizeRoomType = (type) => {
  if (!type) return "Standard";
  const mapping = {
    presidential: "Presidential Suite",
    villa: "Villa",
  };
  return mapping[type.toLowerCase()] || type;
};

const ensureRoomType = async (conn, type) => {
  const normalizedType = normalizeRoomType(type);
  const [rows] = await conn.execute(
    "SELECT id FROM room_types WHERE type_name = ?",
    [normalizedType],
  );
  if (rows[0]) return rows[0].id;

  const [result] = await conn.execute(
    "INSERT INTO room_types (type_name, base_price, max_occupancy, description) VALUES (?, ?, ?, ?)",
    [normalizedType, 2000, 2, `${normalizedType} room`],
  );
  return result.insertId;
};

const createRoom = async ({
  name,
  roomNumber,
  type,
  base_price,
  max_occupancy,
  description,
  image_url,
  status = "available",
}) => {
  const conn = await pool.getConnection();
  try {
    const roomTypeId = await ensureRoomType(conn, type);
    const roomName = roomNumber || name || `R${Date.now()}`;
    const [result] = await conn.execute(
      "INSERT INTO rooms (room_number, room_type_id, floor, status) VALUES (?, ?, ?, ?)",
      [roomName, roomTypeId, 1, status || "available"],
    );
    return result.insertId;
  } finally {
    conn.release();
  }
};

const getAllRooms = async (filters = {}) => {
  let query = `
    SELECT r.id, r.room_number AS roomNumber, r.room_number AS name,
           rt.type_name AS type, rt.base_price AS price,
           rt.max_occupancy, rt.description, r.status AS status,
           r.created_at AS createdAt
    FROM rooms r
    JOIN room_types rt ON rt.id = r.room_type_id
    WHERE 1=1`;
  const params = [];

  if (filters.search) {
    query += " AND (r.room_number LIKE ? OR rt.type_name LIKE ?)";
    const search = `%${filters.search}%`;
    params.push(search, search);
  }

  if (filters.type) {
    const normalizedType = normalizeRoomType(filters.type);
    query += " AND rt.type_name = ?";
    params.push(normalizedType);
  }

  if (filters.capacity) {
    query += " AND rt.max_occupancy >= ?";
    params.push(parseInt(filters.capacity, 10));
  }

  if (filters.status) {
    const mappedStatus =
      filters.status === "occupied" ? "occupied" : filters.status;
    query += " AND r.status = ?";
    params.push(mappedStatus);
  }

  if (filters.minPrice) {
    query += " AND rt.base_price >= ?";
    params.push(parseFloat(filters.minPrice));
  }

  if (filters.maxPrice) {
    query += " AND rt.price <= ?";
    params.push(parseFloat(filters.maxPrice));
  }

  query += " ORDER BY r.created_at DESC";

  // mysql2 pool.execute() LIMIT/OFFSET placeholders support nahi karta
  // dynamic queries mein, isliye directly embed karo (parseInt se safe hai)
  const limitVal = filters.limit ? parseInt(filters.limit, 10) : null;
  const pageVal = filters.page ? parseInt(filters.page, 10) : 1;

  if (limitVal && limitVal > 0) {
    const offset = pageVal > 1 ? (pageVal - 1) * limitVal : 0;
    query += ` LIMIT ${limitVal}`;
    if (offset > 0) query += ` OFFSET ${offset}`;
  }

  // pool.query (not pool.execute) for dynamic queries with LIKE/LIMIT
  const [rows] = await pool.query(query, params);
  return rows;
};

const getRoomById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.room_number AS roomNumber, r.room_number AS name,
            rt.type_name AS type, rt.base_price AS price,
            rt.max_occupancy, rt.description, r.status AS status,
            r.created_at AS createdAt
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.id = ?`,
    [id],
  );
  return rows[0];
};

const updateRoom = async (id, data) => {
  const conn = await pool.getConnection();
  try {
    // If type is being changed, look up or create the room_type
    if (data.type) {
      const roomTypeId = await ensureRoomType(conn, data.type);
      await conn.execute("UPDATE rooms SET room_type_id = ? WHERE id = ?", [
        roomTypeId,
        id,
      ]);
    }

    // If price is being changed, update price_per_night on the linked room_type
    if (data.price !== undefined || data.price !== undefined) {
      const newPrice = data.price ?? data.price;
      await conn.execute(
        "UPDATE room_types rt JOIN rooms r ON r.room_type_id = rt.id SET rt.base_price = ? WHERE r.id = ?",
        [newPrice, id],
      );
    }

    // If capacity is being changed, update on the linked room_type
    if (data.capacity !== undefined) {
      await conn.execute(
        "UPDATE room_types rt JOIN rooms r ON r.room_type_id = rt.id SET rt.capacity = ? WHERE r.id = ?",
        [data.capacity, id],
      );
    }

    // If description is being changed, update on the linked room_type
    if (data.description !== undefined) {
      await conn.execute(
        "UPDATE room_types rt JOIN rooms r ON r.room_type_id = rt.id SET rt.description = ? WHERE r.id = ?",
        [data.description, id],
      );
    }

    // Update direct room fields
    const directFields = [];
    const directValues = [];
    if (data.roomNumber !== undefined || data.name !== undefined) {
      directFields.push("room_number = ?");
      directValues.push(data.roomNumber ?? data.name);
    }
    if (data.status !== undefined || data.status !== undefined) {
      directFields.push("status = ?");
      directValues.push(data.status ?? data.status);
    }
    if (data.floor !== undefined) {
      directFields.push("floor = ?");
      directValues.push(data.floor);
    }

    if (directFields.length > 0) {
      directValues.push(id);
      await conn.execute(
        `UPDATE rooms SET ${directFields.join(", ")} WHERE id = ?`,
        directValues,
      );
    }

    return true;
  } finally {
    conn.release();
  }
};

const deleteRoom = async (id) => {
  await pool.execute("DELETE FROM rooms WHERE id = ?", [id]);
};

const updateRoomStatus = async (id, status) => {
  await pool.execute("UPDATE rooms SET status = ? WHERE id = ?", [status, id]);
};

module.exports = {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
};
