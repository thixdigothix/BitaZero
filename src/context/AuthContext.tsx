import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { AuthUser } from '../types/game.ts';
import { apiFetch } from '../lib/api.ts';

interface AuthContextValue {
  firebaseUser: User | null;
  dbUser: AuthUser | null;
  idToken: string | null;
  guestToken: string;
  loading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getOrCreateGuestToken(): string {
  const key = 'sete_a_zero_guest_token';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, generated);
    return generated;
  } catch {
    return `guest_${Date.now()}`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestToken] = useState<string>(() => getOrCreateGuestToken());

  const syncWithBackend = useCallback(async (user: User | null) => {
    if (!user) {
      setIdToken(null);
      setDbUser(null);
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      setIdToken(token);
      const res = await apiFetch<{ authenticated: boolean; user: AuthUser | null }>(
        '/api/auth/me',
        {},
        token
      );
      setDbUser(res.user);
      setAuthError(null);
    } catch (err: any) {
      console.error('Failed to sync auth session:', err);
      setAuthError(err.message || 'Erro ao verificar conta.');
      setDbUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      syncWithBackend(user);
    });
    return () => unsub();
  }, [syncWithBackend]);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await syncWithBackend(cred.user);
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError('Não foi possível concluir o login com o Google.');
      }
    }
  }, [syncWithBackend]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setIdToken(null);
    setDbUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await syncWithBackend(auth.currentUser);
  }, [syncWithBackend]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        idToken,
        guestToken,
        loading,
        authError,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
