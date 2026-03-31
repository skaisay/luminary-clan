import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sends heartbeat to backend every 60s so the server knows
 * which users are currently browsing the website.
 */
export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.discordId) return;

    const sendHeartbeat = () => {
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: user.discordId,
          username: user.username || "",
          avatar: user.avatar || "",
        }),
      }).catch(() => {});
    };

    // Send immediately on connect
    sendHeartbeat();

    // Then every 60 seconds
    intervalRef.current = setInterval(sendHeartbeat, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.discordId, user?.username, user?.avatar]);
}
