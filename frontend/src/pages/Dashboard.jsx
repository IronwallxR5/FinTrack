import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { CURRENCIES, formatAmount } from "@/lib/currencies";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Approximate fallback rates relative to USD=1 (updated periodically).
// These are used immediately on first render so conversion is never 1:1.
// Live rates from the API will overwrite these as soon as they arrive.
const FALLBACK_RATES = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CHF: 0.88,
  HKD: 7.82,
  SGD: 1.34,
  AED: 3.67,
  KWD: 0.31,
};

function convert(amount, from, to, rates) {
  const r = rates || FALLBACK_RATES;
  const fromRate = r[from] ?? FALLBACK_RATES[from] ?? 1;
  const toRate   = r[to]   ?? FALLBACK_RATES[to]   ?? 1;
  if (from === to) return Number(amount);
  return (Number(amount) / fromRate) * toRate;
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedCurrency, setSelectedCurrency] = useState(
    user?.preferred_currency || "INR"
  );
  // Start with fallback rates so first render already converts correctly.
  // Live rates from the external API will replace these once fetched.
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [rawSummary, setRawSummary] = useState([]);
  const [rawMonthly, setRawMonthly] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard data and live exchange rates in parallel.
    // Data fetch and rates fetch are independent — a rates failure never blocks the UI.
    const RATE_CODES = ["USD","INR","EUR","GBP","JPY","CHF","HKD","SGD","AED","KWD"];

    const fetchData = async () => {
      try {
        const [sumRes, reportRes, budgetRes] = await Promise.all([
          api.get("/dashboard/summary"),
          api.get("/dashboard/monthly-report"),
          api.get("/budgets"),
        ]);
        setRawSummary(Array.isArray(sumRes.data.data) ? sumRes.data.data : []);
        setRawMonthly(reportRes.data.data || []);
        setBudgets(budgetRes.data.data || []);
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchRates = async () => {
      try {
        const r = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        if (!r.ok) throw new Error("Rates API error");
        const ratesJson = await r.json();
        const ratesMap = { USD: 1 };
        RATE_CODES.forEach((code) => {
          if (ratesJson.rates?.[code] != null) ratesMap[code] = ratesJson.rates[code];
        });
        setRates(ratesMap); // Overrides the FALLBACK_RATES with live values
      } catch (err) {
        // Silently fall back to FALLBACK_RATES already in state
        console.warn("Live rates unavailable, using fallback rates:", err.message);
      }
    };

    fetchData();
    fetchRates();
  }, []);

  // Derived: convert and sum all currency groups into selectedCurrency
  const summary = useMemo(() => {
    return rawSummary.reduce(
      (acc, g) => ({
        total_income:    acc.total_income    + convert(g.total_income,    g.currency, selectedCurrency, rates),
        total_expenses:  acc.total_expenses  + convert(g.total_expenses,  g.currency, selectedCurrency, rates),
        net_savings:     acc.net_savings     + convert(g.net_savings,     g.currency, selectedCurrency, rates),
      }),
      { total_income: 0, total_expenses: 0, net_savings: 0 }
    );
  }, [rawSummary, selectedCurrency, rates]);

  // Derived: monthly chart data converted to selectedCurrency
  const chartData = useMemo(() => {
    const map = {};
    rawMonthly.forEach((row) => {
      const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
      if (!map[key]) map[key] = { year: row.year, month: row.month, Income: 0, Expenses: 0 };
      map[key].Income   += convert(row.total_income,   row.currency, selectedCurrency, rates);
      map[key].Expenses += convert(row.total_expenses, row.currency, selectedCurrency, rates);
    });
    return Object.values(map)
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .slice(0, 12)
      .reverse()
      .map((m) => ({
        name: `${MONTH_NAMES[m.month]} ${m.year}`,
        Income:   Math.round(m.Income   * 100) / 100,
        Expenses: Math.round(m.Expenses * 100) / 100,
      }));
  }, [rawMonthly, selectedCurrency, rates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + currency picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your financial overview at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View in:</span>
          <Select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="w-48"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatAmount(summary.total_income, selectedCurrency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatAmount(summary.total_expenses, selectedCurrency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Savings</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.net_savings >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatAmount(summary.net_savings, selectedCurrency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Income vs Expenses ({selectedCurrency})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatAmount(value, selectedCurrency)} />
                  <Legend />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Progress */}
      {budgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Budget Progress (This Month)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.map((b) => (
              <div key={b.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{b.category_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatAmount(convert(b.spent_this_month, b.currency, selectedCurrency, rates), selectedCurrency)}
                      {" / "}
                      {formatAmount(convert(b.monthly_limit, b.currency, selectedCurrency, rates), selectedCurrency)}
                    </span>
                    <Badge
                      variant={
                        b.status === "exceeded" ? "destructive" :
                        b.status === "warning"  ? "warning"     : "success"
                      }
                    >
                      {b.percentage_used}%
                    </Badge>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      b.status === "exceeded" ? "bg-red-500" :
                      b.status === "warning"  ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(b.percentage_used, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

