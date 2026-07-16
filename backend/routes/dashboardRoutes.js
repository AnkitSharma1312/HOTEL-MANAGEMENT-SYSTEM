const express = require("express");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const {
  adminDashboard,
  staffDashboard,
  guestDashboard,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/admin", auth, role("admin"), adminDashboard);
router.get("/staff", auth, role("staff", "admin"), staffDashboard);
router.get("/guest", auth, role("guest"), guestDashboard);

module.exports = router;
