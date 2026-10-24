import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from "./api.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => { clearToken(); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) { setReady(true); return; }
    // The role always comes from the server, never from browser storage.
    api("/auth/me").then((d) => setUser(d.user)).catch(() => clearToken()).finally(() => setReady(true));
  }, [logout]);

  const authenticate = async (mode, form) => {
    const d = await api(`/auth/${mode}`, { method: "POST", body: form });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  return <Ctx.Provider value={{ user, ready, logout, authenticate, setUser }}>{children}</Ctx.Provider>;
}
