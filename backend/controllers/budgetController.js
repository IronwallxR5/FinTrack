const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
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

    if (cat.type !== "expense") {
      return res.status(400).json({
        success: false,
        message: "Budgets can only be set for expense categories.",
      });
    }

    let budgetCurrency = currency;
    if (!budgetCurrency) {
      const userRow = await prisma.users.findUnique({
        where: { id: userId },
        select: { preferred_currency: true },
      });
      budgetCurrency = userRow?.preferred_currency || "INR";
    }
    if (!SUPPORTED_CURRENCIES.includes(budgetCurrency)) {
      return res.status(400).json({
        success: false,
        message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}.`,
      });
    }

    const budget = await prisma.budgets.create({
      data: {
        user_id: userId,
        category_id,
        monthly_limit,
        currency: budgetCurrency,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Budget created.",
      data: budget,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A budget already exists for this category. Use PUT to update.",
      });
    }
    next(err);
  }
};

/**
 * Aggregate spending rows for all budgets of a user.
 * Returns: [{ budget_id, currency, amount }]
 */
async function getSpendingByBudget(userId) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        b.id       AS budget_id,
        t.currency,
        COALESCE(SUM(ABS(t.amount)), 0) AS amount
      FROM budgets b
      LEFT JOIN transactions t
        ON  t.category_id = b.category_id
        AND t.user_id     = b.user_id
        AND t.type        = 'expense'
        AND EXTRACT(YEAR  FROM t.date) = ${year}
        AND EXTRACT(MONTH FROM t.date) = ${month}
      WHERE b.user_id = ${userId}::uuid
      GROUP BY b.id, t.currency
    `
  );
}

function computeBudgetStats(limit, budgetCurrency, spendingRows, rates) {
  const spent = spendingRows.reduce((sum, row) => {
    if (!row.currency) return sum;
    return sum + convertCurrency(parseFloat(row.amount), row.currency, budgetCurrency, rates);
  }, 0);

  const spentRounded = Math.round(spent * 100) / 100;
  const remaining = Math.round((limit - spentRounded) * 100) / 100;
  const percentageUsed = limit > 0 ? Math.round((spentRounded / limit) * 10000) / 100 : 0;
  const status =
    percentageUsed >= 100 ? "exceeded" : percentageUsed >= 80 ? "warning" : "on_track";

  return { spentRounded, remaining, percentageUsed, status };
}

const getBudgets = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const budgets = await prisma.budgets.findMany({
      where: { user_id: userId },
      include: { categories: { select: { name: true } } },
      orderBy: { id: "asc" },
    });

    const spendingRows = await getSpendingByBudget(userId);

    let rates = {};
    try {
      const ratesData = await getExchangeRates();
      rates = ratesData.rates;
    } catch (err) {
      console.warn("[getBudgets] Could not fetch exchange rates, using 1:1 fallback:", err.message);
    }

    const data = budgets.map((b) => {
      const limit = parseFloat(b.monthly_limit);
      const rows = spendingRows.filter((r) => r.budget_id === b.id);
      const { spentRounded, remaining, percentageUsed, status } = computeBudgetStats(
        limit,
        b.currency,
        rows,
        rates
      );

      return {
        id: b.id,
        category_id: b.category_id,
        category_name: b.categories?.name ?? null,
        monthly_limit: limit,
        currency: b.currency,
        spent_this_month: spentRounded,
        remaining,
        percentage_used: percentageUsed,
        status,
      };
    });

    data.sort((a, b) => b.percentage_used - a.percentage_used);

    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getBudgetById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const budget = await prisma.budgets.findFirst({
      where: { id, user_id: userId },
      include: { categories: { select: { name: true } } },
    });

    if (!budget) {
      return res.status(404).json({ success: false, message: "Budget not found." });
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const spendingRows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT t.currency, COALESCE(SUM(ABS(t.amount)), 0) AS amount
        FROM transactions t
        WHERE t.user_id     = ${userId}::uuid
          AND t.category_id = ${budget.category_id}::uuid
          AND t.type        = 'expense'
          AND EXTRACT(YEAR  FROM t.date) = ${year}
          AND EXTRACT(MONTH FROM t.date) = ${month}
        GROUP BY t.currency
      `
    );

    let rates = {};
    try {
      const ratesData = await getExchangeRates();
      rates = ratesData.rates;
    } catch (err) {
      console.warn("[getBudgetById] Could not fetch exchange rates:", err.message);
    }

    const limit = parseFloat(budget.monthly_limit);
    const { spentRounded, remaining, percentageUsed, status } = computeBudgetStats(
      limit,
      budget.currency,
      spendingRows,
      rates
    );

    return res.status(200).json({
      success: true,
      data: {
        id: budget.id,
        category_id: budget.category_id,
        category_name: budget.categories?.name ?? null,
        monthly_limit: limit,
        currency: budget.currency,
        spent_this_month: spentRounded,
        remaining,
        percentage_used: percentageUsed,
        status,
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

    const existing = await prisma.budgets.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Budget not found." });
    }

    const updated = await prisma.budgets.update({
      where: { id },
      data: { monthly_limit, updated_at: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: "Budget updated.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

const deleteBudget = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.budgets.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Budget not found." });
    }

    await prisma.budgets.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Budget deleted." });
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
