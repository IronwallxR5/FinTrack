import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { CURRENCIES, formatAmount } from "@/lib/currencies";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, Paperclip, ExternalLink, FileText, Sparkles, Target, PlusCircle, MinusCircle } from "lucide-react";

// Construct backend origin from the API base URL (strip /api suffix)
const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/api$/, "");

export default function Transactions() {
  const { user } = useAuth();
  const defaultCurrency = user?.preferred_currency || "INR";

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [uploadingId, setUploadingId] = useState(null); // txId currently being uploaded
  const [suggestingCategory, setSuggestingCategory] = useState(false);
  const [goals, setGoals] = useState([]);
  const fileInputRef = useRef(null);
  const pendingTxId  = useRef(null); // which tx the hidden file input is targeting
  const [form, setForm] = useState({
    category_id: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    currency: defaultCurrency,
    type: "expense",
  });
  // Goal allocations: [{ goal_id, mode: "pct"|"amount", value }]
  const [goalAllocations, setGoalAllocations] = useState([]);

  const fetchData = async () => {
    try {
      const params = {};
      if (filterType) params.type = filterType;
      if (filterCurrency) params.currency = filterCurrency;
      const [txRes, catRes] = await Promise.all([
        api.get("/transactions", { params }),
        api.get("/categories"),
      ]);
      setTransactions(txRes.data.data);
      setCategories(catRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
    // Goals are optional — fetch independently so a failure never breaks the tx list
    try {
      const goalRes = await api.get("/goals");
      setGoals(goalRes.data.data || []);
    } catch (err) {
      console.warn("Goals fetch skipped:", err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType, filterCurrency]);

  const resetForm = () => {
    setForm({ category_id: "", amount: "", description: "", date: new Date().toISOString().split("T")[0], currency: defaultCurrency, type: "expense" });
    setGoalAllocations([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        amount: parseFloat(form.amount),
      };
      // Attach goal allocations only for income transactions
      if (form.type === "income" && goalAllocations.length > 0) {
        payload.goal_allocations = goalAllocations
          .filter((a) => a.goal_id && a.value)
          .map((a) =>
            a.mode === "pct"
              ? { goal_id: a.goal_id, allocation_pct: parseFloat(a.value) }
              : { goal_id: a.goal_id, allocated_amount: parseFloat(a.value) }
          );
      }
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload);
      } else {
        await api.post("/transactions", payload);
      }
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Error saving transaction");
    }
  };

  const handleEdit = (tx) => {
    setForm({
      category_id: tx.category_id || "",
      amount: tx.amount,
      description: tx.description || "",
      date: tx.date?.split("T")[0] || "",
      currency: tx.currency || defaultCurrency,
      type: tx.type || "expense",
    });

    // Pre-populate existing goal allocations so the user sees what was already set
    if (tx.type === "income" && Array.isArray(tx.goal_allocations) && tx.goal_allocations.length > 0) {
      setGoalAllocations(
        tx.goal_allocations.map((a) => ({
          goal_id: a.goal_id,
          mode: "amount",                            // show stored flat amounts — clearer than a recalculated %
          value: String(parseFloat(a.allocated_amount)),
        }))
      );
    } else {
      setGoalAllocations([]);
    }

    setEditingId(tx.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting");
    }
  };

  // ── AI category suggestion ─────────────────────────────────────────────────
  const handleSuggestCategory = async () => {
    if (!form.description.trim()) return;
    setSuggestingCategory(true);
    try {
      const res = await api.post("/ai/categorize", { description: form.description });
      const { category_id, category_name, confidence, reason } = res.data;
      if (category_id) {
        setForm((prev) => ({ ...prev, category_id }));
        const conf = confidence === "high" ? "✓" : confidence === "medium" ? "~" : "?";
        alert(`${conf} Suggested: ${category_name}\n${reason || ""}`);
      } else {
        alert("No matching category found. Try a more descriptive name.");
      }
    } catch (err) {
      if (err.response?.status === 503) {
        alert("AI features are not configured yet. Add GROQ_API_KEY to your backend .env");
      } else {
        alert(err.response?.data?.message || "Could not suggest category");
      }
    } finally {
      setSuggestingCategory(false);
    }
  };

  // ── Receipt handlers ───────────────────────────────────────────────────────
  const triggerReceiptPicker = (txId) => {
    pendingTxId.current = txId;
    fileInputRef.current.value = ""; // reset so same file can be re-selected
    fileInputRef.current.click();
  };

  const handleReceiptFileChange = async (e) => {
    const file = e.target.files?.[0];
    const txId = pendingTxId.current;
    if (!file || !txId) return;
    setUploadingId(txId);
    try {
      const fd = new FormData();
      fd.append("receipt", file);
      const res = await api.post(`/transactions/${txId}/receipt`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Update only the affected transaction in local state (no full refetch needed)
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === txId ? { ...tx, receipt_url: res.data.data.receipt_url } : tx
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  const handleReceiptDelete = async (txId) => {
    if (!confirm("Remove this receipt?")) return;
    try {
      await api.delete(`/transactions/${txId}/receipt`);
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === txId ? { ...tx, receipt_url: null } : tx))
      );
    } catch (err) {
      alert(err.response?.data?.message || "Error removing receipt");
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-12">Loading transactions...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input shared across all transactions */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={handleReceiptFileChange}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Manage your income and expense records.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Transaction
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["", "income", "expense"].map((t) => (
          <Button
            key={t}
            variant={filterType === t ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(t)}
          >
            {t === "" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
        <div className="ml-auto">
          <Select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="text-sm"
          >
            <option value="">All Currencies</option>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{editingId ? "Edit" : "New"} Transaction</CardTitle>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category_id} onChange={(e) => {
                  const catId = e.target.value;
                  const cat = categories.find((c) => String(c.id) === catId);
                  setForm({ ...form, category_id: catId, ...(cat ? { type: cat.type } : {}) });
                }}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  disabled={!!form.category_id}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </Select>
                {form.category_id && (
                  <p className="text-xs text-muted-foreground">Auto-set from category</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1500.00 (negative for refund)"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="What was this for?"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="AI: suggest category from description"
                    disabled={suggestingCategory || !form.description.trim()}
                    onClick={handleSuggestCategory}
                  >
                    <Sparkles className={`h-4 w-4 ${suggestingCategory ? "animate-pulse" : ""}`} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  max={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              {/* Goal Allocations — income only */}
              {form.type === "income" && (
                <div className="sm:col-span-2 space-y-3 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Target className="h-4 w-4 text-indigo-600" />
                      Allocate to Goals <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Button
                      type="button" variant="outline" size="sm"
                      className="h-7 text-xs"
                      onClick={() => setGoalAllocations((prev) => [...prev, { goal_id: "", mode: "pct", value: "" }])}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" /> Add Goal
                    </Button>
                  </div>

                  {goalAllocations.length === 0 && (
                    <p className="text-xs text-muted-foreground">No goal allocations. Click "Add Goal" to split this income into a savings goal.</p>
                  )}

                  {goalAllocations.map((alloc, i) => {
                    // Running total for visual feedback
                    const totalPct = goalAllocations.reduce((sum, a) => {
                      if (a.mode === "pct") return sum + (parseFloat(a.value) || 0);
                      if (a.mode === "amount" && parseFloat(form.amount) > 0)
                        return sum + ((parseFloat(a.value) || 0) / parseFloat(form.amount)) * 100;
                      return sum;
                    }, 0);
                    const overLimit = totalPct > 100;

                    return (
                      <div key={i} className="flex items-center gap-2 flex-wrap">
                        {/* Goal picker */}
                        <Select
                          value={alloc.goal_id}
                          onChange={(e) => setGoalAllocations((prev) => prev.map((a, j) => j === i ? { ...a, goal_id: e.target.value } : a))}
                          className="flex-1 min-w-[160px] text-sm"
                        >
                          <option value="">Select goal…</option>
                          {goals
                            .filter((g) => g.status !== "completed")
                            .filter((g) =>
                              // allow the goal already chosen in THIS row; exclude ones chosen in OTHER rows
                              g.id === alloc.goal_id ||
                              !goalAllocations.some((a, j) => j !== i && a.goal_id === g.id)
                            )
                            .map((g) => (
                            <option key={g.id} value={g.id}>{g.name} ({g.currency})</option>
                          ))}
                        </Select>

                        {/* Mode toggle */}
                        <Select
                          value={alloc.mode}
                          onChange={(e) => setGoalAllocations((prev) => prev.map((a, j) => j === i ? { ...a, mode: e.target.value, value: "" } : a))}
                          className="w-24 text-sm"
                        >
                          <option value="pct">%</option>
                          <option value="amount">Amount</option>
                        </Select>

                        {/* Value */}
                        <Input
                          type="number"
                          step={alloc.mode === "pct" ? "0.01" : "0.01"}
                          min="0.01"
                          max={alloc.mode === "pct" ? "100" : undefined}
                          placeholder={alloc.mode === "pct" ? "e.g. 20" : "e.g. 5000"}
                          value={alloc.value}
                          onChange={(e) => setGoalAllocations((prev) => prev.map((a, j) => j === i ? { ...a, value: e.target.value } : a))}
                          className={`w-28 text-sm ${overLimit ? "border-red-400" : ""}`}
                        />

                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => setGoalAllocations((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <MinusCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}

                  {/* Running total indicator */}
                  {goalAllocations.length > 0 && (() => {
                    const totalPct = goalAllocations.reduce((sum, a) => {
                      if (a.mode === "pct") return sum + (parseFloat(a.value) || 0);
                      if (a.mode === "amount" && parseFloat(form.amount) > 0)
                        return sum + ((parseFloat(a.value) || 0) / parseFloat(form.amount)) * 100;
                      return sum;
                    }, 0);
                    const over = totalPct > 100;
                    return (
                      <p className={`text-xs font-medium ${over ? "text-red-500" : "text-muted-foreground"}`}>
                        Total allocated: {totalPct.toFixed(1)}%{over ? " — exceeds 100%! Reduce allocation before submitting." : ""}
                      </p>
                    );
                  })()}
                </div>
              )}

              <div className="sm:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">
                  {editingId ? "Update" : "Create"} Transaction
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No transactions found. Add your first one!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const receiptUrl = tx.receipt_url
              ? `${BACKEND_ORIGIN}${tx.receipt_url}`
              : null;
            const isImage = receiptUrl && /\.(jpe?g|png|webp|gif)$/i.test(tx.receipt_url);
            const isUploading = uploadingId === tx.id;

            return (
            <Card key={tx.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 flex flex-col gap-3">
                {/* Top row: description + amount + action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{tx.description || "No description"}</span>
                      <Badge variant={tx.type === "income" ? "success" : "secondary"}>
                        {tx.category_name || "Uncategorized"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(tx.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-lg font-semibold whitespace-nowrap ${
                        tx.type === "income" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}{formatAmount(tx.amount, tx.currency || "INR")}
                      {tx.currency && tx.currency !== "INR" && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">{tx.currency}</span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(tx)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Receipt row */}
                <div className="flex items-center gap-2 flex-wrap border-t pt-2">
                  {receiptUrl ? (
                    <>
                      {/* Thumbnail or PDF icon */}
                      {isImage ? (
                        <a href={receiptUrl} target="_blank" rel="noreferrer">
                          <img
                            src={receiptUrl}
                            alt="receipt"
                            className="h-10 w-10 rounded object-cover border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center h-10 w-10 rounded border bg-muted hover:bg-muted/70 transition-colors"
                          title="View PDF"
                        >
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </a>
                      )}
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View receipt <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground h-7 px-2"
                        onClick={() => triggerReceiptPicker(tx.id)}
                        disabled={isUploading}
                      >
                        <Paperclip className="h-3 w-3 mr-1" />
                        Replace
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive h-7 px-2"
                        onClick={() => handleReceiptDelete(tx.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-7 px-2"
                      onClick={() => triggerReceiptPicker(tx.id)}
                      disabled={isUploading}
                    >
                      <Paperclip className="h-3 w-3 mr-1" />
                      {isUploading ? "Uploading…" : "Attach receipt"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
          })}
        </div>
      )}
    </div>
  );
}
