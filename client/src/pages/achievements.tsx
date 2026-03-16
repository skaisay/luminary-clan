import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy, Star, Lock, CheckCircle2, Sparkles, Shield, MessageSquare,
  Coins, Users, Zap, Target, Crown, Medal, Award, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  requirement: { type: string; count: number };
  reward: { coins?: number; items?: string[] } | null;
  isSecret: boolean;
}

interface UserAchievement {
  userAchievementId: string;
  progress: number;
  isCompleted: boolean;
  completedAt: string | null;
  achievement: Achievement;
}

const categoryIcons: Record<string, any> = {
  general: Star,
  activity: Zap,
  economy: Coins,
  social: Users,
};

const categoryColors: Record<string, string> = {
  general: "from-blue-500 to-cyan-500",
  activity: "from-orange-500 to-yellow-500",
  economy: "from-green-500 to-emerald-500",
  social: "from-purple-500 to-pink-500",
};

export default function AchievementsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: allAchievements, isLoading: loadingAll } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
  });

  const { data: userAchievements, isLoading: loadingUser } = useQuery<UserAchievement[]>({
    queryKey: [`/api/achievements/${user?.discordId}`],
    enabled: !!user?.discordId,
  });

  const completedIds = new Set(
    userAchievements?.filter(ua => ua.isCompleted).map(ua => ua.achievement.id) || []
  );

  const userProgressMap = new Map(
    userAchievements?.map(ua => [ua.achievement.id, ua]) || []
  );

  const totalCompleted = completedIds.size;
  const totalAchievements = allAchievements?.length || 0;
  const completionPercent = totalAchievements > 0 ? Math.round((totalCompleted / totalAchievements) * 100) : 0;

  const categories = ["all", "general", "activity", "economy", "social"];

  const filtered = activeTab === "all"
    ? allAchievements
    : allAchievements?.filter(a => a.category === activeTab);

  const isLoading = loadingAll || loadingUser;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Trophy className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              {t('achievements.title')}
            </h1>
            <p className="text-muted-foreground">{t('achievements.description')}</p>
          </div>
        </div>

        {/* Progress overview */}
        {user?.discordId && (
          <Card className="glass glass-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">{t('achievements.overallProgress')}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {totalCompleted} / {totalAchievements} ({completionPercent}%)
                </span>
              </div>
              <Progress value={completionPercent} className="h-3" />
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{totalCompleted} {t('achievements.completed')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>{totalAchievements - totalCompleted} {t('achievements.remaining')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="glass glass-border w-full justify-start overflow-x-auto">
          {categories.map(cat => {
            const Icon = categoryIcons[cat] || Star;
            return (
              <TabsTrigger key={cat} value={cat} className="gap-1.5 capitalize">
                {cat !== "all" && <Icon className="h-4 w-4" />}
                {cat === "all" ? t('achievements.all') : cat === "general" ? t('achievements.general') : cat === "activity" ? t('achievements.activity') : cat === "economy" ? t('achievements.economy') : t('achievements.social')}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Achievements Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground text-lg">{t('achievements.noAchievements')}</p>
          <p className="text-sm text-muted-foreground/60 mt-1">{t('achievements.comingSoon')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(achievement => {
            const isCompleted = completedIds.has(achievement.id);
            const userProgress = userProgressMap.get(achievement.id);
            const progressPercent = userProgress
              ? Math.min(100, Math.round((userProgress.progress / (achievement.requirement?.count || 1)) * 100))
              : 0;
            const gradientClass = categoryColors[achievement.category] || categoryColors.general;

            return (
              <Card
                key={achievement.id}
                className={`glass glass-border overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                  isCompleted ? "ring-1 ring-yellow-500/30" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? `bg-gradient-to-br ${gradientClass} shadow-lg`
                        : "bg-muted/30"
                    }`}>
                      {isCompleted ? (
                        <span className="text-2xl">{achievement.icon || "🏆"}</span>
                      ) : (
                        <Lock className="h-5 w-5 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm truncate ${isCompleted ? "text-yellow-500" : ""}`}>
                          {achievement.name}
                        </h3>
                        {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {achievement.description}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {user?.discordId && !isCompleted && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{t('achievements.progress')}</span>
                        <span>{userProgress?.progress || 0} / {achievement.requirement?.count || "?"}</span>
                      </div>
                      <Progress value={progressPercent} className="h-1.5" />
                    </div>
                  )}

                  {/* Reward */}
                  {achievement.reward && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Sparkles className="h-3 w-3" />
                        {achievement.reward.coins ? `+${achievement.reward.coins} LC` : t('achievements.reward')}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {achievement.category === "general" ? t('achievements.general') : achievement.category === "activity" ? t('achievements.activity') : achievement.category === "economy" ? t('achievements.economy') : t('achievements.social')}
                      </Badge>
                    </div>
                  )}

                  {isCompleted && userProgress?.completedAt && (
                    <p className="text-[10px] text-muted-foreground/50 mt-2">
                      {t('achievements.completedAt')}: {new Date(userProgress.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
