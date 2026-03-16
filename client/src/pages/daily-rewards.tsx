import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Gift, Calendar, Flame, Coins, Sparkles, Loader2, CheckCircle2, Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface DailyRewardInfo {
  canClaim: boolean;
  streakDays: number;
  totalClaims: number;
  lastClaimDate: string | null;
  nextReward: number;
  streakBonus: number;
  timeUntilNextClaim?: string;
}

const streakRewards = [
  { day: 1, coins: 10 },
  { day: 2, coins: 15 },
  { day: 3, coins: 20 },
  { day: 4, coins: 25 },
  { day: 5, coins: 30 },
  { day: 6, coins: 40 },
  { day: 7, coins: 75, special: true },
];

export default function DailyRewardsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState("");

  const { data: rewardInfo, isLoading } = useQuery<DailyRewardInfo>({
    queryKey: [`/api/daily-reward/${user?.discordId}`],
    enabled: !!user?.discordId,
    refetchInterval: 60000,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/daily-reward/claim", { discordId: user?.discordId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/daily-reward/${user?.discordId}`] });
      toast({ title: data.message || `🎉 +${data.reward} LumiCoins!` });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  // Countdown timer
  useEffect(() => {
    if (!rewardInfo || rewardInfo.canClaim) return;

    const updateCountdown = () => {
      if (!rewardInfo.lastClaimDate) return;
      const lastClaim = new Date(rewardInfo.lastClaimDate);
      const nextClaim = new Date(lastClaim);
      nextClaim.setHours(nextClaim.getHours() + 24);
      
      const now = Date.now();
      const diff = nextClaim.getTime() - now;
      
      if (diff <= 0) {
        setCountdown("");
        queryClient.invalidateQueries({ queryKey: [`/api/daily-reward/${user?.discordId}`] });
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}ч ${m}м ${s}с`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [rewardInfo, user?.discordId]);

  if (!user?.discordId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">{t('dailyRewards.title')}</h1>
        <p className="text-muted-foreground">{t('dailyRewards.loginRequired')}</p>
      </div>
    );
  }

  const currentStreak = rewardInfo?.streakDays || 0;
  const currentDayInWeek = ((currentStreak - 1) % 7) + 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-24">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 mb-6 shadow-lg shadow-amber-500/25">
          <Gift className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
          {t('dailyRewards.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('dailyRewards.description')}</p>

        {/* Streak info */}
        <div className="flex justify-center gap-6 mt-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-orange-400">
              <Flame className="h-5 w-5" />
              <span className="text-2xl font-bold">{currentStreak}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('dailyRewards.streakDays')}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-yellow-400">
              <Calendar className="h-5 w-5" />
              <span className="text-2xl font-bold">{rewardInfo?.totalClaims || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('dailyRewards.totalClaimed')}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Daily streak row */}
          <div className="grid grid-cols-7 gap-2 mb-8">
            {streakRewards.map((day, i) => {
              const isPast = i + 1 < currentDayInWeek;
              const isCurrent = i + 1 === currentDayInWeek;
              const isFuture = i + 1 > currentDayInWeek;

              return (
                <Card
                  key={day.day}
                  className={`glass glass-border overflow-hidden transition-all ${
                    isCurrent ? "ring-2 ring-amber-500 shadow-lg shadow-amber-500/20 scale-105" :
                    isPast ? "opacity-50" : ""
                  }`}
                >
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{t('dailyRewards.day')} {day.day}</p>
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      isPast ? "bg-green-500/20" :
                      isCurrent ? "bg-gradient-to-br from-amber-500 to-orange-500" :
                      "bg-muted/30"
                    }`}>
                      {isPast ? (
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                      ) : isCurrent ? (
                        <Gift className="h-5 w-5 text-white" />
                      ) : (
                        <Coins className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <p className={`text-xs font-bold ${
                      day.special ? "text-yellow-400" : isCurrent ? "text-amber-400" : "text-muted-foreground"
                    }`}>
                      +{day.coins}
                    </p>
                    {day.special && <Sparkles className="h-3 w-3 mx-auto text-yellow-400 mt-0.5" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Claim button */}
          <div className="text-center">
            {rewardInfo?.canClaim ? (
              <Button
                size="lg"
                onClick={() => claimMutation.mutate()}
                disabled={claimMutation.isPending}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 text-lg px-8 py-6 shadow-lg shadow-amber-500/25"
              >
                {claimMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Gift className="h-5 w-5" />
                )}
                {t('dailyRewards.claimReward')} (+{rewardInfo.nextReward} LC)
              </Button>
            ) : (
              <div>
                <Button size="lg" disabled className="gap-2 text-lg px-8 py-6 opacity-50">
                  <Clock className="h-5 w-5" /> {t('dailyRewards.alreadyClaimed')}
                </Button>
                {countdown && (
                  <p className="text-sm text-muted-foreground mt-3">
                    {t('dailyRewards.nextRewardIn')}: <span className="text-amber-400 font-mono font-bold">{countdown}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
