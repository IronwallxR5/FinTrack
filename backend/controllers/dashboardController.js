const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { SUPPORTED_CURRENCIES } = require("../config/currencies");
const { getExchangeRates } = require("../services/exchangeRates");

const isValidYear  = (v) => /^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100;
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

    // Build dynamic SQL filter fragments
    let filterSql = Prisma.sql``;
    if (year)     filterSql = Prisma.sql`${filterSql} AND EXTRACT(YEAR  FROM t.date) = ${parseInt(year, 10)}`;
    if (month)    filterSql = Prisma.sql`${filterSql} AND EXTRACT(MONTH FROM t.date) = ${parseInt(month, 10)}`;
    if (currency) filterSql = Prisma.sql`${filterSql} AND t.currency = ${currency.toUpperCase()}`;

    const rows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          t.currency,
          COALESCE(SUM(CASE WHEN t.type = 'income'  THEN ABS(t.amount) ELSE 0 END), 0) AS total_income,
          COALESCE(SUM(CASE WHEN t.type = 'expense' THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
          COALESCE(SUM(CASE WHEN t.type = 'income'  THEN  ABS(t.amount)
                             WHEN t.type = 'expense' THEN -ABS(t.amount)
                             ELSE 0 END), 0) AS net_savings
        FROM transactions t
        WHERE t.user_id = ${userId}::uuid ${filterSql}
        GROUP BY t.currency
        ORDER BY t.currency
      `
    );

    if (currency) {
      const row = rows[0] || { total_income: 0, total_expenses: 0, net_savings: 0 };
      return res.status(200).json({
        success: true,
        currency: currency.toUpperCase(),
        data: {
          total_income:    parseFloat(row.total_income),
          total_expenses:  parseFloat(row.total_expenses),
          net_savings:     parseFloat(row.net_savings),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        currency:       r.currency,
        total_income:   parseFloat(r.total_income),
        total_expenses: parseFloat(r.total_expenses),
        net_savings:    parseFloat(r.net_savings),
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

    let currencyFilter = Prisma.sql``;
    if (currency) currencyFilter = Prisma.sql` AND t.currency = ${currency.toUpperCase()}`;

    const rows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          t.currency,
          EXTRACT(YEAR  FROM t.date)::INT AS year,
          EXTRACT(MONTH FROM t.date)::INT AS month,
          COALESCE(SUM(CASE WHEN t.type = 'income'  THEN ABS(t.amount) ELSE 0 END), 0) AS total_income,
          COALESCE(SUM(CASE WHEN t.type = 'expense' THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
          COALESCE(SUM(CASE WHEN t.type = 'income'  THEN  ABS(t.amount)
                             WHEN t.type = 'expense' THEN -ABS(t.amount)
                             ELSE 0 END), 0) AS net_savings
        FROM transactions t
        WHERE t.user_id = ${userId}::uuid ${currencyFilter}
        GROUP BY t.currency, year, month
        ORDER BY year DESC, month DESC, t.currency
      `
    );

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        currency:       r.currency,
        year:           r.year,
        month:          r.month,
        total_income:   parseFloat(r.total_income),
        total_expenses: parseFloat(r.total_expenses),
        net_savings:    parseFloat(r.net_savings),
      })),
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
    if (year  && !isValidYear(year))   return res.status(400).json({ success: false, message: "year must be a 4-digit number (1900-2100)." });
    if (month && !isValidMonth(month)) return res.status(400).json({ success: false, message: "month must be 1-12." });

    let extraFilters = Prisma.sql``;
    if (year)     extraFilters = Prisma.sql`${extraFilters} AND EXTRACT(YEAR  FROM t.date) = ${parseInt(year, 10)}`;
    if (month)    extraFilters = Prisma.sql`${extraFilters} AND EXTRACT(MONTH FROM t.date) = ${parseInt(month, 10)}`;
    if (type && ["income", "expense"].includes(type)) {
      extraFilters = Prisma.sql`${extraFilters} AND t.type = ${type}`;
    }
    if (currency) extraFilters = Prisma.sql`${extraFilters} AND t.currency = ${currency.toUpperCase()}`;

    const rows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          t.category_id,
          COALESCE(c.name, 'Uncategorized') AS category_name,
          t.type AS category_type,
          COALESCE(SUM(ABS(t.amount)), 0)   AS total_amount,
          COUNT(t.id)::INT                  AS transaction_count
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ${userId}::uuid ${extraFilters}
        GROUP BY t.category_id, c.name, t.type
        ORDER BY total_amount DESC
      `
    );

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        category_id:        r.category_id,
        category_name:      r.category_name,
        category_type:      r.category_type,
        total_amount:       parseFloat(r.total_amount),
        transaction_count:  r.transaction_count,
      })),
    });
  } catch (err) {
    next(err);
  }
};

let _ratesCache = null;
let _ratesCachedAt = null;

const getRates = async (req, res, next) => {
  try {
    const { rates, cachedAt, cached } = await getExchangeRates();
    _ratesCache = rates;
    _ratesCachedAt = cachedAt;

    return res.status(200).json({
      success: true,
      data: rates,
      updated_at: new Date(cachedAt).toISOString(),
      cached,
    });
  } catch (err) {
    if (_ratesCache) {
      return res.status(200).json({
        success: true,
        data: _ratesCache,
        updated_at: new Date(_ratesCachedAt).toISOString(),
        cached: true,
      });
    }
    next(err);
  }
};

module.exports = { getSummary, getMonthlyReport, getCategoryBreakdown, getRates };
