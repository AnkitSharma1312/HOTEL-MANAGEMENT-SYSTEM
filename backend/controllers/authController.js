/**
 * =============================================================
 *  authController.js
 *  Hotel Management System — Authentication Controller
 *
 *  Handles:
 *    POST /api/auth/register     → Register new user
 *    POST /api/auth/login        → Login & get JWT token
 *    GET  /api/auth/me           → Get current user profile
 *    POST /api/auth/logout       → Logout (clear cookie)
 *    PUT  /api/auth/change-password → Update password
 *
 *  Security:
 *    - Passwords hashed with bcrypt (10 salt rounds)
 *    - JWT tokens signed with HS256, expire in 7 days
 *    - Token sent both in JSON body AND httpOnly cookie
 *    - Duplicate email check before insert
 *    - DB errors handled separately from validation errors
 * =============================================================
 */

"use strict";

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  createUser,
  findByEmail,
  findById,
  comparePassword,
  updatePassword,
} = require("../models/userModel");

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";
const COOKIE_OPTIONS = {
  httpOnly: true, // JS cannot read this cookie (XSS protection)
  sameSite: "lax", // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
};

// ─────────────────────────────────────────────────────────────
//  HELPER: Create JWT token
//  Payload contains only non-sensitive fields
// ─────────────────────────────────────────────────────────────
const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY, algorithm: "HS256" },
  );
};

// ─────────────────────────────────────────────────────────────
//  HELPER: Safe user object (remove password before sending)
// ─────────────────────────────────────────────────────────────
const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name || user.full_name,
  email: user.email,
  role: user.role,
  phone: user.phone || null,
  position: user.position || null,
  department: user.department || null,
  createdAt: user.createdAt || user.created_at || null,
});

// ─────────────────────────────────────────────────────────────
//  HELPER: Detect MySQL duplicate entry error
// ─────────────────────────────────────────────────────────────
const isDuplicateEntryError = (error) =>
  error.code === "ER_DUP_ENTRY" || error.errno === 1062;

// ─────────────────────────────────────────────────────────────
//  HELPER: Detect DB connection error
// ─────────────────────────────────────────────────────────────
const isDBConnectionError = (error) =>
  [
    "ECONNREFUSED",
    "ENOTFOUND",
    "PROTOCOL_CONNECTION_LOST",
    "ER_ACCESS_DENIED_ERROR",
    "ECONNRESET",
  ].includes(error.code);

// =============================================================
//  REGISTER
//  POST /api/auth/register
//
//  Body: { firstName, lastName, email, password, phone }
//  OR  : { name, email, password, phone }
//
//  Steps:
//    1. Validate required fields (done in route via express-validator)
//    2. Check if email already exists → 409
//    3. Hash password with bcrypt (10 rounds)
//    4. Insert user into database
//    5. Generate JWT token
//    6. Return user + token
// =============================================================
const register = async (req, res, next) => {
  try {
    // ── 1. Extract fields (support multiple name formats) ───
    const {
      name,
      fullName,
      firstName,
      lastName,
      email,
      password,
      phone,
      role = "guest", // guests self-register; admin sets staff role
    } = req.body;

    // Build display name from whatever format is provided
    const displayName =
      fullName ||
      name ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      "Guest";

    // ── 2. Validate required fields ─────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
        errors: [
          !email && { field: "email", message: "Email is required" },
          !password && { field: "password", message: "Password is required" },
        ].filter(Boolean),
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // ── 3. Check if email already exists ────────────────────
    let existingUser;
    try {
      existingUser = await findByEmail(email.toLowerCase().trim());
    } catch (dbError) {
      // DB connection failed during lookup
      if (isDBConnectionError(dbError)) {
        return res.status(503).json({
          success: false,
          message: "Database connection failed. Please try again later.",
        });
      }
      throw dbError; // re-throw unexpected errors
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please login or use a different email.",
        field: "email",
      });
    }

    // ── 4. Hash password with bcrypt ─────────────────────────
    // bcrypt.hash() automatically generates salt + hashes
    // Cost factor 10 = ~100ms per hash (good balance security/speed)
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // ── 5. Insert user into database ─────────────────────────
    let userId;
    try {
      userId = await createUser({
        name: displayName,
        fullName: displayName,
        email: email.toLowerCase().trim(),
        password: hashedPassword, // already hashed
        role: ["guest", "staff", "admin"].includes(role) ? role : "guest",
        phone: phone || "",
      });
    } catch (dbError) {
      // Handle MySQL duplicate email error (race condition edge case)
      if (isDuplicateEntryError(dbError)) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
          field: "email",
        });
      }
      // DB connection error
      if (isDBConnectionError(dbError)) {
        return res.status(503).json({
          success: false,
          message: "Database connection failed. Please try again later.",
        });
      }
      throw dbError;
    }

    // ── 6. Fetch newly created user ──────────────────────────
    const newUser = await findById(userId);
    if (!newUser) {
      return res.status(500).json({
        success: false,
        message:
          "Account created but could not fetch user details. Please login.",
      });
    }

    // ── 7. Generate JWT token ────────────────────────────────
    const token = createToken(newUser);

    // ── 8. Set token as httpOnly cookie ─────────────────────
    res.cookie("token", token, COOKIE_OPTIONS);

    // ── 9. Send success response ─────────────────────────────
    return res.status(201).json({
      success: true,
      message: "Registration successful! Welcome to taj Hotel.",
      data: {
        user: sanitizeUser(newUser),
        token,
      },
      // Also at top-level for backward compatibility with frontend
      user: sanitizeUser(newUser),
      token,
    });
  } catch (error) {
    // Pass to global error handler in server.js
    next(error);
  }
};

// =============================================================
//  LOGIN
//  POST /api/auth/login
//
//  Body: { email, password }
//
//  Steps:
//    1. Find user by email in database
//    2. Verify password using bcrypt.compare()
//    3. Generate JWT token
//    4. Return user + token
// =============================================================
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ── 1. Validate input ────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // ── 2. Find user by email ────────────────────────────────
    let user;
    try {
      user = await findByEmail(email.toLowerCase().trim());
    } catch (dbError) {
      if (isDBConnectionError(dbError)) {
        return res.status(503).json({
          success: false,
          message: "Database connection failed. Please try again later.",
        });
      }
      throw dbError;
    }

    // Use same generic message for both "not found" AND "wrong password"
    // This prevents email enumeration attacks
    const INVALID_CREDENTIALS_MSG =
      "Invalid email or password. Please try again.";

    if (!user) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MSG,
      });
    }

    // ── 3. Verify password with bcrypt.compare() ─────────────
    // bcrypt.compare() timing is constant — not vulnerable to timing attacks
    console.log("input password from request body:", password);
    console.log("user object from database:", user);
    console.log("type of user.password:", typeof user.password);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("isPasswordValid?", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MSG,
      });
    }

    // ── 4. Check if account is active ────────────────────────
    // (is_active field in users table)
    if (user.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // ── 5. Generate JWT token ────────────────────────────────
    const token = createToken(user);

    // ── 6. Set token cookie ──────────────────────────────────
    res.cookie("token", token, COOKIE_OPTIONS);

    // ── 7. Build safe user object ────────────────────────────
    const safeUser = sanitizeUser(user);

    // ── 8. Send success response ─────────────────────────────
    return res.status(200).json({
      success: true,
      message: `Welcome back, ${safeUser.name}!`,
      data: { user: safeUser, token },
      // Also at top-level for frontend compatibility
      user: safeUser,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================
//  GET PROFILE
//  GET /api/auth/me   OR   GET /api/auth/profile
//  Protected: requires valid JWT
// =============================================================
const profile = async (req, res, next) => {
  try {
    // req.user is set by auth middleware (middleware/auth.js)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Fetch fresh data from DB (in case profile was updated)
    const freshUser = await findById(req.user.id);
    if (!freshUser) {
      return res.status(404).json({
        success: false,
        message: "User account not found. It may have been deleted.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: { user: sanitizeUser(freshUser) },
      user: sanitizeUser(freshUser),
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================
//  LOGOUT
//  POST /api/auth/logout
//  Protected: requires valid JWT
// =============================================================
const logout = async (req, res, next) => {
  try {
    // Clear the httpOnly cookie
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully. See you next time!",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================
//  CHANGE PASSWORD
//  PUT /api/auth/change-password
//  Protected: requires valid JWT
//
//  Body: { currentPassword, newPassword }
// =============================================================
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // ── 1. Validate input ────────────────────────────────────
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are both required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // ── 2. Fetch user with password hash from DB ─────────────
    const user = await findByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    // ── 3. Verify current password ───────────────────────────
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
        field: "currentPassword",
      });
    }

    // ── 4. Hash new password & update in DB ──────────────────
    await updatePassword(req.user.id, newPassword);

    // ── 5. Clear cookie (force re-login for security) ────────
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      success: true,
      message:
        "Password updated successfully. Please login again with your new password.",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================
//  EXPORTS
// =============================================================
module.exports = {
  register,
  login,
  profile,
  logout,
  changePassword,
};
