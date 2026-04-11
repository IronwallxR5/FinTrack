import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Categories from "@/pages/Categories";
import Budgets from "@/pages/Budgets";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import AIAdvisor from "@/pages/AIAdvisor";
import OAuthCallback from "@/pages/OAuthCallback";
import Goals from "@/pages/Goals";

const NOTICE_KEY = "ft_render_notice_seen";

function RenderNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(NOTICE_KEY)) {
      setVisible(true);
      localStorage.setItem(NOTICE_KEY, "1");
      // Auto-dismiss after 10 seconds
      const t = setTimeout(() => setVisible(false), 10000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        maxWidth: "340px",
        background: "#1e1e2e",
        border: "1px solid #3b3b5c",
        borderRadius: "12px",
        padding: "16px 20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        animation: "ft-slide-in 0.35s ease",
      }}
    >
      <style>{`
        @keyframes ft-slide-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>⏳</span>
          <span style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>
            Backend is waking up
          </span>
        </div>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#94a3b8", fontSize: "18px", lineHeight: 1, padding: 0,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", lineHeight: 1.5 }}>
        The backend is hosted on Render's free tier which spins down after inactivity.{" "}
        <strong style={{ color: "#c4b5fd" }}>First requests may take up to 2 minutes</strong>{" "}
        while the server restarts. Hang tight!
      </p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <RenderNotice />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        {/* OAuth callback — must be public (user isn't logged in yet when they land here) */}
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/transactions"    element={<Transactions />} />
          <Route path="/categories"      element={<Categories />} />
          <Route path="/budgets"         element={<Budgets />} />
          <Route path="/goals"           element={<Goals />} />
          <Route path="/notifications"   element={<Notifications />} />
          <Route path="/ai-advisor"       element={<AIAdvisor />} />
          <Route path="/profile"         element={<Profile />} />
        </Route>

        {/* Redirect root */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

