/**
 * =============================================================
 *  userModel.js
 *  Hotel Management System — User Database Model
 *
 *  All direct MySQL queries for the `users` table live here.
 *  authController.js handles bcrypt hashing — this model
 *  only does raw DB operations.
 * =============================================================
 */

"use strict";

const { pool }  = require("../config/db");
const bcrypt    = require("bcrypt");

const BCRYPT_ROUNDS = 10;

// =============================================================
//  CREATE USER
//  Inserts a new user into the `users` table.
//  NOTE: password field can be:
//    - A plain-text password (will be hashed here)
//    - An already-hashed string starting with '$2b$' (stored as-is)
// =============================================================
const createUser = async ({
  name,
  fullName,
  email,
  password,
  role  = "guest",
  phone = "",
}) => {
  const displayName = fullName || name || "Guest";

  // If password is already hashed by controller, store as-is
  // If plain text, hash it here (fallback safety)
  const storedPassword = password.startsWith("$2b$") || password.startsWith("$2a$")
    ? password
    : await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [result] = await pool.execute(
    `INSERT INTO users
       (full_name, email, password, role, phone)
     VALUES (?, ?, ?, ?, ?)`,
    [
      displayName,
      email.toLowerCase().trim(),
      storedPassword,
      ["guest","staff","admin"].includes(role) ? role : "guest",
      phone || "",
    ]
  );

  return result.insertId;
};

// =============================================================
//  FIND BY EMAIL
//  Returns user row including password hash (for bcrypt.compare)
//  Returns undefined if not found
// =============================================================
const findByEmail = async (email) => {
  const [rows] = await pool.execute(
    `SELECT
       id,
       full_name  AS name,
       email,
       password,
       role,
       phone,
       1          AS is_active,
       created_at AS createdAt
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email.toLowerCase().trim()]
  );
  return rows[0];
};

// =============================================================
//  FIND BY ID
//  Returns user WITHOUT password hash (safe for sending to client)
// =============================================================
const findById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT
       u.id,
       u.full_name  AS name,
       u.email,
       u.role,
       u.phone,
       1            AS is_active,
       u.created_at AS createdAt,
       COALESCE(sp.position,   'Staff')      AS position,
       COALESCE(sp.department, 'Front Desk') AS department,
       COALESCE(sp.salary,     0)            AS salary
     FROM users u
     LEFT JOIN staff_profiles sp ON sp.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0];
};

// =============================================================
//  UPDATE PROFILE
//  Updates allowed profile fields for a given user ID
// =============================================================
const updateProfile = async (id, data) => {
  // Map frontend field names to DB column names
  const FIELD_MAP = {
    name      : "full_name",
    fullName  : "full_name",
    full_name : "full_name",
    email     : "email",
    phone     : "phone",
    address   : "address",
  };

  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && FIELD_MAP[key]) {
      fields.push(`${FIELD_MAP[key]} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return false;

  values.push(id);
  await pool.execute(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
  return true;
};

// =============================================================
//  UPDATE PASSWORD
//  Hashes new password and saves to DB
// =============================================================
const updatePassword = async (id, newPlainPassword) => {
  const hashedPassword = await bcrypt.hash(newPlainPassword, BCRYPT_ROUNDS);
  await pool.execute(
    "UPDATE users SET password = ? WHERE id = ?",
    [hashedPassword, id]
  );
};

// =============================================================
//  COMPARE PASSWORD
//  Wrapper for bcrypt.compare — used in older code paths
// =============================================================
const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

// =============================================================
//  GET ALL USERS (Admin)
// =============================================================
const getAllUsers = async (roleFilter = null) => {
  let query = `
    SELECT id, full_name AS name, email, role, phone,
           1 AS is_active, created_at AS createdAt
    FROM users`;
  const params = [];

  if (roleFilter) {
    query += " WHERE role = ?";
    params.push(roleFilter);
  }

  query += " ORDER BY created_at DESC";
  const [rows] = await pool.execute(query, params);
  return rows;
};

// =============================================================
//  DELETE USER (Admin)
// =============================================================
const deleteUser = async (id) => {
  await pool.execute("DELETE FROM users WHERE id = ?", [id]);
};

module.exports = {
  createUser,
  findByEmail,
  findById,
  updateProfile,
  updatePassword,
  comparePassword,
  getAllUsers,
  deleteUser,
};
