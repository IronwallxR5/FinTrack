const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getSummary,
  getMonthlyReport,
  getCategoryBreakdown,
  getRates,
} = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/rates", getRates);

router.get("/summary", getSummary);

router.get("/monthly-report", getMonthlyReport);

router.get("/category-breakdown", getCategoryBreakdown);

module.exports = router;
