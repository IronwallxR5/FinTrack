import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { CURRENCIES, formatAmount } from "@/lib/currencies";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, Target, TrendingUp, Calendar, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

// ── Radial progress ring ───────────────────────────────────────────────────────
function RadialProgress({ pct, status }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference - (pct / 100) * circumference;

  const colour =
    status === "completed" ? "#10b981" :
    status === "overdue"   ? "#ef4444" : "#6366f1";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={filled}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color: colour }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertTriangle className="h-3 w-3" /> Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
      <Clock className="h-3 w-3" /> Active
    </span>
  );
}

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

export default function Goals() {
  const { user } = useAuth();
  const defaultCurrency = user?.preferred_currency || "INR";

  const [goals,     setGoals]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "", target_amount: "", currency: defaultCurrency, target_date: tomorrow(),
  });

  const fetchGoals = async () => {
    try {
      const res = await api.get("/goals");
      setGoals(res.data.data || []);
    } catch (err) {
      console.error("Goals fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGoals(); }, []);

  const resetForm = () => {
    setForm({ name: "", target_amount: "", currency: defaultCurrency, target_date: tomorrow() });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, target_amount: parseFloat(form.target_amount) };
      if (editingId) {
        await api.put(`/goals/${editingId}`, payload);
      } else {
        await api.post("/goals", payload);
      }
      resetForm();
      fetchGoals();
    } catch (err) {
      alert(err.response?.data?.message || "Error saving goal");
    }
  };

  const handleEdit = (g) => {
    setForm({
      name:          g.name,
      target_amount: g.target_amount,
      currency:      g.currency,
      target_date:   g.target_date?.split("T")[0] || tomorrow(),
    });
    setEditingId(g.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this goal? All allocation history will be removed.")) return;
    try {
      await api.delete(`/goals/${id}`);
      fetchGoals();
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting goal");
    }
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">Loading goals…</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Savings Goals</h1>
          <p className="text-muted-foreground">Track sinking funds and target savings.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Goal
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{editingId ? "Edit" : "New"} Goal</CardTitle>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Goal Name</Label>
                <Input
                  placeholder="e.g. New Laptop, Trip to Goa…"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Amount</Label>
                <Input
                  type="number" step="0.01" min="0.01"
                  placeholder="e.g. 50000"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={form.target_date}
                  min={tomorrow()}
                  onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">
                  {editingId ? "Update" : "Create"} Goal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Goal cards */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Target className="h-12 w-12 opacity-20" />
            <p className="font-medium">No goals yet.</p>
            <p className="text-sm">Create your first sinking fund to start saving toward a target.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <Card key={g.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 space-y-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base leading-tight truncate">{g.name}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{g.currency}</Badge>
                      <StatusBadge status={g.status} />
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(g)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Ring */}
                <div className="flex items-center gap-5">
                  <RadialProgress pct={g.completion_pct} status={g.status} />
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-semibold">{formatAmount(g.current_amount, g.currency)}</span>
                      <span className="text-muted-foreground"> saved</span>
                    </p>
                    <p className="text-muted-foreground">
                      of {formatAmount(g.target_amount, g.currency)}
                    </p>
                  </div>
                </div>

                {/* Footer chips */}
                <div className="border-t pt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {g.status === "overdue"
                      ? "Past due"
                      : `${g.days_remaining} day${g.days_remaining !== 1 ? "s" : ""} left`}
                  </span>
                  {g.status === "active" && (
                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                      <TrendingUp className="h-3 w-3" />
                      {formatAmount(g.required_monthly_savings, g.currency)}/mo needed
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
