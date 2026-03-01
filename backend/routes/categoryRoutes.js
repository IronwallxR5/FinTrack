const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/validate");
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

router.use(authMiddleware);

router.post("/", createCategory);
router.get("/", getCategories);
router.get("/:id", validateIdParam, getCategoryById);
router.put("/:id", validateIdParam, updateCategory);
router.delete("/:id", validateIdParam, deleteCategory);

module.exports = router;
