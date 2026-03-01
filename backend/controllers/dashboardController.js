const pool = require("../config/db");

const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.query;

    let dateFilter = "";
    const params = [userId];
    let idx = 2;

    if (year) {
      dateFilter += ` AND EXTRACT(YEAR FROM t.date) = $${idx++}`;
      params.push(year);
    }
    if (month) {
      dateFilter += ` AND EXTRACT(MONTH FROM t.date) = $${idx++}`;
      params.push(month);
    }

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN c.type = 'expense' THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount
                            WHEN c.type = 'expense' THEN -ABS(t.amount)
                            ELSE 0 END), 0) AS net_savings
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 ${dateFilter}`,
      params
    );

    const row = result.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        total_income: parseFloat(row.total_income),
        total_expenses: parseFloat(row.total_expenses),
        net_savings: parseFloat(row.net_savings),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         EXTRACT(YEAR  FROM t.date)::INT AS year,
         EXTRACT(MONTH FROM t.date)::INT AS month,
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN c.type = 'expense' THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount
                            WHEN c.type = 'expense' THEN -ABS(t.amount)
                            ELSE 0 END), 0) AS net_savings
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1
       GROUP BY year, month
       ORDER BY year DESC, month DESC`,
      [userId]
    );

    const report = result.rows.map((row) => ({
      year: row.year,
      month: row.month,
      total_income: parseFloat(row.total_income),
      total_expenses: parseFloat(row.total_expenses),
      net_savings: parseFloat(row.net_savings),
    }));

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

const getCategoryBreakdown = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { year, month, type } = req.query;

    let dateFilter = "";
    let typeFilter = "";
    const params = [userId];
    let idx = 2;

    if (year) {
      dateFilter += ` AND EXTRACT(YEAR FROM t.date) = $${idx++}`;
      params.push(year);
    }
    if (month) {
      dateFilter += ` AND EXTRACT(MONTH FROM t.date) = $${idx++}`;
      params.push(month);
    }
    if (type && ["income", "expense"].includes(type)) {
      typeFilter = ` AND c.type = $${idx++}`;
      params.push(type);
    }

    const result = await pool.query(
      `SELECT
         c.id   AS category_id,
         c.name AS category_name,
         c.type AS category_type,
         COALESCE(SUM(ABS(t.amount)), 0) AS total_amount,
         COUNT(t.id)::INT AS transaction_count
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 ${dateFilter} ${typeFilter}
       GROUP BY c.id, c.name, c.type
       ORDER BY total_amount DESC`,
      params
    );

    return res.status(200).json({
      success: true,
      data: result.rows.map((r) => ({
        category_id: r.category_id,
        category_name: r.category_name,
        category_type: r.category_type,
        total_amount: parseFloat(r.total_amount),
        transaction_count: r.transaction_count,
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary, getMonthlyReport, getCategoryBreakdown };
