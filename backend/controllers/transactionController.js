const pool = require("../config/db");
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
      const userRow = await pool.query(
        "SELECT preferred_currency FROM users WHERE id = $1",
        [userId]
      );
      currency = userRow.rows[0]?.preferred_currency || "INR";
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

    if (category_id) {
      if (!isValidUUID(category_id)) {
        return res.status(400).json({
          success: false,
          message: "category_id must be a valid UUID.",
        });
      }

      const cat = await pool.query(
        "SELECT id, type FROM categories WHERE id = $1 AND user_id = $2",
        [category_id, userId]
      );

      if (cat.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Category not found or does not belong to you.",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO transactions (user_id, category_id, amount, description, date, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        category_id || null,
        amount,
        description || null,
        date || new Date(),
        currency,
      ]
    );

    const savedTx = result.rows[0];

    checkBudgetAndNotify(userId, category_id || null, currency).catch(() => {});

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

    let query = `
      SELECT t.*, c.name AS category_name, c.type AS category_type
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
    `;
    const params = [userId];
    let idx = 2;

    if (category_id) {
      query += ` AND t.category_id = $${idx++}`;
      params.push(category_id);
    }

    if (type && ["income", "expense"].includes(type)) {
      query += ` AND c.type = $${idx++}`;
      params.push(type);
    }

    if (from) {
      query += ` AND t.date >= $${idx++}`;
      params.push(from);
    }

    if (to) {
      query += ` AND t.date <= $${idx++}`;
      params.push(to);
    }

    if (currency) {
      query += ` AND t.currency = $${idx++}`;
      params.push(currency.toUpperCase());
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(safeLimit, offset);

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      page: safePage,
      limit: safeLimit,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT t.*, c.name AS category_name, c.type AS category_type
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
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

    const existing = await pool.query(
      "SELECT id FROM transactions WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    const fields = [];
    const params = [];
    let idx = 1;

    if (category_id !== undefined) {
      if (category_id !== null) {
        if (!isValidUUID(category_id)) {
          return res.status(400).json({ success: false, message: "category_id must be a valid UUID." });
        }
        const cat = await pool.query(
          "SELECT id FROM categories WHERE id = $1 AND user_id = $2",
          [category_id, userId]
        );
        if (cat.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Category not found or does not belong to you.",
          });
        }
      }
      fields.push(`category_id = $${idx++}`);
      params.push(category_id);
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
      fields.push(`amount = $${idx++}`);
      params.push(amount);
    }

    if (req.body.currency !== undefined) {
      const newCurrency = (req.body.currency || "").toUpperCase();
      if (!SUPPORTED_CURRENCIES.includes(newCurrency)) {
        return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
      }
      fields.push(`currency = $${idx++}`);
      params.push(newCurrency);
    }

    if (description !== undefined) {
      if (typeof description === "string" && description.length > 500) {
        return res.status(400).json({ success: false, message: "Description must not exceed 500 characters." });
      }
      fields.push(`description = $${idx++}`);
      params.push(description);
    }

    if (date !== undefined) {
      if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "Date must be in YYYY-MM-DD format." });
      }
      fields.push(`date = $${idx++}`);
      params.push(date);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update.",
      });
    }

    fields.push(`updated_at = NOW()`);

    params.push(id, userId);

    const result = await pool.query(
      `UPDATE transactions SET ${fields.join(", ")}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      params
    );

    return res.status(200).json({
      success: true,
      message: "Transaction updated.",
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction deleted.",
    });
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
};
