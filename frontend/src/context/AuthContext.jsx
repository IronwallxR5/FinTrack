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

  // Called by OAuthCallback after Google sign-in redirects back with a token.
  // Persists the token then fetches the user profile from the API.
  const loginWithToken = async (token) => {
    localStorage.setItem("token", token);
    setToken(token);
    try {
      const res = await api.get("/auth/profile");
      const u = res.data.data;
      localStorage.setItem("user", JSON.stringify(u));
      setUser(u);
    } catch (err) {
      localStorage.removeItem("token");
      setToken(null);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, updateUser, loginWithToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
