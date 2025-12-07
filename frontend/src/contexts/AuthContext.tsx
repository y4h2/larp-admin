import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client from '@/api/client';

interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token and validate on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const response = await client.get<User>('/auth/me');
          setUser(response.data);
        } catch {
          // Token invalid, clear it
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await client.post<{
        access_token: string;
        token_type: string;
        user: User;
      }>('/auth/login', { email, password });

      const { access_token, user } = response.data;
      localStorage.setItem(TOKEN_KEY, access_token);
      setUser(user);
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed');
      return { error };
    }
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
