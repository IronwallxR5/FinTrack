import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { CURRENCIES } from "@/lib/currencies";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { User, Mail, Calendar, Lock, Coins } from "lucide-react";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Currency form
  const [preferredCurrency, setPreferredCurrency] = useState("");
  const [currencyMsg, setCurrencyMsg] = useState("");
  const [currencySaving, setCurrencySaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/profile");
        setProfile(res.data.data);
        setName(res.data.data.name || "");
        setPreferredCurrency(res.data.data.preferred_currency || "INR");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const res = await api.put("/auth/profile", { name });
      setProfile(res.data.data);
      updateUser({ ...user, name: res.data.data.name });
      setMessage("Profile updated successfully!");
    } catch (err) {
      setMessage(err.response?.data?.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg("");

    if (newPassword !== confirmPassword) {
      setPwMsg("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      await api.put("/auth/profile", { password: newPassword });
      setPwMsg("Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwMsg(err.response?.data?.message || "Error changing password");
    } finally {
      setPwSaving(false);
    }
  };

  const handleUpdateCurrency = async (e) => {
    e.preventDefault();
    setCurrencyMsg("");
    setCurrencySaving(true);
    try {
      const res = await api.put("/auth/profile", { preferred_currency: preferredCurrency });
      setProfile(res.data.data);
      updateUser({ ...user, preferred_currency: res.data.data.preferred_currency });
      setCurrencyMsg("Preferred currency updated!");
    } catch (err) {
      setCurrencyMsg(err.response?.data?.message || "Error updating currency");
    } finally {
      setCurrencySaving(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-12">Loading profile...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account details and password.</p>
      </div>

      {/* Preferred Currency Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Preferred Currency
          </CardTitle>
          <CardDescription>Set the default currency for new transactions and the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateCurrency} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferredCurrency">Currency</Label>
              <Select
                id="preferredCurrency"
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value)}
                className="max-w-xs"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name} ({c.symbol})
                  </option>
                ))}
              </Select>
            </div>
            {currencyMsg && (
              <p className={`text-sm ${currencyMsg.includes("updated") ? "text-emerald-600" : "text-destructive"}`}>
                {currencyMsg}
              </p>
            )}
            <Button type="submit" disabled={currencySaving}>
              {currencySaving ? "Saving..." : "Save Currency"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>View and update your personal details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-medium">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
            {message && (
              <p className={`text-sm ${message.includes("success") ? "text-emerald-600" : "text-destructive"}`}>
                {message}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Update Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={128}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {pwMsg && (
              <p className={`text-sm ${pwMsg.includes("success") ? "text-emerald-600" : "text-destructive"}`}>
                {pwMsg}
              </p>
            )}
            <Button type="submit" disabled={pwSaving}>
              {pwSaving ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
