import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * SSE hook — connects to /api/events and updates react-query caches
 * in real-time when balance changes, decorations change, etc.
 */
export function useSSE() {
  const { user, updateBalance } = useAuth();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Only connect when authenticated
    if (!user?.discordId) return;

    const es = new EventSource("/api/events");
    esRef.current = es;

    es.addEventListener("balance-update", (e) => {
      try {
        const data = JSON.parse(e.data);
        // { discordId, newBalance, username }
        if (data.discordId === user.discordId) {
          // Own balance changed — update everything
          updateBalance(data.newBalance);
        }
        // Invalidate leaderboard/members list so others see updated balances
        queryClient.invalidateQueries({ queryKey: ["/api/members"] });
        queryClient.invalidateQueries({ queryKey: ["/api/members/top"] });
      } catch {}
    });

    es.addEventListener("decoration-update", () => {
      // Refresh decoration cache for all components
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/all-equipped"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decorations"] });
    });

    es.onerror = () => {
      // Reconnect handled automatically by EventSource
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [user?.discordId]);
}
