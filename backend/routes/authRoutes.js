const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  register,
  login,
  profile,
  logout,
  changePassword,
} = require("../controllers/authController");
const auth = require("../middleware/auth");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

router.post(
  "/register",
  [
    body("name").optional().isString(),
    body("firstName").optional().isString(),
    body("lastName").optional().isString(),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  validate,
  register,
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  login,
);

router.get("/me", auth, profile);
router.get("/profile", auth, profile);
router.post("/logout", auth, logout);
router.put(
  "/change-password",
  auth,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  validate,
  changePassword,
);

module.exports = router;
