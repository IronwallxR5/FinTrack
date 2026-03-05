const pool = require("../config/db");
const { isValidUUID } = require("../middlewares/validate");
const { SUPPORTED_CURRENCIES } = require("../config/currencies");
const { getExchangeRates, convertCurrency } = require("../services/exchangeRates");

const createBudget = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { category_id, monthly_limit, currency } = req.body;

    if (!category_id || monthly_limit === undefined) {
      return res.status(400).json({
        success: false,
        message: "category_id and monthly_limit are required.",
      });
    }

    if (!isValidUUID(category_id)) {
      return res.status(400).json({
        success: false,
        message: "category_id must be a valid UUID.",
      });
    }

    if (isNaN(Number(monthly_limit)) || Number(monthly_limit) <= 0) {
      return res.status(400).json({
        success: false,
        message: "monthly_limit must be a positive number.",
      });
    }

    if (Number(monthly_limit) > 9999999999.99) {
      return res.status(400).json({
        success: false,
        message: "monthly_limit exceeds the maximum allowed value.",
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

    if (cat.rows[0].type !== "expense") {
      return res.status(400).json({
        success: false,
        message: "Budgets can only be set for expense categories.",
      });
    }

    let budgetCurrency = currency;
    if (!budgetCurrency) {
      const userRow = await pool.query(
        "SELECT preferred_currency FROM users WHERE id = $1",
        [userId]
      );
      budgetCurrency = userRow.rows[0]?.preferred_currency || "INR";
    }
    if (!SUPPORTED_CURRENCIES.includes(budgetCurrency)) {
      return res.status(400).json({
        success: false,
        message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}.`,
      });
    }

    const result = await pool.query(
      `INSERT INTO budgets (user_id, category_id, monthly_limit, currency)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, category_id, monthly_limit, budgetCurrency]
    );

    return res.status(201).json({
      success: true,
      message: "Budget created.",
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A budget already exists for this category. Use PUT to update.",
      });
    }
    next(err);
  }
};

const getBudgets = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         b.id,
         b.category_id,
         c.name           AS category_name,
         b.monthly_limit,
         b.currency,
         COALESCE(
           json_agg(
             json_build_object('currency', sub.currency, 'amount', sub.total)
           ) FILTER (WHERE sub.currency IS NOT NULL),
           '[]'::json
         )                AS spent_by_currency
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN (
         SELECT category_id, user_id, currency, SUM(ABS(amount)) AS total
         FROM transactions
         WHERE EXTRACT(YEAR  FROM date) = EXTRACT(YEAR  FROM CURRENT_DATE)
           AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
         GROUP BY category_id, user_id, currency
       ) sub ON sub.category_id = b.category_id AND sub.user_id = b.user_id
       WHERE b.user_id = $1
       GROUP BY b.id, b.category_id, c.name, b.monthly_limit, b.currency
       ORDER BY b.id`,
      [userId]
    );

    // Get exchange rates for cross-currency conversion
    let rates = {};
    try {
      const ratesData = await getExchangeRates();
      rates = ratesData.rates;
    } catch (err) {
      console.warn("[getBudgets] Could not fetch exchange rates, using 1:1 fallback:", err.message);
    }

    const data = result.rows.map((r) => {
      const limit = parseFloat(r.monthly_limit);
      const budgetCurrency = r.currency;

      // Convert and sum all per-currency spending into the budget's currency
      const spentByCurrency = typeof r.spent_by_currency === "string"
        ? JSON.parse(r.spent_by_currency)
        : r.spent_by_currency;

      const spent = spentByCurrency.reduce((sum, entry) => {
        return sum + convertCurrency(parseFloat(entry.amount), entry.currency, budgetCurrency, rates);
      }, 0);

      const spentRounded = Math.round(spent * 100) / 100;
      const remaining = Math.round((limit - spentRounded) * 100) / 100;
      const percentageUsed = limit > 0 ? Math.round((spentRounded / limit) * 10000) / 100 : 0;

      return {
        id: r.id,
        category_id: r.category_id,
        category_name: r.category_name,
        monthly_limit: limit,
        currency: budgetCurrency,
        spent_this_month: spentRounded,
        remaining,
        percentage_used: percentageUsed,
        status:
          percentageUsed >= 100
            ? "exceeded"
            : percentageUsed >= 80
            ? "warning"
            : "on_track",
      };
    });

    // Sort by percentage used descending
    data.sort((a, b) => b.percentage_used - a.percentage_used);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

const getBudgetById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         b.id,
         b.category_id,
         c.name           AS category_name,
         b.monthly_limit,
         b.currency,
         COALESCE(
           json_agg(
             json_build_object('currency', sub.currency, 'amount', sub.total)
           ) FILTER (WHERE sub.currency IS NOT NULL),
           '[]'::json
         )                AS spent_by_currency
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN (
         SELECT category_id, user_id, currency, SUM(ABS(amount)) AS total
         FROM transactions
         WHERE EXTRACT(YEAR  FROM date) = EXTRACT(YEAR  FROM CURRENT_DATE)
           AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
         GROUP BY category_id, user_id, currency
       ) sub ON sub.category_id = b.category_id AND sub.user_id = b.user_id
       WHERE b.id = $1 AND b.user_id = $2
       GROUP BY b.id, b.category_id, c.name, b.monthly_limit, b.currency`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Budget not found.",
      });
    }

    const r = result.rows[0];
    const limit = parseFloat(r.monthly_limit);
    const budgetCurrency = r.currency;

    let rates = {};
    try {
      const ratesData = await getExchangeRates();
      rates = ratesData.rates;
    } catch (err) {
      console.warn("[getBudgetById] Could not fetch exchange rates:", err.message);
    }

    const spentByCurrency = typeof r.spent_by_currency === "string"
      ? JSON.parse(r.spent_by_currency)
      : r.spent_by_currency;

    const spent = spentByCurrency.reduce((sum, entry) => {
      return sum + convertCurrency(parseFloat(entry.amount), entry.currency, budgetCurrency, rates);
    }, 0);

    const spentRounded = Math.round(spent * 100) / 100;
    const remaining = Math.round((limit - spentRounded) * 100) / 100;
    const percentageUsed = limit > 0 ? Math.round((spentRounded / limit) * 10000) / 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        id: r.id,
        category_id: r.category_id,
        category_name: r.category_name,
        monthly_limit: limit,
        currency: budgetCurrency,
        spent_this_month: spentRounded,
        remaining,
        percentage_used: percentageUsed,
        status:
          percentageUsed >= 100
            ? "exceeded"
            : percentageUsed >= 80
            ? "warning"
            : "on_track",
      },
    });
  } catch (err) {
    next(err);
  }
};

const updateBudget = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { monthly_limit } = req.body;

    if (!monthly_limit || isNaN(Number(monthly_limit)) || Number(monthly_limit) <= 0) {
      return res.status(400).json({
        success: false,
        message: "monthly_limit is required and must be a positive number.",
      });
    }

    if (Number(monthly_limit) > 9999999999.99) {
      return res.status(400).json({
        success: false,
        message: "monthly_limit exceeds the maximum allowed value.",
      });
    }

    const result = await pool.query(
      `UPDATE budgets SET monthly_limit = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [monthly_limit, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Budget not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Budget updated.",
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const deleteBudget = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Budget not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Budget deleted.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
};
