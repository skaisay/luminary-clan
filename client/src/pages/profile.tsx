import { useQuery } from "@tanstack/react-query";
import {
  User, Trophy, Coins, Zap, Shield, Star, Clock, BarChart3,
  Loader2, Flame, Medal, Crown, Package, Award, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "wouter";

interface MemberProfile {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  role: string;
  rank: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  lumiCoins: number;
  experience: number;
  level: number;
  equippedTitle: string | null;
  equippedBanner: string | null;
  joinedAt: string;
}

interface ProfileAchievement {
  userAchievementId: string;
  progress: number;
  isCompleted: boolean;
  completedAt: string | null;
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string | null;
    category: string;
  };
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  rarity: string;
  quantity: number;
  isEquipped: boolean;
}

const rankBadges: Record<string, { label: string; color: string; icon: any }> = {
  legend: { label: "Легенда", color: "text-yellow-400 bg-yellow-500/10", icon: Crown },
  elite: { label: "Элита", color: "text-purple-400 bg-purple-500/10", icon: Star },
  veteran: { label: "Ветеран", color: "text-blue-400 bg-blue-500/10", icon: Shield },
  fighter: { label: "Боец", color: "text-green-400 bg-green-500/10", icon: Medal },
};

function getRankTitle(level: number): { label: string; color: string; icon: any } {
  if (level >= 50) return rankBadges.legend;
  if (level >= 30) return rankBadges.elite;
  if (level >= 15) return rankBadges.veteran;
  return rankBadges.fighter;
}

function getXpForNextLevel(level: number): number {
  return level * 100 + 50;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const params = useParams<{ discordId?: string }>();
  const targetDiscordId = params.discordId || user?.discordId;

  const { data: profile, isLoading: loadingProfile } = useQuery<MemberProfile>({
    queryKey: [`/api/profile/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  const { data: achievements, isLoading: loadingAchievements } = useQuery<ProfileAchievement[]>({
    queryKey: [`/api/achievements/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  const { data: inventory } = useQuery<InventoryItem[]>({
    queryKey: [`/api/inventory/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  if (!targetDiscordId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">Профиль</h1>
        <p className="text-muted-foreground">Войдите через Discord для просмотра профиля</p>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">Профиль не найден</h1>
        <p className="text-muted-foreground">Участник с таким Discord ID не найден</p>
      </div>
    );
  }

  const rankInfo = getRankTitle(profile.level);
  const RankIcon = rankInfo.icon;
  const xpForNext = getXpForNextLevel(profile.level);
  const xpProgress = Math.min(100, Math.round((profile.experience % xpForNext) / xpForNext * 100));
  const completedAchievements = achievements?.filter(a => a.isCompleted) || [];
  const kd = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills.toString();
  const winRate = (profile.wins + profile.losses) > 0
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl pt-24">
      {/* Profile Header */}
      <Card className="glass glass-border overflow-hidden mb-6">
        <div className="h-32 bg-gradient-to-r from-primary/30 to-[hsl(var(--accent))]/30 relative">
          {profile.equippedBanner && (
            <img src={profile.equippedBanner} alt="" className="w-full h-full object-cover absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <CardContent className="relative -mt-12 pb-6">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <Avatar className="w-24 h-24 border-4 border-background shadow-xl">
              <AvatarImage src={profile.avatar || undefined} />
              <AvatarFallback className="text-2xl">{profile.username[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.username}</h1>
                {profile.equippedTitle && (
                  <Badge variant="secondary" className="text-xs">{profile.equippedTitle}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <Badge variant="outline" className={`${rankInfo.color} gap-1`}>
                  <RankIcon className="h-3 w-3" /> {rankInfo.label}
                </Badge>
                <span className="text-sm text-muted-foreground">{profile.role}</span>
                <span className="text-sm text-muted-foreground">Уровень {profile.level}</span>
              </div>
              {/* XP Progress */}
              <div className="mt-3 max-w-md">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Опыт</span>
                  <span>{profile.experience % xpForNext} / {xpForNext} XP</span>
                </div>
                <Progress value={xpProgress} className="h-2" />
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-yellow-500">
                <Coins className="h-5 w-5" />
                <span className="text-xl font-bold">{profile.lumiCoins?.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">LumiCoins</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats */}
        <div className="md:col-span-2 space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <Trophy className="h-5 w-5 mx-auto mb-1 text-green-400" />
                <p className="text-xl font-bold">{profile.wins}</p>
                <p className="text-xs text-muted-foreground">Побед</p>
              </CardContent>
            </Card>
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <p className="text-xl font-bold">{winRate}%</p>
                <p className="text-xs text-muted-foreground">Винрейт</p>
              </CardContent>
            </Card>
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-red-400" />
                <p className="text-xl font-bold">{kd}</p>
                <p className="text-xs text-muted-foreground">K/D</p>
              </CardContent>
            </Card>
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-purple-400" />
                <p className="text-xl font-bold">{profile.kills}</p>
                <p className="text-xs text-muted-foreground">Убийств</p>
              </CardContent>
            </Card>
          </div>

          {/* Achievements */}
          <Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-500" />
                Достижения ({completedAchievements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedAchievements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Нет достижений</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {completedAchievements.slice(0, 9).map(a => (
                    <div key={a.userAchievementId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                      <span className="text-lg">{a.achievement.icon || "🏆"}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{a.achievement.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.achievement.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info */}
          <Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Роль</span>
                <span>{profile.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ранг</span>
                <span>#{profile.rank || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> В клане с</span>
                <span>{new Date(profile.joinedAt).toLocaleDateString("ru-RU")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ассисты</span>
                <span>{profile.assists}</span>
              </div>
            </CardContent>
          </Card>

          {/* Inventory preview */}
          <Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Инвентарь
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!inventory || inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Пусто</p>
              ) : (
                <div className="space-y-2">
                  {inventory.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{item.name}</span>
                      <Badge variant="outline" className="text-[10px]">{item.quantity}x</Badge>
                    </div>
                  ))}
                  {inventory.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">...и ещё {inventory.length - 5}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
