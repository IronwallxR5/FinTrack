const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
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
    const budget = await prisma.budgets.findFirst({
      where: { user_id: userId, category_id: categoryId },
      select: {
        id: true,
        monthly_limit: true,
        currency: true,
        categories: { select: { name: true } },
      },
    });

    if (!budget) return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const spentRows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT currency, COALESCE(SUM(ABS(amount)), 0) AS spent
        FROM transactions
        WHERE user_id     = ${userId}::uuid
          AND category_id = ${categoryId}::uuid
          AND type        = 'expense'
          AND EXTRACT(YEAR  FROM date) = ${year}
          AND EXTRACT(MONTH FROM date) = ${month}
        GROUP BY currency
      `
    );

    let rates = {};
    try {
      const ratesData = await getExchangeRates();
      rates = ratesData.rates;
    } catch (err) {
      console.warn("[NotificationService] Could not fetch exchange rates:", err.message);
    }

    const spent = spentRows.reduce((sum, row) => {
      return sum + convertCurrency(parseFloat(row.spent), row.currency, budget.currency, rates);
    }, 0);

    const limit = parseFloat(budget.monthly_limit);
    const pct   = limit > 0 ? (spent / limit) * 100 : 0;

    const thresholds = [];
    if (pct >= 100) thresholds.push("budget_exceeded");
    else if (pct >= 80) thresholds.push("budget_warning");

    if (thresholds.length === 0) return;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return;

    const { email, name } = user;
    const categoryName = budget.categories?.name ?? "Unknown";

    for (const type of thresholds) {
      const isExceeded = type === "budget_exceeded";

      const title = isExceeded
        ? `⚠️ Budget Exceeded — ${categoryName}`
        : `🔔 Budget Warning — ${categoryName}`;

      const message = isExceeded
        ? `You have exceeded your ${budget.currency} ${limit.toFixed(2)} monthly budget for "${categoryName}". ` +
          `Spent so far this month: ${budget.currency} ${spent.toFixed(2)} (${pct.toFixed(1)}%).`
        : `You have used ${pct.toFixed(1)}% of your ${budget.currency} ${limit.toFixed(2)} monthly budget for "${categoryName}". ` +
          `Spent so far: ${budget.currency} ${spent.toFixed(2)}.`;

      try {
        // Attempt INSERT; skip if duplicate (same budget+type+month+year)
        const inserted = await prisma.$queryRaw(
          Prisma.sql`
            INSERT INTO notifications
              (user_id, budget_id, type, title, message, month, year)
            VALUES (${userId}::uuid, ${budget.id}::uuid, ${type}, ${title}, ${message}, ${month}, ${year})
            ON CONFLICT (budget_id, type, month, year)
              WHERE budget_id IS NOT NULL
            DO NOTHING
            RETURNING id
          `
        );

        if (!inserted || inserted.length === 0) {
          console.log(`[NotificationService] ${type} already sent for budget ${budget.id} in ${month}/${year}, skipping.`);
          continue;
        }

        console.log(`[NotificationService] Inserted ${type} notification for budget ${budget.id} (${categoryName}), pct=${pct.toFixed(1)}%`);

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
                <strong>${categoryName}</strong><br/>
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

/**
 * Called after getGoals — checks each active goal to see if its deadline
 * is within 7 days. If so, sends a one-time in-app + email notification
 * (deduplicated by UNIQUE(budget_id=goal_id, type, month, year)).
 *
 * @param {string} userId
 * @param {Array}  enrichedGoals  — already-computed goal objects from enrichGoal()
 */
async function checkGoalDeadlineAndNotify(userId, enrichedGoals) {
  if (!enrichedGoals || enrichedGoals.length === 0) return;

  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const user = await prisma.users.findUnique({
      where:  { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return;

    const { email, name } = user;

    for (const g of enrichedGoals) {
      // Only fire for active goals within the 7-day window
      if (g.status !== "active") continue;
      if (g.days_remaining > 7 || g.days_remaining < 0) continue;

      const type  = "goal_deadline_warning";
      const title = `⏰ Goal Deadline Soon — ${g.name}`;
      const remaining = g.target_amount - g.current_amount;
      const message =
        `Your savings goal "${g.name}" is due in ${g.days_remaining} day${g.days_remaining !== 1 ? "s" : ""}. ` +
        `You have saved ${g.currency} ${g.current_amount.toFixed(2)} of ${g.currency} ${g.target_amount.toFixed(2)} ` +
        `(${g.completion_pct}% complete). ` +
        (remaining > 0
          ? `You still need ${g.currency} ${remaining.toFixed(2)} to hit your target.`
          : "You have already reached your target — great work!");

      try {
        // Reuse budget_id column to store goal_id — nullable FK, same unique index
        const inserted = await prisma.$queryRaw(
          Prisma.sql`
            INSERT INTO notifications
              (user_id, budget_id, type, title, message, month, year)
            VALUES (${userId}::uuid, ${g.id}::uuid, ${type}, ${title}, ${message}, ${month}, ${year})
            ON CONFLICT (budget_id, type, month, year)
              WHERE budget_id IS NOT NULL
            DO NOTHING
            RETURNING id
          `
        );

        if (!inserted || inserted.length === 0) {
          console.log(`[NotificationService] goal_deadline_warning already sent for goal ${g.id} in ${month}/${year}, skipping.`);
          continue;
        }

        console.log(`[NotificationService] Inserted goal_deadline_warning for goal ${g.id} (${g.name}), ${g.days_remaining} days left.`);

        await sendEmail({
          to: email,
          subject: title,
          text: `Hi ${name || "there"},\n\n${message}\n\nLog in to FinTrack to review your goals.\n\n— The FinTrack Team`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
              <h2 style="color:#6366f1">${title}</h2>
              <p>Hi <strong>${name || "there"}</strong>,</p>
              <p>${message}</p>
              <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid #6366f1">
                <strong>${g.name}</strong><br/>
                Saved: ${g.currency} ${g.current_amount.toFixed(2)} / ${g.currency} ${g.target_amount.toFixed(2)}<br/>
                <strong>${g.completion_pct}% complete · ${g.days_remaining} day${g.days_remaining !== 1 ? "s" : ""} left</strong>
              </div>
              <p>Log in to <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}">FinTrack</a> to review your goals.</p>
              <p style="color:#6b7280;font-size:12px">— The FinTrack Team</p>
            </div>
          `,
        });
      } catch (err) {
        const detail = err?.response?.body ? JSON.stringify(err.response.body) : err.message;
        console.error("[NotificationService] goal deadline email/insert error:", detail);
      }
    }
  } catch (err) {
    console.error("[NotificationService] checkGoalDeadlineAndNotify error:", err.message);
  }
}

module.exports = { checkBudgetAndNotify, checkGoalDeadlineAndNotify };
