import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
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

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, reportRes, budgetRes] = await Promise.all([
          api.get("/dashboard/summary"),
          api.get("/dashboard/monthly-report"),
          api.get("/budgets"),
        ]);
        setSummary(sumRes.data.data);
        setMonthlyReport(reportRes.data.data);
        setBudgets(budgetRes.data.data);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const chartData = monthlyReport
    .slice(0, 12)
    .reverse()
    .map((m) => ({
      name: `${monthNames[m.month]} ${m.year}`,
      Income: m.total_income,
      Expenses: m.total_expenses,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your financial overview at a glance.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ₹{summary?.total_income?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{summary?.total_expenses?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Savings
            </CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary?.net_savings || 0) >= 0 ? "text-blue-600" : "text-red-600"}`}>
              ₹{summary?.net_savings?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) || "0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                  />
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
                      ₹{b.spent_this_month.toLocaleString("en-IN", { minimumFractionDigits: 2 })} / ₹{b.monthly_limit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    <Badge
                      variant={
                        b.status === "exceeded"
                          ? "destructive"
                          : b.status === "warning"
                          ? "warning"
                          : "success"
                      }
                    >
                      {b.percentage_used}%
                    </Badge>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      b.status === "exceeded"
                        ? "bg-red-500"
                        : b.status === "warning"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
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
