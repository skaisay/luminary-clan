import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Gamepad2, Circle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type RobloxAvatarData = {
  fullBodyUrl: string;
  headshotUrl: string;
  username: string;
};

export function RobloxAvatarCard() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  // Fetch custom profile data for robloxUsername
  const { data: customData } = useQuery<{ robloxUsername?: string }>({
    queryKey: [`/api/profile-custom/${user?.discordId}`],
    enabled: !!user?.discordId,
  });

  const robloxUsername = customData?.robloxUsername;

  const { data: avatarData, isLoading } = useQuery<RobloxAvatarData>({
    queryKey: [`/api/roblox/fullbody/${robloxUsername}`],
    enabled: !!robloxUsername,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // 3D perspective tilt on mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotation({ x: y * -15, y: x * 15 });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  if (!robloxUsername) return null;

  return (
    <Card className="glass glass-border border-0 shadow-lg overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-red-400" />
          Roblox Аватар
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="w-40 h-52 rounded-xl" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : avatarData ? (
          <div
            ref={containerRef}
            className="flex flex-col items-center"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: "800px" }}
          >
            <div
              className="relative transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div className="relative">
                {/* Glow effect behind avatar */}
                <div className="absolute inset-0 blur-2xl opacity-30 rounded-full bg-gradient-to-br from-primary via-accent to-primary" />
                <img
                  src={avatarData.fullBodyUrl}
                  alt={`${robloxUsername} Roblox Avatar`}
                  className="relative w-44 h-auto drop-shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] select-none"
                  draggable={false}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
              <span className="text-sm font-semibold">{robloxUsername}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Gamepad2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Аватар не найден</p>
            <p className="text-xs mt-1 opacity-60">Проверьте никнейм в профиле</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
