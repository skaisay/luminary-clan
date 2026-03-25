import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, Trophy, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClanStats, ClanMember, ClanSettings } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAllDecorations, MemberDecorations } from "@/components/member-decorations";
import { StyledUsername } from "@/components/UserBadges";
import heroBackground from "@assets/generated_images/Futuristic_hero_background_cityscape_2d39cec6.png";

interface DiscordInfo {
  memberCount: number;
  onlineCount: number;
  guildName: string;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useQuery<ClanSettings>({
    queryKey: ["/api/clan/settings"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ClanStats>({
    queryKey: ["/api/clan/stats"],
  });

  const { data: topMembers, isLoading: membersLoading } = useQuery<ClanMember[]>({
    queryKey: ["/api/members/top"],
  });

  const { data: discordInfo, isLoading: discordLoading } = useQuery<DiscordInfo>({
    queryKey: ["/api/discord/info"],
    refetchInterval: 60000,
  });

  const { data: decorations } = useAllDecorations();

  const statCards = [
    {
      title: t('dashboard.members'),
      value: discordInfo?.memberCount || stats?.totalMembers || 0,
      icon: Users,
      trend: "+12%",
      color: "text-primary",
    },
    {
      title: t('dashboard.wins'),
      value: stats?.totalWins || 0,
      icon: Trophy,
      trend: "+8%",
      color: "text-accent",
    },
    {
      title: t('dashboard.rating'),
      value: stats?.averageRank || 0,
      icon: TrendingUp,
      trend: "+5%",
      color: "text-chart-3",
    },
    {
      title: t('dashboard.activity'),
      value: stats?.monthlyActivity || 0,
      icon: Activity,
      trend: "+15%",
      color: "text-chart-4",
    },
  ];

  const bgUrl = settings?.heroImageUrl || heroBackground;

  return (
    <div className="min-h-screen -mt-20">
      {/* Fullscreen background — fixed on md+, absolute on mobile */}
      <div
        className="absolute md:fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <div className="absolute md:fixed inset-0 w-full h-full z-0 bg-gradient-to-b from-black/40 via-black/50 to-background" />

      {/* Hero content section */}
      <div className="relative h-[450px] md:h-[500px] lg:h-[550px] mb-4 pt-20 z-10">
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
          {settingsLoading ? (
            <Skeleton className="h-16 w-96 mb-4" />
          ) : (
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-wide animate-float" data-testid="text-clan-name">
              {settings?.clanName || "CLAN COMMAND"}
            </h1>
          )}
          {settingsLoading ? (
            <Skeleton className="h-8 w-full max-w-2xl mb-6" />
          ) : (
            <p className="text-xl text-gray-200 max-w-2xl mb-6" data-testid="text-clan-description">
              {settings?.description || t('dashboard.description')}
            </p>
          )}
          <div className="flex gap-4">
            {discordLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <Badge className="glass glass-border px-6 py-2 text-base" data-testid="badge-online-status">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                {discordInfo?.onlineCount || 0} {t('dashboard.online')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 pb-12 -mt-12 bg-background rounded-t-xl">
        <div className="max-w-4xl mx-auto">
          <Card className="glass glass-border border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                {t('dashboard.topMembers')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {topMembers?.slice(0, 5).map((member, index) => (
                    <Link
                      key={member.id}
                      href={`/profile/${member.discordId || member.username}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-background/50 to-transparent border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                      data-testid={`card-member-${member.id}`}
                    >
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 font-bold text-xs">
                        {index + 1}
                      </div>
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.username}
                          className="w-9 h-9 rounded-lg object-cover border border-primary/20"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-white font-bold text-xs border border-primary/20">
                          {member.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          <StyledUsername discordId={member.discordId || ''} username={member.username} />
                          <MemberDecorations discordId={member.discordId} decorations={decorations} />
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-base tabular-nums text-primary">{member.lumiCoins ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">LC</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
