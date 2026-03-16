import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Shield, Swords, Star, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import type { ClanMember } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllDecorations, MemberDecorations } from "@/components/member-decorations";
import { StyledUsername } from "@/components/UserBadges";
import { Link } from "wouter";

interface DiscordInfo {
  memberCount: number;
  onlineCount: number;
  guildName: string;
}

export default function Members() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: members, isLoading } = useQuery<ClanMember[]>({
    queryKey: ["/api/members"],
  });

  const { data: decorations } = useAllDecorations();

  // Получаем реальное количество участников с Discord API
  const { data: discordInfo } = useQuery<DiscordInfo>({
    queryKey: ["/api/discord/info"],
    refetchInterval: 60000, // Обновляем каждую минуту
  });
  
  // Фильтруем участников по поисковому запросу
  const filteredMembers = members?.filter(member =>
    member.username.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getRoleIcon = (role: string) => {
    if (role === "Leader") return <Shield className="h-5 w-5 text-yellow-500" />;
    if (role === "Officer") return <Star className="h-5 w-5 text-blue-500" />;
    return <Swords className="h-5 w-5 text-gray-500" />;
  };

  const getRoleColor = (role: string) => {
    return "";
  };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide">
          {t('members.title')}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('members.description')}
        </p>
      </div>

      <Card className="glass glass-border mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2 mb-4">
            <Users className="h-7 w-7 text-primary" />
            {t('members.totalMembers')}: {discordInfo?.memberCount || members?.length || 0}
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('members.searchPlaceholder', 'Поиск участников по никнейму...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass glass-border"
              data-testid="input-search-members"
            />
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card className="glass glass-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-lg">{t('members.noResults', 'Участники не найдены')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((member) => (
            <Link key={member.id} href={member.discordId ? `/profile/${member.discordId}` : '#'}>
            <Card
              className={`glass glass-border hover-elevate transition-all cursor-pointer ${getRoleColor(member.role)}`}
              data-testid={`card-member-${member.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.username}
                      className="w-10 h-10 rounded-lg object-cover border border-primary/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                      {member.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base mb-0.5 truncate">
                      <StyledUsername discordId={member.discordId || ''} username={member.username} />
                      <MemberDecorations discordId={member.discordId} decorations={decorations} />
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      {getRoleIcon(member.role)}
                      <Badge variant="outline" className="text-xs py-0 px-1.5">{member.role}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2.5">
                  <div className="text-center p-2.5 rounded-lg glass glass-border">
                    <p className="text-2xl font-bold text-primary tabular-nums mb-0.5">{member.lumiCoins ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">LumiCoin</p>
                  </div>

                  <div className="pt-2 border-t border-border/30">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Присоединился</span>
                      <span className="text-xs font-medium">
                        {new Date(member.joinedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>            </Link>          ))}
        </div>
      )}
    </div>
  );
}
