const pool = require("../config/db");
const { SUPPORTED_CURRENCIES } = require("../config/currencies");

const isValidYear = (v) => /^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100;
const isValidMonth = (v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 12;

const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { year, month, currency } = req.query;

    if (year && !isValidYear(year)) {
      return res.status(400).json({ success: false, message: "year must be a 4-digit number (1900-2100)." });
    }
    if (month && !isValidMonth(month)) {
      return res.status(400).json({ success: false, message: "month must be 1-12." });
    }
    if (currency && !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
    }

    let filter = "";
    const params = [userId];
    let idx = 2;

    if (year) {
      filter += ` AND EXTRACT(YEAR FROM t.date) = $${idx++}`;
      params.push(year);
    }
    if (month) {
      filter += ` AND EXTRACT(MONTH FROM t.date) = $${idx++}`;
      params.push(month);
    }
    if (currency) {
      filter += ` AND t.currency = $${idx++}`;
      params.push(currency.toUpperCase());
    }

    const result = await pool.query(
      `SELECT
         t.currency,
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN c.type = 'expense' THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount
                            WHEN c.type = 'expense' THEN -ABS(t.amount)
                            ELSE 0 END), 0) AS net_savings
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 ${filter}
       GROUP BY t.currency
       ORDER BY t.currency`,
      params
    );

    if (currency) {
      const row = result.rows[0] || { total_income: 0, total_expenses: 0, net_savings: 0 };
      return res.status(200).json({
        success: true,
        currency: currency.toUpperCase(),
        data: {
          total_income: parseFloat(row.total_income),
          total_expenses: parseFloat(row.total_expenses),
          net_savings: parseFloat(row.net_savings),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows.map((r) => ({
        currency: r.currency,
        total_income: parseFloat(r.total_income),
        total_expenses: parseFloat(r.total_expenses),
        net_savings: parseFloat(r.net_savings),
      })),
    });
  } catch (err) {
    next(err);
  }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currency } = req.query;

    if (currency && !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
    }

    const params = [userId];
    let currencyFilter = "";
    if (currency) {
      currencyFilter = " AND t.currency = $2";
      params.push(currency.toUpperCase());
    }

    const result = await pool.query(
      `SELECT
         t.currency,
         EXTRACT(YEAR  FROM t.date)::INT AS year,
         EXTRACT(MONTH FROM t.date)::INT AS month,
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN c.type = 'expense' THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
         COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount
                            WHEN c.type = 'expense' THEN -ABS(t.amount)
                            ELSE 0 END), 0) AS net_savings
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 ${currencyFilter}
       GROUP BY t.currency, year, month
       ORDER BY year DESC, month DESC, t.currency`,
      params
    );

    const report = result.rows.map((row) => ({
      currency: row.currency,
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
    const { year, month, type, currency } = req.query;

    if (currency && !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
    }
    if (year && !isValidYear(year)) {
      return res.status(400).json({ success: false, message: "year must be a 4-digit number (1900-2100)." });
    }
    if (month && !isValidMonth(month)) {
      return res.status(400).json({ success: false, message: "month must be 1-12." });
    }

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
    let currencyFilter2 = "";
    if (currency) {
      currencyFilter2 = ` AND t.currency = $${idx++}`;
      params.push(currency.toUpperCase());
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
       WHERE t.user_id = $1 ${dateFilter} ${typeFilter} ${currencyFilter2}
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

let _ratesCache = null;
let _ratesCachedAt = null;
const RATES_TTL = 60 * 60 * 1000;

const getRates = async (req, res, next) => {
  try {
    if (_ratesCache && _ratesCachedAt && Date.now() - _ratesCachedAt < RATES_TTL) {
      return res.status(200).json({
        success: true,
        data: _ratesCache,
        updated_at: new Date(_ratesCachedAt).toISOString(),
        cached: true,
      });
    }

    const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }
    const json = await response.json();
    if (!json.rates || typeof json.rates !== "object") {
      throw new Error("Exchange rate API returned unexpected format");
    }

    const filtered = {};
    SUPPORTED_CURRENCIES.forEach((code) => {
      if (json.rates[code] !== undefined) filtered[code] = json.rates[code];
    });
    filtered.USD = 1;

    _ratesCache = filtered;
    _ratesCachedAt = Date.now();

    return res.status(200).json({
      success: true,
      data: _ratesCache,
      updated_at: new Date(_ratesCachedAt).toISOString(),
      cached: false,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary, getMonthlyReport, getCategoryBreakdown, getRates };
