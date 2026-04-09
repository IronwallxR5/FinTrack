import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  PiggyBank,
  Target,
  Bell,
  LogOut,
  Menu,
  X,
  Wallet,
  UserCircle,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { to: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { to: "/transactions",  label: "Transactions",  icon: ArrowLeftRight },
  { to: "/categories",   label: "Categories",    icon: Tags },
  { to: "/budgets",      label: "Budgets",        icon: PiggyBank },
  { to: "/goals",        label: "Goals",          icon: Target },
  { to: "/notifications",label: "Notifications", icon: Bell, badge: true },
  { to: "/ai-advisor",    label: "AI Advisor",    icon: Sparkles },
  { to: "/profile",      label: "Profile",        icon: UserCircle },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread notification count every 60 seconds
  useEffect(() => {
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const res = await api.get("/notifications/unread-count");
        if (!cancelled) setUnreadCount(res.data.unread || 0);
      } catch {
        // Silently ignore — the badge just won't update
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile topbar */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          <span className="font-bold text-lg">FinTrack</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="hidden lg:flex items-center gap-2 px-6 py-5 border-b">
              <Wallet className="h-6 w-6" />
              <span className="font-bold text-xl">FinTrack</span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {item.badge && unreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="border-t p-4">
              <div className="flex items-center justify-between">
                <div className="truncate">
                  <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
                  {user?.name && <p className="text-xs text-muted-foreground truncate">{user?.email}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen lg:min-h-screen">
          <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
