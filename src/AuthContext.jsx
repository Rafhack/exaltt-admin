import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "./firebase.js";

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole]               = useState(null);
  const [token, setToken]             = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setRole(null);
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        const idToken = await user.getIdToken();
        setToken(idToken);
        setCurrentUser(user);

        // Fetch role from our backend
        const res = await fetch(`${API_BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok) {
          const users = await res.json();
          const me = users.find(u => u.uid === user.uid);
          setRole(me?.role ?? null);
        }
      } catch (err) {
        console.error("[AuthContext] Failed to resolve role:", err.message);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  // Refresh token silently every 55 minutes (tokens expire after 1 hour)
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(async () => {
      const fresh = await currentUser.getIdToken(true);
      setToken(fresh);
    }, 55 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ currentUser, role, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Convenience: returns headers object with the Bearer token */
export function useAuthHeaders() {
  const { token } = useAuth();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
}
