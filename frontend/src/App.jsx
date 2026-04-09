import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
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

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return null; // wait for auth state to hydrate from localStorage
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
