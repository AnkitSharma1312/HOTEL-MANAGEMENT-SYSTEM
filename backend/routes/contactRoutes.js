const express = require("express");
const { body, validationResult } = require("express-validator");
const { pool } = require("../config/db");

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

router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("message").notEmpty().withMessage("Message is required"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, subject, message } = req.body;
      await pool.execute(
        "INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)",
        [name, email, `${subject ? subject + "\n" : ""}${message}`],
      );
      res
        .status(201)
        .json({
          success: true,
          message: "Message sent successfully",
          data: {},
        });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
