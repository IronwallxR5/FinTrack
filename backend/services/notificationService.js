const pool = require("../config/db");
const { sendEmail } = require("../config/email");
const { getExchangeRates, convertCurrency } = require("./exchangeRates");

/**
 * After an expense transaction is saved, check whether any budget thresholds
 * have been crossed this month and send notifications accordingly.
 *
 * Aggregates spending across ALL currencies (converted to the budget's currency)
 * so that cross-currency transactions are properly tracked against budgets.
 *
 * @param {string} userId
 * @param {string|null} categoryId
 * @param {string} transactionCurrency  (unused now — kept for API compat)
 */
async function checkBudgetAndNotify(userId, categoryId, _transactionCurrency) {
  if (!categoryId) return;

  try {
    const budgetRes = await pool.query(
      `SELECT b.id, b.monthly_limit, b.currency, c.name AS category_name
       FROM   budgets b
       JOIN   categories c ON c.id = b.category_id
       WHERE  b.user_id      = $1
         AND  b.category_id  = $2`,
      [userId, categoryId]
    );

    if (budgetRes.rows.length === 0) return;

    const budget = budgetRes.rows[0];

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const spentRes = await pool.query(
      `SELECT currency, COALESCE(SUM(ABS(amount)), 0) AS spent
       FROM   transactions
       WHERE  user_id     = $1
         AND  category_id = $2
         AND  type        = 'expense'
         AND  EXTRACT(YEAR  FROM date) = $3
         AND  EXTRACT(MONTH FROM date) = $4
       GROUP BY currency`,
      [userId, categoryId, year, month]
    );

    // Convert all currencies to the budget's currency
    let rates = {};
    try {
      const ratesData = await getExchangeRates();
      rates = ratesData.rates;
    } catch (err) {
      console.warn("[NotificationService] Could not fetch exchange rates:", err.message);
    }

    const spent = spentRes.rows.reduce((sum, row) => {
      return sum + convertCurrency(parseFloat(row.spent), row.currency, budget.currency, rates);
    }, 0);

    const limit = parseFloat(budget.monthly_limit);
    const pct   = limit > 0 ? (spent / limit) * 100 : 0;

    const thresholds = [];
    if (pct >= 100) thresholds.push("budget_exceeded");
    else if (pct >= 80) thresholds.push("budget_warning");

    if (thresholds.length === 0) return;

    const userRes = await pool.query(
      "SELECT email, name FROM users WHERE id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) return;
    const { email, name } = userRes.rows[0];

    for (const type of thresholds) {
      const isExceeded = type === "budget_exceeded";

      const title = isExceeded
        ? `⚠️ Budget Exceeded — ${budget.category_name}`
        : `🔔 Budget Warning — ${budget.category_name}`;

      const message = isExceeded
        ? `You have exceeded your ${budget.currency} ${limit.toFixed(2)} monthly budget for "${budget.category_name}". ` +
          `Spent so far this month: ${budget.currency} ${spent.toFixed(2)} (${pct.toFixed(1)}%).`
        : `You have used ${pct.toFixed(1)}% of your ${budget.currency} ${limit.toFixed(2)} monthly budget for "${budget.category_name}". ` +
          `Spent so far: ${budget.currency} ${spent.toFixed(2)}.`;

      try {
        const insertRes = await pool.query(
          `INSERT INTO notifications
             (user_id, budget_id, type, title, message, month, year)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (budget_id, type, month, year)
             WHERE budget_id IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [userId, budget.id, type, title, message, month, year]
        );

        if (insertRes.rows.length === 0) {
          console.log(`[NotificationService] ${type} already sent for budget ${budget.id} in ${month}/${year}, skipping.`);
          continue;
        }

        console.log(`[NotificationService] Inserted ${type} notification for budget ${budget.id} (${budget.category_name}), pct=${pct.toFixed(1)}%`);

        await sendEmail({
          to: email,
          subject: title,
          text: `Hi ${name || "there"},\n\n${message}\n\nLog in to FinTrack to review your spending.\n\n— The FinTrack Team`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
              <h2 style="color:${isExceeded ? "#dc2626" : "#d97706"}">${title}</h2>
              <p>Hi <strong>${name || "there"}</strong>,</p>
              <p>${message}</p>
              <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid ${isExceeded ? "#dc2626" : "#d97706"}">
                <strong>${budget.category_name}</strong><br/>
                Spent: ${budget.currency} ${spent.toFixed(2)} / ${budget.currency} ${limit.toFixed(2)}<br/>
                <strong>${pct.toFixed(1)}% used</strong>
              </div>
              <p>Log in to <a href="${process.env.APP_URL || "http://localhost:5173"}">FinTrack</a> to review your spending.</p>
              <p style="color:#6b7280;font-size:12px">— The FinTrack Team</p>
            </div>
          `,
        });
      } catch (err) {
        const detail = err?.response?.body ? JSON.stringify(err.response.body) : err.message;
        console.error("[NotificationService] email/insert error:", detail);
      }
    }
  } catch (err) {
    console.error("[NotificationService] unexpected error:", err.message);
  }
}

module.exports = { checkBudgetAndNotify };
