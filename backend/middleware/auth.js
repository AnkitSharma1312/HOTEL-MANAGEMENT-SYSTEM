/**
 * =============================================================
 *  middleware/auth.js
 *  JWT Authentication Middleware
 *
 *  Reads token from:
 *    1. Authorization header: "Bearer <token>"
 *    2. httpOnly cookie: "token"
 *
 *  On success: attaches req.user = { id, name, email, role }
 *  On failure: returns 401 with descriptive error
 * =============================================================
 */

"use strict";

const jwt        = require("jsonwebtoken");
const { findById } = require("../models/userModel");

const auth = async (req, res, next) => {
  try {
    // ── 1. Extract token from header or cookie ───────────────
    const authHeader = req.headers.authorization || "";
    let token = null;

    if (authHeader.startsWith("Bearer ")) {
      // Standard Authorization header
      token = authHeader.slice(7).trim();
    } else if (req.cookies && req.cookies.token) {
      // httpOnly cookie fallback
      token = req.cookies.token;
    }

    // ── 2. Token not provided ────────────────────────────────
    if (!token) {
      return res.status(401).json({
        success : false,
        message : "Access denied. Please login to continue.",
      });
    }

    // ── 3. Verify token signature & expiry ───────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Token expired
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success   : false,
          message   : "Your session has expired. Please login again.",
          errorCode : "TOKEN_EXPIRED",
        });
      }
      // Token malformed / invalid signature
      return res.status(401).json({
        success   : false,
        message   : "Invalid authentication token. Please login again.",
        errorCode : "TOKEN_INVALID",
      });
    }

    // ── 4. Fetch user from database ──────────────────────────
    const user = await findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success   : false,
        message   : "User account not found. It may have been deleted.",
        errorCode : "USER_NOT_FOUND",
      });
    }

    // ── 5. Check account is active ───────────────────────────
    if (user.is_active === 0) {
      return res.status(403).json({
        success   : false,
        message   : "Your account has been deactivated. Please contact support.",
        errorCode : "ACCOUNT_INACTIVE",
      });
    }

    // ── 6. Attach user to request ────────────────────────────
    req.user = user;
    next();

  } catch (error) {
    // DB connection error or unexpected error
    return res.status(500).json({
      success : false,
      message : "Authentication check failed. Please try again.",
    });
  }
};

module.exports = auth;
