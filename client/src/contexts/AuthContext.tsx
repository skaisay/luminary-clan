import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

const AUTH_CACHE_KEY = 'luminary_auth_cache';

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
    } else {
      localStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {}
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);

  // Seed react-query cache from localStorage so user is instantly available on reload
  const cachedAuth = getCachedAuth();
  if (cachedAuth && !queryClient.getQueryData(['/auth/user'])) {
    queryClient.setQueryData(['/auth/user'], cachedAuth);
  }

  const { data: authData, isLoading } = useQuery<{ user: UserType }>({
    queryKey: ['/auth/user'],
    retry: 2,
    retryDelay: 1500,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    initialData: cachedAuth,
  });

  // Persist auth data to localStorage whenever it changes
  useEffect(() => {
    setCachedAuth(authData ?? null);
  }, [authData]);

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/auth/logout', {}),
    onSuccess: () => {
      localStorage.removeItem(AUTH_CACHE_KEY);
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

  const user = authData?.user || null;
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
