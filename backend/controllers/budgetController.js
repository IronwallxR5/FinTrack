const pool = require("../config/db");
const { isValidUUID } = require("../middlewares/validate");

const createBudget = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { category_id, monthly_limit } = req.body;

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

    const result = await pool.query(
      `INSERT INTO budgets (user_id, category_id, monthly_limit)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, category_id, monthly_limit]
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
         c.name         AS category_name,
         b.monthly_limit,
         COALESCE(SUM(
           CASE WHEN EXTRACT(YEAR  FROM t.date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
                THEN ABS(t.amount) ELSE 0 END
         ), 0)          AS spent_this_month,
         b.monthly_limit - COALESCE(SUM(
           CASE WHEN EXTRACT(YEAR  FROM t.date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
                THEN ABS(t.amount) ELSE 0 END
         ), 0)          AS remaining,
         ROUND(
           COALESCE(SUM(
             CASE WHEN EXTRACT(YEAR  FROM t.date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                   AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
                  THEN ABS(t.amount) ELSE 0 END
           ), 0) / b.monthly_limit * 100, 2
         )              AS percentage_used
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN transactions t ON t.category_id = b.category_id AND t.user_id = b.user_id
       WHERE b.user_id = $1
       GROUP BY b.id, b.category_id, c.name, b.monthly_limit
       ORDER BY percentage_used DESC`,
      [userId]
    );

    const data = result.rows.map((r) => ({
      id: r.id,
      category_id: r.category_id,
      category_name: r.category_name,
      monthly_limit: parseFloat(r.monthly_limit),
      spent_this_month: parseFloat(r.spent_this_month),
      remaining: parseFloat(r.remaining),
      percentage_used: parseFloat(r.percentage_used),
      status:
        parseFloat(r.percentage_used) >= 100
          ? "exceeded"
          : parseFloat(r.percentage_used) >= 80
          ? "warning"
          : "on_track",
    }));

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
         c.name         AS category_name,
         b.monthly_limit,
         COALESCE(SUM(
           CASE WHEN EXTRACT(YEAR  FROM t.date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
                THEN ABS(t.amount) ELSE 0 END
         ), 0)          AS spent_this_month,
         b.monthly_limit - COALESCE(SUM(
           CASE WHEN EXTRACT(YEAR  FROM t.date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
                THEN ABS(t.amount) ELSE 0 END
         ), 0)          AS remaining,
         ROUND(
           COALESCE(SUM(
             CASE WHEN EXTRACT(YEAR  FROM t.date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                   AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
                  THEN ABS(t.amount) ELSE 0 END
           ), 0) / b.monthly_limit * 100, 2
         )              AS percentage_used
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN transactions t ON t.category_id = b.category_id AND t.user_id = b.user_id
       WHERE b.id = $1 AND b.user_id = $2
       GROUP BY b.id, b.category_id, c.name, b.monthly_limit`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Budget not found.",
      });
    }

    const r = result.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        id: r.id,
        category_id: r.category_id,
        category_name: r.category_name,
        monthly_limit: parseFloat(r.monthly_limit),
        spent_this_month: parseFloat(r.spent_this_month),
        remaining: parseFloat(r.remaining),
        percentage_used: parseFloat(r.percentage_used),
        status:
          parseFloat(r.percentage_used) >= 100
            ? "exceeded"
            : parseFloat(r.percentage_used) >= 80
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
