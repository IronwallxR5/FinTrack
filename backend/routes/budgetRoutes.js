const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/validate");
const {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
} = require("../controllers/budgetController");

router.use(authMiddleware);

router.post("/", createBudget);
router.get("/", getBudgets);
router.get("/:id", validateIdParam, getBudgetById);
router.put("/:id", validateIdParam, updateBudget);
router.delete("/:id", validateIdParam, deleteBudget);

module.exports = router;
