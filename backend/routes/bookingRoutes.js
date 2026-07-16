const express = require("express");
const { body, param, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  getPayments,
  getInvoice,
} = require("../controllers/bookingController");

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
  "/",
  auth,
  [
    body("roomId").optional().isInt(),
    body("room_id").optional().isInt(),
    body("checkIn").optional().isString(),
    body("check_in_date").optional().isString(),
    body("checkOut").optional().isString(),
    body("check_out_date").optional().isString(),
    body("guests").optional().isInt({ gt: 0 }),
  ],
  validate,
  createBooking,
);
router.get("/", auth, getBookings);
router.get("/my", auth, getBookings);
router.get("/payments", auth, getPayments);
router.get("/:id", auth, [param("id").isInt()], validate, getBookingById);
router.get("/:id/invoice", auth, [param("id").isInt()], validate, getInvoice);
router.put("/:id", auth, [param("id").isInt()], validate, updateBooking);
router.patch(
  "/:id/status",
  auth,
  [param("id").isInt()],
  validate,
  async (req, res, next) => {
    req.body.booking_status = req.body.status;
    updateBooking(req, res, next);
  },
);
router.patch(
  "/:id/cancel",
  auth,
  [param("id").isInt()],
  validate,
  async (req, res, next) => {
    req.body.booking_status = "cancelled";
    updateBooking(req, res, next);
  },
);
router.patch(
  "/:id/check-in",
  auth,
  [param("id").isInt()],
  validate,
  async (req, res, next) => {
    req.body.booking_status = "checked_in";
    updateBooking(req, res, next);
  },
);
router.patch(
  "/:id/check-out",
  auth,
  [param("id").isInt()],
  validate,
  async (req, res, next) => {
    req.body.booking_status = "checked_out";
    updateBooking(req, res, next);
  },
);
router.delete("/:id", auth, [param("id").isInt()], validate, deleteBooking);

module.exports = router;
