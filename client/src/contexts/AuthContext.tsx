import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

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

  const { data: authData, isLoading } = useQuery<{ user: UserType }>({
    queryKey: ['/auth/user'],
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    refetchOnReconnect: false,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/auth/logout', {}),
    onSuccess: () => {
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
    queryClient.setQueryData(['/auth/user'], (old: any) => {
      if (!old?.user) return old;
      return { ...old, user: { ...old.user, lumiCoins: newBalance } };
    });
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
