import { useQuery } from "@tanstack/react-query";
import {
  Flame, Zap, Coins, TrendingUp, Clock, Loader2, Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

interface ActiveBoost {
  id: string;
  boostType: string;
  multiplier: number;
  activatedAt: string;
  expiresAt: string;
  itemName?: string;
}

const boostTypeInfo: Record<string, { label: string; icon: any; color: string; gradient: string }> = {
  exp: { label: "XP Бустер", icon: Zap, color: "text-blue-400", gradient: "from-blue-500 to-cyan-500" },
  coins: { label: "Монеты Бустер", icon: Coins, color: "text-yellow-400", gradient: "from-yellow-500 to-orange-500" },
  luck: { label: "Удача Бустер", icon: Sparkles, color: "text-purple-400", gradient: "from-purple-500 to-pink-500" },
};

function getTimeRemaining(expiresAt: string): { text: string; percent: number; isExpired: boolean } {
  const now = Date.now();
  const end = new Date(expiresAt).getTime();
  const diff = end - now;

  if (diff <= 0) return { text: "Истёк", percent: 0, isExpired: true };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  // Assume max duration ~24 hours for progress bar
  const maxDuration = 24 * 3600000;
  const percent = Math.min(100, Math.max(0, (diff / maxDuration) * 100));

  if (hours > 0) return { text: `${hours}ч ${minutes}м`, percent, isExpired: false };
  return { text: `${minutes}м`, percent, isExpired: false };
}

export default function BoostersPage() {
  const { user } = useAuth();

  const { data: boosts, isLoading } = useQuery<ActiveBoost[]>({
    queryKey: [`/api/boosts/${user?.discordId}`],
    enabled: !!user?.discordId,
    refetchInterval: 30000,
  });

  if (!user?.discordId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <Flame className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">Бустеры</h1>
        <p className="text-muted-foreground">Войдите через Discord для просмотра бустеров</p>
      </div>
    );
  }

  const activeBoosts = boosts?.filter(b => !getTimeRemaining(b.expiresAt).isExpired) || [];
  const expiredBoosts = boosts?.filter(b => getTimeRemaining(b.expiresAt).isExpired) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Flame className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              Бустеры
            </h1>
            <p className="text-muted-foreground">Активные усиления вашего профиля</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : activeBoosts.length === 0 && expiredBoosts.length === 0 ? (
        <div className="text-center py-20">
          <Flame className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground text-lg">Нет активных бустеров</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Купите бустер в магазине или получите за квест!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active boosts */}
          {activeBoosts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" /> Активные ({activeBoosts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeBoosts.map(boost => {
                  const info = boostTypeInfo[boost.boostType] || boostTypeInfo.exp;
                  const Icon = info.icon;
                  const remaining = getTimeRemaining(boost.expiresAt);
                  return (
                    <Card key={boost.id} className="glass glass-border overflow-hidden relative">
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${info.gradient}`} />
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${info.gradient} flex items-center justify-center shadow-lg`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{info.label}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                x{boost.multiplier}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Осталось
                            </span>
                            <span className={info.color}>{remaining.text}</span>
                          </div>
                          <Progress value={remaining.percent} className="h-1.5" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expired boosts */}
          {expiredBoosts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Завершённые</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expiredBoosts.map(boost => {
                  const info = boostTypeInfo[boost.boostType] || boostTypeInfo.exp;
                  return (
                    <Card key={boost.id} className="glass glass-border opacity-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center">
                            <info.icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{info.label} x{boost.multiplier}</p>
                            <p className="text-xs text-muted-foreground">Истёк</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
