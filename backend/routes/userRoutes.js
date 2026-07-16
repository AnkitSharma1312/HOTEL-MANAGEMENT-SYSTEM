const express = require("express");
const { body, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { pool } = require("../config/db");
const { updateProfile, findByEmail } = require("../models/userModel");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
  }
  next();
};

router.get("/", auth, role("admin"), async (req, res, next) => {
  try {
    const roleFilter = req.query.role || "";
    let query =
      "SELECT id, full_name AS name, email, role, phone, created_at AS createdAt FROM users";
    const params = [];
    if (roleFilter) {
      query += " WHERE role = ?";
      params.push(roleFilter);
    }
    query += " ORDER BY created_at DESC";
    const [rows] = await pool.query(query, params);
    res
      .status(200)
      .json({
        success: true,
        message: "Users fetched successfully",
        data: rows,
        users: rows,
      });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", auth, role("admin"), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, full_name AS name, email, role, phone, created_at AS createdAt FROM users WHERE id = ?",
      [req.params.id],
    );
    if (!rows[0]) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: { user: rows[0] },
      user: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", auth, role("admin"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully", data: {} });
  } catch (error) {
    next(error);
  }
});

router.put("/profile", auth, async (req, res, next) => {
  try {
    const payload = {
      full_name: req.body.fullName || req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    };
    const updated = await updateProfile(req.user.id, payload);
    const [rows] = await pool.query(
      "SELECT id, full_name AS name, email, role, phone, created_at AS createdAt FROM users WHERE id = ?",
      [req.user.id],
    );
    res
      .status(200)
      .json({
        success: true,
        message: "Profile updated successfully",
        data: { user: rows[0] },
        user: rows[0],
      });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/staff",
  auth,
  role("admin"),
  [body("email").isEmail(), body("password").isLength({ min: 6 })],
  validate,
  async (req, res, next) => {
    try {
      const existing = await findByEmail(req.body.email);
      if (existing) {
        return res
          .status(409)
          .json({ success: false, message: "Email already registered" });
      }
      const { createUser } = require("../models/userModel");
      const id = await createUser({
        name: req.body.name || "Staff",
        email: req.body.email,
        password: req.body.password,
        role: "staff",
        phone: req.body.phone || "",
      });
      const [rows] = await pool.query(
        "SELECT id, full_name AS name, email, role, phone, created_at AS createdAt FROM users WHERE id = ?",
        [id],
      );
      res
        .status(201)
        .json({
          success: true,
          message: "Staff user created",
          data: { user: rows[0] },
          user: rows[0],
        });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
