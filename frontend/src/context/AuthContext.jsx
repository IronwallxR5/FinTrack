import { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { token: t, user: u } = res.data.data;
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
    setToken(t);
    setUser(u);
    return res.data;
  };

  const register = async (email, password, name) => {
    const res = await api.post("/auth/register", { email, password, name: name || undefined });
    const { token: t, user: u } = res.data.data;
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
    setToken(t);
    setUser(u);
    return res.data;
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, updateUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
