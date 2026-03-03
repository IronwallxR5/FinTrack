import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Check, CheckCheck, Trash2, AlertTriangle, TriangleAlert } from "lucide-react";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]   = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications?limit=50");
      setNotifications(res.data.data);
      setUnread(res.data.unread);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
  };

  const handleMarkAllRead = async () => {
    await api.patch("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleDelete = async (id) => {
    const n = notifications.find((x) => x.id === id);
    await api.delete(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (n && !n.is_read) setUnread((u) => Math.max(0, u - 1));
  };

  const handleDeleteAll = async () => {
    if (!confirm("Clear all notifications?")) return;
    await api.delete("/notifications");
    setNotifications([]);
    setUnread(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading notifications…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-7 w-7" />
            Notifications
            {unread > 0 && (
              <Badge variant="destructive" className="text-xs px-2">
                {unread} unread
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Budget alerts and spending updates.</p>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            {unread > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDeleteAll}>
              <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <BellOff className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm text-muted-foreground">
                You'll be notified here when a budget reaches 80% or is exceeded.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification list */}
      {notifications.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {notifications.map((n) => {
              const isExceeded = n.type === "budget_exceeded";
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                    n.is_read ? "bg-white" : "bg-amber-50/60"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`mt-0.5 flex-shrink-0 rounded-full p-2 ${
                      isExceeded ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {isExceeded ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${n.is_read ? "text-foreground" : "text-foreground"}`}>
                        {n.title}
                        {!n.is_read && (
                          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />
                        )}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Mark as read"
                        onClick={() => handleMarkRead(n.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => handleDelete(n.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
