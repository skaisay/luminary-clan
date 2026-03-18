import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// ─── Persistent auth storage ───
const AUTH_CACHE_KEY = 'luminary_auth_cache';
const AUTH_CREDS_KEY = 'luminary_auth_creds'; // Discord credentials for auto re-login

interface StoredCreds {
  access_token: string;
  discord_id: string;
  username: string;
  avatar?: string;
}

function getCachedAuth(): { user: UserType } | undefined {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return undefined;
    const data = JSON.parse(raw);
    if (data?.user?.type) return data;
  } catch {}
  return undefined;
}

function setCachedAuth(data: { user: UserType } | null | undefined) {
  try {
    if (data?.user) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data));
    }
    // NOTE: intentionally do NOT remove on null — only explicit logout clears it
  } catch {}
}

function getStoredCreds(): StoredCreds | null {
  try {
    const raw = localStorage.getItem(AUTH_CREDS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function storeDiscordCreds(creds: StoredCreds) {
  try { localStorage.setItem(AUTH_CREDS_KEY, JSON.stringify(creds)); } catch {}
}

function clearAllAuthStorage() {
  localStorage.removeItem(AUTH_CACHE_KEY);
  localStorage.removeItem(AUTH_CREDS_KEY);
}

type UserType = {
  type: 'discord' | 'admin';
  id: string;
  username: string;
  discordId?: string;
  avatar?: string;
  lumiCoins?: number;
} | null;

type AuthContextType = {
  user: UserType;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  logout: () => void;
  setGuestMode: () => void;
  refreshUser: () => void;
  updateBalance: (newBalance: number) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom fetch for auth that never throws — returns {user:null} on any error
async function fetchAuthUser(): Promise<{ user: UserType }> {
  try {
    const res = await fetch('/auth/user', { credentials: 'include' });
    if (!res.ok) return { user: null };
    const data = await res.json();
    return data;
  } catch {
    return { user: null };
  }
}

// Try to re-login using stored Discord credentials
async function tryAutoReLogin(creds: StoredCreds): Promise<{ user: UserType } | null> {
  try {
    const res = await fetch('/api/auth/discord-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        access_token: creds.access_token,
        discord_id: creds.discord_id,
        username: creds.username,
        avatar: creds.avatar,
      }),
    });
    if (!res.ok) return null;
    // Session recreated — now fetch fresh user data
    const userRes = await fetch('/auth/user', { credentials: 'include' });
    if (!userRes.ok) return null;
    return await userRes.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const reLoginAttempted = useRef(false);

  // Seed react-query cache from localStorage
  const cachedAuth = getCachedAuth();
  if (cachedAuth && !queryClient.getQueryData(['/auth/user'])) {
    queryClient.setQueryData(['/auth/user'], cachedAuth);
  }

  const { data: authData, isLoading } = useQuery<{ user: UserType }>({
    queryKey: ['/auth/user'],
    queryFn: fetchAuthUser, // custom — never throws
    retry: 2,
    retryDelay: 1500,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    initialData: cachedAuth,
  });

  // When server returns user data, persist it. When server says null, try auto re-login.
  useEffect(() => {
    if (!authData) return;
    if (authData.user && authData.user.type === 'discord') {
      // Valid Discord session — cache it
      setCachedAuth(authData);
      reLoginAttempted.current = false;
    } else if (!authData.user || authData.user.type !== 'discord') {
      // Session lost or is admin — try auto re-login with stored creds
      if (!reLoginAttempted.current) {
        reLoginAttempted.current = true;
        const creds = getStoredCreds();
        if (creds) {
          tryAutoReLogin(creds).then((result) => {
            if (result?.user) {
              queryClient.setQueryData(['/auth/user'], result);
              setCachedAuth(result);
            }
            // If re-login failed, keep cached data visible (don't log out)
          });
        }
      }
    }
  }, [authData]);

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/auth/logout', {}),
    onSuccess: () => {
      clearAllAuthStorage();
      queryClient.setQueryData(['/auth/user'], { user: null });
      queryClient.invalidateQueries({ queryKey: ['/auth/user'] });
      window.location.href = '/login';
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  const setGuestMode = () => {
    setIsGuest(true);
  };

  const refreshUser = () => {
    queryClient.invalidateQueries({ queryKey: ['/auth/user'] });
  };

  const updateBalance = (newBalance: number) => {
    // 1) Update auth cache (top-nav reads from here)
    queryClient.setQueryData(['/auth/user'], (old: any) => {
      if (!old?.user) return old;
      return { ...old, user: { ...old.user, lumiCoins: newBalance } };
    });
    // 2) Update any open profile page cache
    const uid = authData?.user?.discordId;
    if (uid) {
      queryClient.setQueryData([`/api/profile/${uid}`], (old: any) => {
        if (!old) return old;
        return { ...old, lumiCoins: newBalance };
      });
    }
    // 3) Invalidate coin-balance widget
    queryClient.invalidateQueries({ queryKey: ['/api/shop/balance'] });
  };

  // Use server data if available, otherwise fallback to localStorage cache
  // This ensures user stays "logged in" even if server session temporarily unavailable
  const serverUser = authData?.user || null;
  const cached = getCachedAuth();
  const user = (serverUser && serverUser.type === 'discord') ? serverUser :
               (cached?.user && cached.user.type === 'discord') ? cached.user : serverUser;
  const isAuthenticated = !!user && user.type === 'discord';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isGuest,
        isLoading,
        logout,
        setGuestMode,
        refreshUser,
        updateBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
