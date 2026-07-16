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
    "INSERT INTO room_types (type_name, price_per_night, capacity, description) VALUES (?, ?, ?, ?)",
    [normalizedType, 2000, 2, `${normalizedType} room`],
  );
  return result.insertId;
};

const createRoom = async ({
  name,
  roomNumber,
  type,
  price_per_night,
  price,
  capacity,
  description,
  image_url,
  status = "available",
}) => {
  const conn = await pool.getConnection();
  try {
    const roomTypeId = await ensureRoomType(conn, type);
    const roomName = roomNumber || name || `R${Date.now()}`;
    const [result] = await conn.execute(
      "INSERT INTO rooms (room_number, room_type_id, floor, room_status) VALUES (?, ?, ?, ?)",
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
           rt.type_name AS type, rt.price_per_night AS price,
           rt.capacity, rt.description, r.room_status AS status,
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
    query += " AND rt.capacity >= ?";
    params.push(filters.capacity);
  }

  if (filters.status) {
    const mappedStatus =
      filters.status === "occupied" ? "occupied" : filters.status;
    query += " AND r.room_status = ?";
    params.push(mappedStatus);
  }

  if (filters.minPrice) {
    query += " AND rt.price_per_night >= ?";
    params.push(filters.minPrice);
  }

  if (filters.maxPrice) {
    query += " AND rt.price_per_night <= ?";
    params.push(filters.maxPrice);
  }

  query += " ORDER BY r.created_at DESC";

  if (filters.limit) {
    query += " LIMIT ?";
    params.push(Number(filters.limit));
  }

  if (filters.page && filters.limit) {
    const offset = (Number(filters.page) - 1) * Number(filters.limit);
    query = query.replace(" LIMIT ?", " LIMIT ? OFFSET ?");
    params.push(offset);
  }

  const [rows] = await pool.execute(query, params);
  return rows;
};

const getRoomById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.room_number AS roomNumber, r.room_number AS name,
            rt.type_name AS type, rt.price_per_night AS price,
            rt.capacity, rt.description, r.room_status AS status,
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
    if (data.price !== undefined || data.price_per_night !== undefined) {
      const newPrice = data.price ?? data.price_per_night;
      await conn.execute(
        "UPDATE room_types rt JOIN rooms r ON r.room_type_id = rt.id SET rt.price_per_night = ? WHERE r.id = ?",
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
    if (data.status !== undefined || data.room_status !== undefined) {
      directFields.push("room_status = ?");
      directValues.push(data.status ?? data.room_status);
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
  await pool.execute("UPDATE rooms SET room_status = ? WHERE id = ?", [
    status,
    id,
  ]);
};

module.exports = {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
};
