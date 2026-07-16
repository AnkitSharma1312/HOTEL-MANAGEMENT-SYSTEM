const { pool } = require("../config/db");
const bcrypt = require("bcrypt");

const createUser = async ({
  name,
  fullName,
  email,
  password,
  role = "guest",
  phone,
}) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const displayName = fullName || name || "Guest";
  const [result] = await pool.execute(
    "INSERT INTO users (full_name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)",
    [displayName, email, hashedPassword, role, phone || ""],
  );
  return result.insertId;
};

const findByEmail = async (email) => {
  const [rows] = await pool.execute(
    "SELECT id, full_name AS name, email, password, role, phone, created_at AS createdAt FROM users WHERE email = ?",
    [email],
  );
  return rows[0];
};

const findById = async (id) => {
  const [rows] = await pool.execute(
    "SELECT id, full_name AS name, email, role, phone, created_at FROM users WHERE id = ?",
    [id],
  );
  return rows[0];
};

const updateProfile = async (id, data) => {
  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === "name") {
        fields.push("full_name = ?");
      } else {
        fields.push(`${key} = ?`);
      }
      values.push(value);
    }
  });

  if (!fields.length) return false;
  values.push(id);
  await pool.execute(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    values,
  );
  return true;
};

const updatePassword = async (id, password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.execute("UPDATE users SET password = ? WHERE id = ?", [
    hashedPassword,
    id,
  ]);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

module.exports = {
  createUser,
  findByEmail,
  findById,
  updateProfile,
  updatePassword,
  comparePassword,
};
