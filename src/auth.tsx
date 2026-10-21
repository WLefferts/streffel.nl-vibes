import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

interface AuthState {
  loading: boolean;
  /** UI-only. The server checks the session cookie on every write. */
  isOwner: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then((r) => setIsOwner(r.owner)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const value: AuthState = {
    loading,
    isOwner,
    login: async (password) => {
      await api.login(password);
      setIsOwner(true);
    },
    logout: async () => {
      await api.logout();
      setIsOwner(false);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
