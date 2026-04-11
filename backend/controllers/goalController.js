const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { isValidUUID } = require("../middlewares/validate");
const { SUPPORTED_CURRENCIES } = require("../config/currencies");
const { checkGoalDeadlineAndNotify } = require("../services/notificationService");

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Enriches a raw goals row (with its allocations already included) with
 * computed financial fields.  All Decimal arithmetic uses Prisma.Decimal to
 * avoid floating-point accumulation errors.
 */
function enrichGoal(goal) {
  // Single-pass sum — Prisma returns Decimal objects; use .plus() throughout
  const current_amount_decimal = goal.allocations.reduce(
    (sum, a) => sum.plus(new Prisma.Decimal(a.allocated_amount)),
    new Prisma.Decimal(0)
  );
  const current_amount = current_amount_decimal.toNumber();

  const target = Number(goal.target_amount);

  // Status resolution (must happen before any division)
  const now          = new Date();
  const deadline     = new Date(goal.target_date);
  const isComplete   = current_amount_decimal.greaterThanOrEqualTo(new Prisma.Decimal(goal.target_amount));
  const isOverdue    = deadline < now && !isComplete;
  const status       = isComplete ? "completed" : isOverdue ? "overdue" : "active";

  // Safe months_remaining — clamped to ≥ 1 so division is always safe
  const msRemaining      = deadline - now;
  const months_remaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24 * 30.44)));

  const completion_pct = parseFloat(Math.min(100, (current_amount / target) * 100).toFixed(1));

  // Division only executed when status === "active" (months_remaining ≥ 1 guaranteed)
  const required_monthly_savings =
    status === "active"
      ? parseFloat(((target - current_amount) / months_remaining).toFixed(2))
      : 0;

  const days_remaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    id:                       goal.id,
    user_id:                  goal.user_id,
    name:                     goal.name,
    target_amount:            target,
    currency:                 goal.currency,
    target_date:              goal.target_date,
    created_at:               goal.created_at,
    updated_at:               goal.updated_at,
    // Computed
    current_amount:           parseFloat(current_amount.toFixed(2)),
    completion_pct,
    months_remaining,
    days_remaining,
    status,
    required_monthly_savings,
  };
}

// ── Controllers ────────────────────────────────────────────────────────────────

const createGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { name, target_amount, target_date, currency } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: "name is required." });
    }
    if (name.trim().length > 200) {
      return res.status(400).json({ success: false, message: "name must not exceed 200 characters." });
    }

    target_amount = parseFloat(target_amount);
    if (isNaN(target_amount) || target_amount <= 0) {
      return res.status(400).json({ success: false, message: "target_amount must be a positive number." });
    }
    if (target_amount > 9999999999.99) {
      return res.status(400).json({ success: false, message: "target_amount exceeds the maximum allowed value." });
    }

    if (!target_date || !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
      return res.status(400).json({ success: false, message: "target_date is required and must be in YYYY-MM-DD format." });
    }
    const deadline = new Date(target_date);
    if (isNaN(deadline.getTime()) || deadline <= new Date()) {
      return res.status(400).json({ success: false, message: "target_date must be a future date." });
    }

    if (!currency) {
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { preferred_currency: true } });
      currency = user?.preferred_currency || "INR";
    }
    currency = currency.toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
    }

    const goal = await prisma.goals.create({
      data: {
        user_id:      userId,
        name:         name.trim(),
        target_amount,
        target_date:  deadline,
        currency,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Goal created.",
      data: enrichGoal({ ...goal, allocations: [] }),
    });
  } catch (err) {
    next(err);
  }
};

const getGoals = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Single query — all goals + all their allocations in one round-trip
    const goals = await prisma.goals.findMany({
      where:   { user_id: userId },
      include: { allocations: { select: { allocated_amount: true } } },
      orderBy: { created_at: "asc" },
    });

    const enriched = goals.map(enrichGoal);

    // Fire-and-forget: check for goals within 7-day deadline window
    checkGoalDeadlineAndNotify(userId, enriched).catch((err) =>
      console.error("[GoalController] deadline notify error:", err.message)
    );

    return res.status(200).json({
      success: true,
      count:   enriched.length,
      data:    enriched,
    });
  } catch (err) {
    next(err);
  }
};

const getGoalById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id }  = req.params;

    const goal = await prisma.goals.findFirst({
      where:   { id, user_id: userId },
      include: { allocations: { select: { allocated_amount: true } } },
    });

    if (!goal) {
      return res.status(404).json({ success: false, message: "Goal not found." });
    }

    return res.status(200).json({ success: true, data: enrichGoal(goal) });
  } catch (err) {
    next(err);
  }
};

const updateGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id }  = req.params;

    const existing = await prisma.goals.findFirst({ where: { id, user_id: userId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Goal not found." });
    }

    const data = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: "name cannot be empty." });
      if (name.length > 200) return res.status(400).json({ success: false, message: "name must not exceed 200 characters." });
      data.name = name;
    }

    if (req.body.target_amount !== undefined) {
      const ta = parseFloat(req.body.target_amount);
      if (isNaN(ta) || ta <= 0) return res.status(400).json({ success: false, message: "target_amount must be a positive number." });
      if (ta > 9999999999.99) return res.status(400).json({ success: false, message: "target_amount exceeds the maximum allowed value." });
      data.target_amount = ta;
    }

    if (req.body.target_date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.target_date)) {
        return res.status(400).json({ success: false, message: "target_date must be in YYYY-MM-DD format." });
      }
      const d = new Date(req.body.target_date);
      if (isNaN(d.getTime())) return res.status(400).json({ success: false, message: "target_date is invalid." });
      data.target_date = d;
    }

    if (req.body.currency !== undefined) {
      const c = String(req.body.currency).toUpperCase();
      if (!SUPPORTED_CURRENCIES.includes(c)) {
        return res.status(400).json({ success: false, message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.` });
      }
      data.currency = c;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: "No fields provided to update." });
    }
    data.updated_at = new Date();

    const updated = await prisma.goals.update({
      where:   { id },
      data,
      include: { allocations: { select: { allocated_amount: true } } },
    });

    return res.status(200).json({ success: true, message: "Goal updated.", data: enrichGoal(updated) });
  } catch (err) {
    next(err);
  }
};

const deleteGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id }  = req.params;

    const existing = await prisma.goals.findFirst({ where: { id, user_id: userId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Goal not found." });
    }

    await prisma.goals.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Goal deleted." });
  } catch (err) {
    next(err);
  }
};

module.exports = { createGoal, getGoals, getGoalById, updateGoal, deleteGoal };
