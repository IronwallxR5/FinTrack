const pool = require("../config/db");
const { groq, GROQ_MODEL } = require("../config/groq");

function notConfigured(res) {
  return res.status(503).json({
    success: false,
    message:
      "AI features are not configured. Add GROQ_API_KEY to your backend .env file. " +
      "Get a free key at https://console.groq.com",
  });
}

async function buildFinancialContext(userId) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthName = now.toLocaleString("default", { month: "long" });

  const summaryRes = await pool.query(
    `SELECT
       currency,
       SUM(CASE WHEN c.type = 'income'  THEN ABS(t.amount) ELSE 0 END) AS total_income,
       SUM(CASE WHEN c.type = 'expense' THEN ABS(t.amount) ELSE 0 END) AS total_expenses
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
     GROUP BY t.currency`,
    [userId]
  );

  const monthlyRes = await pool.query(
    `SELECT
       c.name AS category,
       c.type,
       t.currency,
       SUM(ABS(t.amount)) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND EXTRACT(YEAR  FROM t.date) = $2
       AND EXTRACT(MONTH FROM t.date) = $3
     GROUP BY c.name, c.type, t.currency
     ORDER BY total DESC
     LIMIT 10`,
    [userId, year, month]
  );

  const recentRes = await pool.query(
    `SELECT t.date, t.amount, t.description, t.currency,
            c.name AS category, c.type AS category_type
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT 10`,
    [userId]
  );

  const budgetRes = await pool.query(
    `SELECT
       c.name AS category,
       b.monthly_limit,
       b.currency,
       COALESCE(SUM(
         CASE WHEN EXTRACT(YEAR FROM t.date) = $2 AND EXTRACT(MONTH FROM t.date) = $3
               AND t.currency = b.currency
              THEN ABS(t.amount) ELSE 0 END
       ), 0) AS spent
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t ON t.category_id = b.category_id AND t.user_id = b.user_id
     WHERE b.user_id = $1
     GROUP BY c.name, b.monthly_limit, b.currency`,
    [userId, year, month]
  );

  const userRes = await pool.query(
    "SELECT name, preferred_currency FROM users WHERE id = $1",
    [userId]
  );
  const user = userRes.rows[0];

  const lines = [
    `User: ${user.name || "Unknown"}, preferred currency: ${user.preferred_currency}`,
    `Today: ${now.toISOString().slice(0, 10)}`,
    "",
    "=== ALL-TIME FINANCIAL SUMMARY ===",
  ];

  if (summaryRes.rows.length === 0) {
    lines.push("No transactions recorded yet.");
  } else {
    summaryRes.rows.forEach((r) => {
      const net = parseFloat(r.total_income) - parseFloat(r.total_expenses);
      lines.push(
        `${r.currency}: Income ${parseFloat(r.total_income).toFixed(2)}, ` +
          `Expenses ${parseFloat(r.total_expenses).toFixed(2)}, ` +
          `Net ${net.toFixed(2)}`
      );
    });
  }

  lines.push("", `=== ${monthName.toUpperCase()} ${year} SPENDING BY CATEGORY ===`);
  if (monthlyRes.rows.length === 0) {
    lines.push("No transactions this month yet.");
  } else {
    monthlyRes.rows.forEach((r) => {
      lines.push(
        `${r.category || "Uncategorized"} (${r.type}): ${r.currency} ${parseFloat(r.total).toFixed(2)}`
      );
    });
  }

  lines.push("", "=== BUDGET STATUS THIS MONTH ===");
  if (budgetRes.rows.length === 0) {
    lines.push("No budgets set.");
  } else {
    budgetRes.rows.forEach((r) => {
      const pct = r.monthly_limit > 0
        ? ((parseFloat(r.spent) / parseFloat(r.monthly_limit)) * 100).toFixed(1)
        : 0;
      const status = pct >= 100 ? "EXCEEDED" : pct >= 80 ? "WARNING" : "OK";
      lines.push(
        `${r.category}: ${r.currency} ${parseFloat(r.spent).toFixed(2)} / ${parseFloat(r.monthly_limit).toFixed(2)} (${pct}% — ${status})`
      );
    });
  }

  lines.push("", "=== RECENT TRANSACTIONS ===");
  if (recentRes.rows.length === 0) {
    lines.push("None.");
  } else {
    recentRes.rows.forEach((r) => {
      lines.push(
        `${r.date.toISOString?.().slice(0, 10) ?? String(r.date).slice(0, 10)} | ` +
          `${r.category_type === "income" ? "+" : "-"}${r.currency} ${Math.abs(parseFloat(r.amount)).toFixed(2)} | ` +
          `${r.category || "Uncategorized"} | ${r.description || "—"}`
      );
    });
  }

  return lines.join("\n");
}

const chat = async (req, res, next) => {
  if (!groq) return notConfigured(res);

  try {
    const userId = req.user.id;
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "message is required." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: "Message too long (max 2000 chars)." });
    }

    const context = await buildFinancialContext(userId);

    const systemPrompt = `You are FinTrack AI, a personal financial advisor integrated into the FinTrack app.
You have access to the user's real financial data shown below. Use it to give specific, data-driven advice.

Be concise, friendly, and practical. Use numbers from the data when relevant.
Never make up numbers not present in the data. If you don't have enough data, say so.
Format responses with short paragraphs or bullet points. Keep replies under 300 words unless asked.

--- USER FINANCIAL DATA ---
${context}
--- END DATA ---`;

    const safeHistory = history
      .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: message.trim() },
    ];

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Sorry, I could not generate a response.";

    return res.status(200).json({ success: true, reply });
  } catch (err) {
    if (err?.status === 401) {
      return res.status(503).json({ success: false, message: "Invalid GROQ_API_KEY." });
    }
    next(err);
  }
};

const categorize = async (req, res, next) => {
  if (!groq) return notConfigured(res);

  try {
    const userId = req.user.id;
    const { description } = req.body;

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return res.status(400).json({ success: false, message: "description is required." });
    }

    const catRes = await pool.query(
      "SELECT id, name, type FROM categories WHERE user_id = $1 ORDER BY name",
      [userId]
    );

    if (catRes.rows.length === 0) {
      return res.status(200).json({
        success: true,
        category_id: null,
        category_name: null,
        confidence: "none",
        reason: "You have no categories yet.",
      });
    }

    const categoryList = catRes.rows
      .map((c) => `${c.id} | ${c.name} (${c.type})`)
      .join("\n");

    const prompt = `You are a transaction categorizer. Given a transaction description, pick the BEST matching category from the list.

Categories (format: id | name (type)):
${categoryList}

Transaction description: "${description.trim()}"

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{"category_id":"<uuid or null>","category_name":"<name or null>","confidence":"high|medium|low","reason":"<one sentence>"}

If no category is a reasonable match, use null for category_id and category_name.`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.1,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const validId = catRes.rows.find((c) => c.id === parsed.category_id);

    return res.status(200).json({
      success: true,
      category_id:   validId ? parsed.category_id   : null,
      category_name: validId ? parsed.category_name  : null,
      confidence:    parsed.confidence || "low",
      reason:        parsed.reason     || "",
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(200).json({ success: true, category_id: null, category_name: null, confidence: "low", reason: "Could not parse AI response." });
    }
    if (err?.status === 401) {
      return res.status(503).json({ success: false, message: "Invalid GROQ_API_KEY." });
    }
    next(err);
  }
};

module.exports = { chat, categorize };
