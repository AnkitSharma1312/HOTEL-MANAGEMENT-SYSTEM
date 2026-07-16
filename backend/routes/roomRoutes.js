const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
} = require("../controllers/roomController");
const { updateRoomStatus } = require("../models/roomModel");

const router = express.Router();
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

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

router.get(
  "/",
  [
    query("search").optional().isString(),
    query("type").optional().isString(),
    query("capacity").optional().isInt(),
    query("status").optional().isString(),
  ],
  validate,
  getAllRooms,
);
router.get("/:id", [param("id").isInt()], validate, getRoomById);
router.post(
  "/",
  auth,
  role("admin", "staff"),
  upload.single("image"),
  [
    body("name").optional().isString(),
    body("roomNumber").optional().isString(),
    body("type").optional().isString(),
    body("price_per_night").optional().isFloat({ gt: 0 }),
    body("price").optional().isFloat({ gt: 0 }),
    body("capacity").optional().isInt({ gt: 0 }),
    body("status").optional().isString(),
  ],
  validate,
  createRoom,
);
router.put(
  "/:id",
  auth,
  role("admin", "staff"),
  upload.single("image"),
  [
    param("id").isInt(),
    body("price_per_night").optional().isFloat({ gt: 0 }),
    body("price").optional().isFloat({ gt: 0 }),
    body("capacity").optional().isInt({ gt: 0 }),
  ],
  validate,
  updateRoom,
);
router.delete(
  "/:id",
  auth,
  role("admin", "staff"),
  [param("id").isInt()],
  validate,
  deleteRoom,
);

router.patch(
  "/:id/status",
  auth,
  role("admin", "staff"),
  [param("id").isInt()],
  validate,
  async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res
          .status(400)
          .json({ success: false, message: "Status is required" });
      }
      await updateRoomStatus(req.params.id, status);
      res.status(200).json({
        success: true,
        message: "Room status updated successfully",
        data: {},
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
