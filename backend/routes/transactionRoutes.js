const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { validateIdParam } = require("../middlewares/validate");
const upload = require("../config/upload");
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  uploadReceipt,
  deleteReceipt,
} = require("../controllers/transactionController");

router.use(authMiddleware);

router.post("/",                       createTransaction);
router.get("/",                        getTransactions);
router.get("/:id",   validateIdParam,  getTransactionById);
router.put("/:id",   validateIdParam,  updateTransaction);
router.delete("/:id",validateIdParam,  deleteTransaction);

// Receipt attachment
router.post("/:id/receipt",   validateIdParam, upload.single("receipt"), uploadReceipt);
router.delete("/:id/receipt", validateIdParam, deleteReceipt);

module.exports = router;
