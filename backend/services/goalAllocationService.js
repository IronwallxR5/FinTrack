const { Prisma } = require("@prisma/client");
const { getExchangeRates, convertCurrency } = require("./exchangeRates");
const { isValidUUID } = require("../middlewares/validate");
const prisma = require("../config/prisma");

/**
 * Validates and resolves a raw goal_allocations array from the request body.
 *
 * Each entry accepts EITHER:
 *   { goal_id, allocation_pct }     — backend calculates flat allocated_amount
 *   { goal_id, allocated_amount }   — backend calculates allocation_pct
 *
 * allocated_amount in the join table is always stored in the goal's own
 * currency (converted at write time using the live FX rate, locked at that
 * moment — standard financial-system practice).
 *
 * Returns an array of { goal_id, allocation_pct, allocated_amount } rows
 * ready to INSERT into transaction_goal_allocations.
 *
 * Throws { status, message } on any validation failure.
 */
async function resolveAllocations(rawAllocations, txAmount, txCurrency, userId) {
  if (!Array.isArray(rawAllocations) || rawAllocations.length === 0) return [];

  // Fetch live FX rates once (in-process cache, ~0 ms if warm)
  const { rates } = await getExchangeRates();

  const result = [];
  let totalPct = new Prisma.Decimal(0);

  for (const entry of rawAllocations) {
    // ── goal_id validation ────────────────────────────────────────────────
    if (!entry.goal_id || !isValidUUID(entry.goal_id)) {
      throw { status: 400, message: `Invalid or missing goal_id: ${entry.goal_id}` };
    }

    const goal = await prisma.goals.findFirst({
      where: { id: entry.goal_id, user_id: userId },
      select: { id: true, currency: true },
    });
    if (!goal) {
      throw { status: 404, message: `Goal ${entry.goal_id} not found or does not belong to you.` };
    }

    // ── Dual-mode input resolution ────────────────────────────────────────
    let allocation_pct;
    let allocated_amount_in_tx_currency;

    const hasPct    = entry.allocation_pct   != null;
    const hasAmount = entry.allocated_amount != null;

    if (!hasPct && !hasAmount) {
      throw { status: 400, message: "Each goal allocation requires allocation_pct or allocated_amount." };
    }

    if (hasAmount) {
      // Flat-amount mode: user typed an exact number (e.g. 500 INR)
      allocated_amount_in_tx_currency = Number(entry.allocated_amount);
      if (isNaN(allocated_amount_in_tx_currency) || allocated_amount_in_tx_currency <= 0) {
        throw { status: 400, message: "allocated_amount must be a positive number." };
      }
      allocation_pct = (allocated_amount_in_tx_currency / txAmount) * 100;
    } else {
      // Percentage mode
      allocation_pct = Number(entry.allocation_pct);
      if (isNaN(allocation_pct) || allocation_pct <= 0 || allocation_pct > 100) {
        throw { status: 400, message: "allocation_pct must be between 0 (exclusive) and 100 (inclusive)." };
      }
      allocated_amount_in_tx_currency = txAmount * (allocation_pct / 100);
    }

    // ── Running total guard ───────────────────────────────────────────────
    totalPct = totalPct.plus(new Prisma.Decimal(allocation_pct.toFixed(4)));
    if (totalPct.greaterThan(new Prisma.Decimal(100))) {
      throw {
        status: 400,
        message: `Total allocation across all goals (${totalPct.toFixed(2)}%) exceeds 100% of the transaction.`,
      };
    }

    // ── FX conversion: transaction currency → goal currency ───────────────
    // Uses Prisma.Decimal for precision; only casts to Number at the end.
    const allocated_amount = parseFloat(
      new Prisma.Decimal(
        convertCurrency(allocated_amount_in_tx_currency, txCurrency, goal.currency, rates)
      )
        .toDecimalPlaces(2)
        .toString()
    );

    result.push({
      goal_id:          goal.id,
      allocation_pct:   parseFloat(new Prisma.Decimal(allocation_pct).toDecimalPlaces(2).toString()),
      allocated_amount,
    });
  }

  return result;
}

module.exports = { resolveAllocations };
