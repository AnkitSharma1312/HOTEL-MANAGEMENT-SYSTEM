"use strict";
const express = require("express");
const { body, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { pool } = require("../config/db");
const { updateProfile, findByEmail } = require("../models/userModel");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  next();
};

// ── LIST USERS ────────────────────────────────────────────────
router.get("/", auth, role("admin", "staff"), async (req, res, next) => {
  try {
    const roleFilter = req.query.role || "";
    const effectiveRole =
      req.user.role === "staff" && !roleFilter ? "guest" : roleFilter;
    let query =
      "SELECT id, full_name AS name, email, role, phone, created_at AS createdAt FROM users";
    const params = [];
    if (effectiveRole) {
      query += " WHERE role = ?";
      params.push(effectiveRole);
    }
    query += " ORDER BY full_name ASC";
    const [rows] = await pool.query(query, params);
    res.status(200).json({
      success: true,
      message: "Users fetched",
      data: rows,
      users: rows,
    });
  } catch (err) {
    next(err);
  }
});

// ── SPECIFIC ROUTES BEFORE /:id ───────────────────────────────

// Update own profile
router.put("/profile", auth, async (req, res, next) => {
  try {
    const payload = {
      full_name: req.body.fullName || req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    };
    await updateProfile(req.user.id, payload);
    const [rows] = await pool.query(
      "SELECT id, full_name AS name, email, role, phone, created_at AS createdAt FROM users WHERE id = ?",
      [req.user.id],
    );
    res.status(200).json({
      success: true,
      message: "Profile updated",
      data: { user: rows[0] },
      user: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// Create staff member
router.post(
  "/staff",
  auth,
  role("admin"),
  [body("email").isEmail(), body("password").isLength({ min: 6 })],
  validate,
  async (req, res, next) => {
    try {
      const existing = await findByEmail(req.body.email);
      if (existing)
        return res
          .status(409)
          .json({ success: false, message: "Email already registered" });
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
      res.status(201).json({
        success: true,
        message: "Staff user created",
        data: { user: rows[0] },
        user: rows[0],
      });
    } catch (err) {
      next(err);
    }
  },
);

// Get all staff with salary/position profiles
router.get("/staff-profiles", auth, role("admin"), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.full_name AS name, u.email, u.phone,
             COALESCE(sp.position, 'Staff')      AS position,
             COALESCE(sp.department, 'Front Desk') AS department,
             COALESCE(sp.salary, 0)               AS salary,
             sp.joining_date                       AS joiningDate,
             sp.last_paid_date                     AS lastPaidDate,
             sp.id                                 AS profileId
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.role = 'staff'
      ORDER BY u.full_name ASC
    `);
    res.status(200).json({ success: true, data: rows, staff: rows });
  } catch (err) {
    next(err);
  }
});

// Update staff profile (position/salary)
router.put(
  "/staff-profiles/:userId",
  auth,
  role("admin"),
  async (req, res, next) => {
    try {
      const { position, department, salary, joining_date } = req.body;
      const userId = req.params.userId;
      const [ex] = await pool.query(
        "SELECT id FROM staff_profiles WHERE user_id=?",
        [userId],
      );
      if (ex[0]) {
        await pool.query(
          "UPDATE staff_profiles SET position=?, department=?, salary=?, joining_date=? WHERE user_id=?",
          [
            position || "Staff",
            department || "Front Desk",
            salary || 0,
            joining_date || null,
            userId,
          ],
        );
      } else {
        await pool.query(
          "INSERT INTO staff_profiles (user_id, position, department, salary, joining_date) VALUES (?,?,?,?,?)",
          [
            userId,
            position || "Staff",
            department || "Front Desk",
            salary || 0,
            joining_date || null,
          ],
        );
      }
      res.status(200).json({ success: true, message: "Staff profile updated" });
    } catch (err) {
      next(err);
    }
  },
);

// Pay salary
router.post(
  "/staff-profiles/:userId/pay",
  auth,
  role("admin"),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);

      let [profile] = await pool.query(
        "SELECT * FROM staff_profiles WHERE user_id=?",
        [userId],
      );

      if (!profile.length) {
        await pool.query(
          `INSERT INTO staff_profiles
          (user_id,position,department,salary,joining_date)
          VALUES (?,?,?,?,?)`,
          [
            userId,
            "Staff",
            "front_desk",
            req.body.amount || 25000,
            new Date().toISOString().slice(0, 10),
          ],
        );

        [profile] = await pool.query(
          "SELECT * FROM staff_profiles WHERE user_id=?",
          [userId],
        );
      }
      const amount = req.body.amount || profile[0].salary;

      const today = new Date().toISOString().slice(0, 10);

      // Get actual staff.id from staff table
      const [[staff]] = await pool.query(
        "SELECT id FROM staff WHERE user_id = ?",
        [userId],
      );

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff record not found",
        });
      }

      await pool.query(
        `INSERT INTO salary_payments
  (
    staff_id,
    amount,
    payment_date,
    payment_mode,
    period_from,
    period_to,
    status,
    remarks,
    processed_by
  )
  VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          staff.id, // <-- CHANGE HERE
          amount,
          today,
          "bank_transfer",
          today,
          today,
          "paid",
          req.body.remarks || "Salary",
          req.user.id,
        ],
      );

      await pool.query(
        "UPDATE staff_profiles SET last_paid_date=? WHERE user_id=?",
        [today, userId],
      );

      res.json({
        success: true,
        message: "Salary paid successfully",
      });
    } catch (err) {
      next(err);
    }
  },
);

// Salary history
router.get(
  "/staff-profiles/:userId/payments",
  auth,
  role("admin"),
  async (req, res, next) => {
    try {
      const [staff] = await pool.query("SELECT id FROM staff WHERE user_id=?", [
        req.params.userId,
      ]);

      if (!staff[0])
        return res.status(200).json({ success: true, payments: [] });

      const [rows] = await pool.query(
        `SELECT
      id,
      amount,
      payment_date AS paymentDate,
      payment_mode,
      status,
      remarks,
      created_at AS createdAt
   FROM salary_payments
   WHERE staff_id=?
   ORDER BY payment_date DESC
   LIMIT 20`,
        [staff[0].id],
      );
      res.status(200).json({ success: true, payments: rows });
    } catch (err) {
      next(err);
    }
  },
);

// ── PARAMETERIZED ROUTES LAST ─────────────────────────────────

// Get user by ID
router.get("/:id", auth, role("admin"), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, full_name AS name, email, role, phone, created_at AS createdAt FROM users WHERE id = ?",
      [req.params.id],
    );
    if (!rows[0])
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.status(200).json({
      success: true,
      message: "User fetched",
      data: { user: rows[0] },
      user: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// Delete user
router.delete("/:id", auth, role("admin"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.status(200).json({ success: true, message: "User deleted", data: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
