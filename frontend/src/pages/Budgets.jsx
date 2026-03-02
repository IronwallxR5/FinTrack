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
import { Plus, Pencil, Trash2, X } from "lucide-react";

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ category_id: "", monthly_limit: "", currency: user?.preferred_currency || "INR" });

  const fetchData = async () => {
    try {
      const [budgetRes, catRes] = await Promise.all([
        api.get("/budgets"),
        api.get("/categories?type=expense"),
      ]);
      setBudgets(budgetRes.data.data);
      setCategories(catRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({ category_id: "", monthly_limit: "", currency: user?.preferred_currency || "INR" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/budgets/${editingId}`, { monthly_limit: parseFloat(form.monthly_limit) });
      } else {
        await api.post("/budgets", {
          category_id: form.category_id,
          monthly_limit: parseFloat(form.monthly_limit),
          currency: form.currency,
        });
      }
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Error saving budget");
    }
  };

  const handleEdit = (b) => {
    setForm({ category_id: b.category_id, monthly_limit: b.monthly_limit, currency: b.currency });
    setEditingId(b.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this budget?")) return;
    try {
      await api.delete(`/budgets/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting");
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-12">Loading budgets...</p>;
  }

  // Categories that don't already have a budget
  const availableCategories = categories.filter(
    (c) => !budgets.some((b) => b.category_id === c.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">Set monthly spending limits and track progress.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} disabled={availableCategories.length === 0 && !editingId}>
          <Plus className="h-4 w-4 mr-2" /> Set Budget
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{editingId ? "Edit" : "New"} Budget</CardTitle>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              {!editingId && (
                <div className="space-y-2">
                  <Label>Expense Category</Label>
                  <Select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    required
                  >
                    <option value="">Select category</option>
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Monthly Limit</Label>
                <div className="flex gap-2">
                  {!editingId && (
                    <Select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="w-28"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 5000"
                    value={form.monthly_limit}
                    onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className={editingId ? "" : "sm:col-span-2"}>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingId ? "Update" : "Create"} Budget
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No budgets set. Create expense categories first, then set spending limits.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((b) => (
            <Card key={b.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{b.category_name}</h3>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={
                        b.status === "exceeded"
                          ? "destructive"
                          : b.status === "warning"
                          ? "warning"
                          : "success"
                      }
                    >
                      {b.status === "exceeded" ? "Over budget" : b.status === "warning" ? "Warning" : "On track"}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Spent: {formatAmount(b.spent_this_month, b.currency)}</span>
                  <span>Limit: {formatAmount(b.monthly_limit, b.currency)}</span>
                </div>

                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      b.status === "exceeded"
                        ? "bg-red-500"
                        : b.status === "warning"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(b.percentage_used, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="font-medium">{b.percentage_used}% used</span>
                  <span className={b.remaining >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {b.remaining >= 0
                      ? `${formatAmount(b.remaining, b.currency)} remaining`
                      : `${formatAmount(Math.abs(b.remaining), b.currency)} over`}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
