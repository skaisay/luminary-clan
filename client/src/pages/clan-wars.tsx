import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Swords, Shield, Trophy, Users, Flame, Star, Calendar, Clock, Target,
  Loader2, Crown, Medal, Award, Zap, ChevronRight, Plus, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

interface Tournament {
  id: string;
  name: string;
  description: string;
  type: "1v1" | "team" | "clan";
  status: "upcoming" | "active" | "finished";
  startDate: string;
  endDate: string | null;
  maxParticipants: number;
  currentParticipants: number;
  reward: number;
  createdBy: string;
}

interface ClanWar {
  id: string;
  clan1Name: string;
  clan2Name: string;
  clan1Score: number;
  clan2Score: number;
  status: "pending" | "active" | "finished";
  startDate: string;
  endDate: string | null;
  reward: number;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  discordId: string;
  avatar: string | null;
  wins: number;
  losses: number;
  score: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Скоро", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  active: { label: "Идёт", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  finished: { label: "Завершён", color: "text-muted-foreground bg-muted/30 border-muted" },
  pending: { label: "Ожидание", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
};

const typeLabels: Record<string, string> = {
  "1v1": "1 на 1",
  team: "Команда",
  clan: "Клан",
};

export default function ClanWarsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: "",
    description: "",
    type: "1v1" as "1v1" | "team" | "clan",
    maxParticipants: 16,
    reward: 500,
  });

  const { data: tournaments, isLoading: loadingTournaments } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  const { data: clanWars, isLoading: loadingWars } = useQuery<ClanWar[]>({
    queryKey: ["/api/clan-wars"],
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/tournaments/leaderboard"],
  });

  const joinMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const res = await apiRequest("POST", `/api/tournaments/${tournamentId}/join`, {
        discordId: user?.discordId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tournaments", {
        ...newTournament,
        createdBy: user?.discordId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      setCreateOpen(false);
      setNewTournament({ name: "", description: "", type: "1v1", maxParticipants: 16, reward: 500 });
    },
  });

  const activeTournaments = tournaments?.filter(t => t.status === "active") || [];
  const upcomingTournaments = tournaments?.filter(t => t.status === "upcoming") || [];
  const finishedTournaments = tournaments?.filter(t => t.status === "finished") || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Swords className="h-7 w-7 text-red-400" />
          <div>
            <h1 className="text-2xl font-bold">Клановые войны и Турниры</h1>
            <p className="text-sm text-muted-foreground">Соревнуйся и побеждай</p>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" disabled={!user?.discordId}>
              <Plus className="h-4 w-4" /> Создать турнир
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать турнир</DialogTitle>
              <DialogDescription>Заполните параметры нового турнира</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                placeholder="Название турнира"
                value={newTournament.name}
                onChange={e => setNewTournament(p => ({ ...p, name: e.target.value }))}
              />
              <Input
                placeholder="Описание"
                value={newTournament.description}
                onChange={e => setNewTournament(p => ({ ...p, description: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-2">
                {(["1v1", "team", "clan"] as const).map(type => (
                  <Button
                    key={type}
                    variant={newTournament.type === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewTournament(p => ({ ...p, type }))}
                  >
                    {typeLabels[type]}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Макс. участников</label>
                  <Input
                    type="number"
                    value={newTournament.maxParticipants}
                    onChange={e => setNewTournament(p => ({ ...p, maxParticipants: parseInt(e.target.value) || 8 }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Награда (LC)</label>
                  <Input
                    type="number"
                    value={newTournament.reward}
                    onChange={e => setNewTournament(p => ({ ...p, reward: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newTournament.name}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="tournaments">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="tournaments" className="flex-1 gap-1">
            <Trophy className="h-3.5 w-3.5" /> Турниры
          </TabsTrigger>
          <TabsTrigger value="wars" className="flex-1 gap-1">
            <Swords className="h-3.5 w-3.5" /> Клановые войны
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex-1 gap-1">
            <Crown className="h-3.5 w-3.5" /> Рейтинг
          </TabsTrigger>
        </TabsList>

        {/* Tournaments */}
        <TabsContent value="tournaments" className="space-y-6">
          {loadingTournaments ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {/* Active */}
              {activeTournaments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-red-400" /> Активные
                  </h3>
                  <div className="space-y-3">
                    {activeTournaments.map(t => (
                      <TournamentCard key={t.id} tournament={t} onJoin={() => joinMutation.mutate(t.id)} joining={joinMutation.isPending} />
                    ))}
                  </div>
                </div>
              )}
              {/* Upcoming */}
              {upcomingTournaments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-blue-400" /> Предстоящие
                  </h3>
                  <div className="space-y-3">
                    {upcomingTournaments.map(t => (
                      <TournamentCard key={t.id} tournament={t} onJoin={() => joinMutation.mutate(t.id)} joining={joinMutation.isPending} />
                    ))}
                  </div>
                </div>
              )}
              {/* Finished */}
              {finishedTournaments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Завершённые
                  </h3>
                  <div className="space-y-3">
                    {finishedTournaments.slice(0, 5).map(t => (
                      <TournamentCard key={t.id} tournament={t} />
                    ))}
                  </div>
                </div>
              )}
              {(!tournaments || tournaments.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Нет турниров</p>
                  <p className="text-sm">Создайте первый турнир!</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Clan Wars */}
        <TabsContent value="wars" className="space-y-4">
          {loadingWars ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !clanWars || clanWars.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Нет клановых войн</p>
            </div>
          ) : (
            clanWars.map(war => (
              <Card key={war.id} className="glass glass-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className={statusLabels[war.status]?.color}>
                      {statusLabels[war.status]?.label}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Trophy className="h-3 w-3 text-yellow-500" />
                      {war.reward} LC
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <p className="font-bold text-lg">{war.clan1Name}</p>
                      <p className="text-3xl font-black text-primary">{war.clan1Score}</p>
                    </div>
                    <div className="px-4">
                      <Swords className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="text-center flex-1">
                      <p className="font-bold text-lg">{war.clan2Name}</p>
                      <p className="text-3xl font-black text-red-400">{war.clan2Score}</p>
                    </div>
                  </div>
                  {war.startDate && (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      {new Date(war.startDate).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" /> Рейтинг турниров
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!leaderboard || leaderboard.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Нет данных</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, idx) => (
                    <div
                      key={entry.discordId}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        idx === 0 ? "bg-yellow-500/10 border border-yellow-500/20" :
                        idx === 1 ? "bg-gray-400/10 border border-gray-400/20" :
                        idx === 2 ? "bg-amber-600/10 border border-amber-600/20" :
                        "bg-muted/20"
                      }`}
                    >
                      <span className={`text-lg font-bold w-8 text-center ${
                        idx === 0 ? "text-yellow-400" :
                        idx === 1 ? "text-gray-300" :
                        idx === 2 ? "text-amber-500" : "text-muted-foreground"
                      }`}>
                        #{entry.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entry.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.wins}W / {entry.losses}L
                        </p>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {entry.score}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TournamentCard({ tournament: t, onJoin, joining }: { tournament: Tournament; onJoin?: () => void; joining?: boolean }) {
  const fillPercent = Math.round((t.currentParticipants / t.maxParticipants) * 100);

  return (
    <Card className="glass glass-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-bold">{t.name}</h4>
            {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{typeLabels[t.type]}</Badge>
            <Badge variant="outline" className={statusLabels[t.status]?.color}>
              {statusLabels[t.status]?.label}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t.currentParticipants}/{t.maxParticipants}</span>
          <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-yellow-500" /> {t.reward} LC</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(t.startDate).toLocaleDateString("ru-RU")}</span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={fillPercent} className="h-1.5 flex-1" />
          {onJoin && t.status !== "finished" && t.currentParticipants < t.maxParticipants && (
            <Button size="sm" onClick={onJoin} disabled={joining} className="gap-1 shrink-0">
              {joining ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3 w-3" />}
              Участвовать
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
