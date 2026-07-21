"use strict";

const { pool } = require("../config/db");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

const createUser = async ({
  fullName,
  name,
  email,
  password,
  role = "guest",
  phone = "",
}) => {
  const userName = (fullName || name || "").trim();

  const passwordHash =
    password.startsWith("$2a$") ||
    password.startsWith("$2b$") ||
    password.startsWith("$2y$")
      ? password
      : await bcrypt.hash(password, SALT_ROUNDS);

  const [result] = await pool.execute(
    `
    INSERT INTO users
    (
      full_name,
      email,
      password_hash,
      role,
      phone
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [userName, email.trim().toLowerCase(), passwordHash, role, phone || null],
  );

  return result.insertId;
};

const findByEmail = async (email) => {
  const [rows] = await pool.execute(
    `
    SELECT
      id,
      full_name,
      email,
      password_hash,
      role,
      phone,
      created_at
    FROM users
    WHERE email = ?
    LIMIT 1
    `,
    [email.trim().toLowerCase()],
  );

  return rows.length ? rows[0] : null;
};

const findById = async (id) => {
  const [rows] = await pool.execute(
    `
    SELECT
      id,
      full_name,
      email,
      role,
      phone,
      created_at
    FROM users
    WHERE id=?
    LIMIT 1
    `,
    [id],
  );

  return rows.length ? rows[0] : null;
};

const comparePassword = async (plain, hash) => {
  return bcrypt.compare(plain, hash);
};

const updatePassword = async (id, password) => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  await pool.execute(
    `
    UPDATE users
    SET password_hash=?
    WHERE id=?
    `,
    [hash, id],
  );

  return true;
};

const updateProfile = async (id, data) => {
  const fields = [];
  const values = [];

  if (data.full_name !== undefined) {
    fields.push("full_name=?");
    values.push(data.full_name);
  }

  if (data.phone !== undefined) {
    fields.push("phone=?");
    values.push(data.phone);
  }

  if (data.email !== undefined) {
    fields.push("email=?");
    values.push(data.email.trim().toLowerCase());
  }

  if (!fields.length) return false;

  values.push(id);

  await pool.execute(
    `
    UPDATE users
    SET ${fields.join(",")}
    WHERE id=?
    `,
    values,
  );

  return true;
};

const getAllUsers = async (role = null) => {
  let sql = `
  SELECT
    id,
    full_name,
    email,
    role,
    phone,
    created_at
  FROM users`;

  const params = [];

  if (role) {
    sql += " WHERE role=?";
    params.push(role);
  }

  sql += " ORDER BY id DESC";

  const [rows] = await pool.execute(sql, params);

  return rows;
};

const deleteUser = async (id) => {
  await pool.execute("DELETE FROM users WHERE id=?", [id]);
};

module.exports = {
  createUser,
  findByEmail,
  findById,
  comparePassword,
  updatePassword,
  updateProfile,
  getAllUsers,
  deleteUser,
};
