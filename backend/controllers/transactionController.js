const path = require("path");
const fs = require("fs");
const prisma = require("../config/prisma");
const { isValidUUID, isValidDate } = require("../middlewares/validate");
const { SUPPORTED_CURRENCIES } = require("../config/currencies");
const { checkBudgetAndNotify } = require("../services/notificationService");

const normaliseAmount = (amount) => {
  return parseFloat(Number(amount).toFixed(2));
};

const createTransaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { category_id, amount, description, date, currency } = req.body;

    if (!currency) {
      const userRow = await prisma.users.findUnique({
        where: { id: userId },
        select: { preferred_currency: true },
      });
      currency = userRow?.preferred_currency || "INR";
    }
    currency = currency.toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.`,
      });
    }

    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: "Amount is required.",
      });
    }

    amount = normaliseAmount(amount);

    if (isNaN(amount)) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid number.",
      });
    }

    if (Math.abs(amount) > 9999999999.99) {
      return res.status(400).json({
        success: false,
        message: "Amount exceeds the maximum allowed value.",
      });
    }

    if (description && (typeof description !== "string" || description.length > 500)) {
      return res.status(400).json({
        success: false,
        message: "Description must not exceed 500 characters.",
      });
    }

    if (date && !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format.",
      });
    }

    let txType = req.body.type;

    if (category_id) {
      if (!isValidUUID(category_id)) {
        return res.status(400).json({
          success: false,
          message: "category_id must be a valid UUID.",
        });
      }

      const cat = await prisma.categories.findFirst({
        where: { id: category_id, user_id: userId },
        select: { id: true, type: true },
      });

      if (!cat) {
        return res.status(404).json({
          success: false,
          message: "Category not found or does not belong to you.",
        });
      }
      txType = cat.type;
    } else {
      if (!txType || !["income", "expense"].includes(txType)) {
        txType = "expense";
      }
    }

    // Build date value
    const txDate = date ? new Date(date) : new Date();

    const savedTx = await prisma.transactions.create({
      data: {
        user_id: userId,
        category_id: category_id || null,
        amount,
        description: description || null,
        date: txDate,
        currency,
        type: txType,
      },
    });

    // Only expense transactions can trigger budget alerts
    if (txType === "expense" && category_id) {
      checkBudgetAndNotify(userId, category_id, currency).catch((err) => {
        console.error("[createTransaction] notification check failed:", err.message);
      });
    }

    return res.status(201).json({
      success: true,
      message: "Transaction created.",
      data: savedTx,
    });
  } catch (err) {
    next(err);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { category_id, type, from, to, currency, page = 1, limit = 50 } = req.query;

    if (currency && !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
    }
    if (category_id && !isValidUUID(category_id)) {
      return res.status(400).json({ success: false, message: "category_id must be a valid UUID." });
    }
    if (type && !["income", "expense"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'income' or 'expense'." });
    }
    if (from && !isValidDate(from)) {
      return res.status(400).json({ success: false, message: "from must be in YYYY-MM-DD format." });
    }
    if (to && !isValidDate(to)) {
      return res.status(400).json({ success: false, message: "to must be in YYYY-MM-DD format." });
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (safePage - 1) * safeLimit;

    const where = { user_id: userId };
    if (category_id) where.category_id = category_id;
    if (type && ["income", "expense"].includes(type)) where.type = type;
    if (from) where.date = { ...where.date, gte: new Date(from) };
    if (to) where.date = { ...where.date, lte: new Date(to) };
    if (currency) where.currency = currency.toUpperCase();

    const transactions = await prisma.transactions.findMany({
      where,
      include: {
        categories: {
          select: { name: true, type: true },
        },
      },
      orderBy: [{ date: "desc" }, { created_at: "desc" }],
      skip: offset,
      take: safeLimit,
    });

    // Flatten category fields to match original response shape
    const data = transactions.map((t) => ({
      ...t,
      category_name: t.categories?.name ?? null,
      category_type: t.categories?.type ?? null,
      categories: undefined,
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      page: safePage,
      limit: safeLimit,
      data,
    });
  } catch (err) {
    next(err);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const tx = await prisma.transactions.findFirst({
      where: { id, user_id: userId },
      include: {
        categories: {
          select: { name: true, type: true },
        },
      },
    });

    if (!tx) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    const data = {
      ...tx,
      category_name: tx.categories?.name ?? null,
      category_type: tx.categories?.type ?? null,
      categories: undefined,
    };

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    let { category_id, amount, description, date } = req.body;

    const existing = await prisma.transactions.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    const data = {};

    if (category_id !== undefined) {
      if (category_id !== null) {
        if (!isValidUUID(category_id)) {
          return res.status(400).json({ success: false, message: "category_id must be a valid UUID." });
        }
        const cat = await prisma.categories.findFirst({
          where: { id: category_id, user_id: userId },
          select: { id: true, type: true },
        });
        if (!cat) {
          return res.status(404).json({
            success: false,
            message: "Category not found or does not belong to you.",
          });
        }
        data.type = cat.type;
      }
      data.category_id = category_id;
    }

    // Allow explicit type update (only when no category or clearing category)
    if (req.body.type !== undefined && category_id === undefined) {
      if (["income", "expense"].includes(req.body.type)) {
        data.type = req.body.type;
      }
    }

    if (amount !== undefined) {
      amount = normaliseAmount(amount);
      if (isNaN(amount)) {
        return res.status(400).json({
          success: false,
          message: "Amount must be a valid number.",
        });
      }
      if (Math.abs(amount) > 9999999999.99) {
        return res.status(400).json({ success: false, message: "Amount exceeds the maximum allowed value." });
      }
      data.amount = amount;
    }

    if (req.body.currency !== undefined) {
      const newCurrency = (req.body.currency || "").toUpperCase();
      if (!SUPPORTED_CURRENCIES.includes(newCurrency)) {
        return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
      }
      data.currency = newCurrency;
    }

    if (description !== undefined) {
      if (typeof description === "string" && description.length > 500) {
        return res.status(400).json({ success: false, message: "Description must not exceed 500 characters." });
      }
      data.description = description;
    }

    if (date !== undefined) {
      if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "Date must be in YYYY-MM-DD format." });
      }
      data.date = new Date(date);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update.",
      });
    }

    data.updated_at = new Date();

    const updated = await prisma.transactions.update({
      where: { id },
      data,
    });

    // Re-check budget thresholds after any edit that could affect spending
    if (updated.type === "expense" && updated.category_id) {
      checkBudgetAndNotify(updated.user_id, updated.category_id, updated.currency).catch((err) => {
        console.error("[updateTransaction] notification check failed:", err.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction updated.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.transactions.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    await prisma.transactions.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Transaction deleted.",
    });
  } catch (err) {
    next(err);
  }
};

const uploadReceipt = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const tx = await prisma.transactions.findFirst({
      where: { id, user_id: userId },
      select: { id: true, receipt_url: true },
    });

    if (!tx) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }

    if (tx.receipt_url) {
      const oldPath = path.join(__dirname, "../", tx.receipt_url.replace(/^\//, ""));
      fs.unlink(oldPath, () => {});
    }

    const receiptUrl = `/uploads/receipts/${req.file.filename}`;

    await prisma.transactions.update({
      where: { id },
      data: { receipt_url: receiptUrl, updated_at: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: "Receipt uploaded.",
      data: { receipt_url: receiptUrl },
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
};

const deleteReceipt = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const tx = await prisma.transactions.findFirst({
      where: { id, user_id: userId },
      select: { id: true, receipt_url: true },
    });

    if (!tx) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }

    if (!tx.receipt_url) {
      return res.status(404).json({ success: false, message: "No receipt attached to this transaction." });
    }

    const filePath = path.join(__dirname, "../", tx.receipt_url.replace(/^\//, ""));
    fs.unlink(filePath, () => {});

    await prisma.transactions.update({
      where: { id },
      data: { receipt_url: null, updated_at: new Date() },
    });

    return res.status(200).json({ success: true, message: "Receipt deleted." });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  uploadReceipt,
  deleteReceipt,
};
