import { useState, useRef, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, Bot, User, Trash2 } from "lucide-react";

// ── Renders a single chat bubble ─────────────────────────────────────────────
function Message({ role, content }) {
  const isAI = role === "assistant";
  return (
    <div className={`flex gap-3 ${isAI ? "justify-start" : "justify-end"}`}>
      {isAI && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
          isAI
            ? "bg-white border text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm"
        }`}
      >
        {content}
      </div>
      {!isAI && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

// ── Suggested starter questions ───────────────────────────────────────────────
const STARTERS = [
  "How am I doing financially this month?",
  "Which category am I spending the most on?",
  "Am I over budget anywhere?",
  "Give me 3 tips to save more money.",
  "What's my net worth trend?",
];

export default function AIAdvisor() {
  const [history, setHistory] = useState([]); // [{role, content}]
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const sendMessage = async (message) => {
    const text = (message ?? input).trim();
    if (!text || loading) return;

    setInput("");
    setError(null);

    const userMsg = { role: "user", content: text };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setLoading(true);

    try {
      const res = await api.post("/ai/chat", {
        message: text,
        // Send previous turns (excluding the just-added user message — the server adds it)
        history: history,
      });
      const aiMsg = { role: "assistant", content: res.data.reply };
      setHistory([...nextHistory, aiMsg]);
    } catch (err) {
      const msg =
        err.response?.status === 503
          ? "AI features are not configured. Please add GROQ_API_KEY to your backend .env file (get a free key at console.groq.com)."
          : err.response?.data?.message || "Something went wrong. Please try again.";
      setError(msg);
      // Remove the optimistically-added user message on failure
      setHistory(history);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setHistory([]);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            AI Financial Advisor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ask anything about your finances. Your real data is used to give personalised advice.
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-muted-foreground">
            <Trash2 className="h-4 w-4" /> Clear chat
          </Button>
        )}
      </div>

      {/* Chat area */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Empty state */}
          {history.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-12">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Your AI Financial Advisor</h2>
                <p className="text-muted-foreground text-sm max-w-sm mt-1">
                  I have access to your transactions, budgets, and spending history. Ask me anything.
                </p>
              </div>
              {/* Starter suggestions */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs rounded-full border px-3 py-1.5 bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {history.map((msg, i) => (
            <Message key={i} role={msg.role} content={msg.content} />
          ))}

          {/* Loading bubble */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-white border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </CardContent>

        {/* Input bar */}
        <div className="border-t p-3 bg-white">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Ask about your finances…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              size="icon"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            Press Enter to send · AI advice is for reference only
          </p>
        </div>
      </Card>
    </div>
  );
}
