const express = require("express");
const router  = express.Router();
const authMiddleware    = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/validate");
const {
  createGoal,
  getGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
} = require("../controllers/goalController");

router.use(authMiddleware);

router.get("/",           getGoals);
router.post("/",          createGoal);
router.get("/:id",   validateIdParam, getGoalById);
router.put("/:id",   validateIdParam, updateGoal);
router.delete("/:id",validateIdParam, deleteGoal);

module.exports = router;
