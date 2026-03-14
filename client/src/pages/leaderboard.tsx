import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClanMember } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllDecorations, MemberDecorations } from "@/components/member-decorations";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function Leaderboard() {
  const { t } = useLanguage();
  const { data: members, isLoading } = useQuery<ClanMember[]>({
    queryKey: ["/api/members"],
  });

  const { data: decorations } = useAllDecorations();

  const sortedMembers = members?.sort((a, b) => (b.lumiCoins ?? 0) - (a.lumiCoins ?? 0)) || [];

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-orange-600" />;
    return <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 flex items-center justify-center font-bold text-xs">{index + 1}</div>;
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return t('leaderboard.legend');
    if (index < 3) return t('leaderboard.elite');
    if (index < 10) return t('leaderboard.veteran');
    return t('leaderboard.fighter');
  };

  return (
    <TooltipProvider>
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-primary tracking-wide">
          {t('leaderboard.title')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('leaderboard.description')}
        </p>
      </div>

      <Card className="glass glass-border border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            {t('leaderboard.overallRating')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedMembers.map((member, index) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-background/50 to-transparent border border-border/50 hover:border-primary/30 transition-colors"
                  data-testid={`row-leaderboard-${index}`}
                >
                  <div className="flex items-center justify-center min-w-[28px]">
                    {getRankIcon(index)}
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
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold truncate">{member.username}</h3>
                      <MemberDecorations discordId={member.discordId} decorations={decorations} />
                      <Badge className="text-[10px] px-1.5 py-0 h-5" variant="outline">
                        {getRankBadge(index)}
                      </Badge>
                      <Badge className="text-[10px] px-1.5 py-0 h-5" variant="secondary">{member.role}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {new Date(member.joinedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      <p className="text-base font-bold tabular-nums text-primary">{member.lumiCoins ?? 0}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">LC</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
