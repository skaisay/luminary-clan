import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Scroll, Clock, CheckCircle2, Coins, Zap, Target, Calendar,
  Loader2, ChevronRight, Sparkles, Star, Timer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface Quest {
  id: string;
  name: string;
  description: string;
  questType: string;
  requirements: { type: string; count: number }[];
  rewards: { coins?: number; items?: string[] };
  isActive: boolean;
  expiresAt: string | null;
}

interface UserQuest {
  id: string;
  questId: string;
  progress: Record<string, number>;
  isCompleted: boolean;
  completedAt: string | null;
  claimedAt: string | null;
  quest: Quest;
}

const questTypeLabels: Record<string, { label: string; color: string; icon: any }> = {
  daily: { label: "Ежедневный", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Calendar },
  weekly: { label: "Еженедельный", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: Clock },
  special: { label: "Особый", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Star },
};

export default function QuestsPage() {
  const [activeTab, setActiveTab] = useState("active");
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: quests, isLoading: loadingQuests } = useQuery<Quest[]>({
    queryKey: ["/api/quests"],
  });

  const { data: userQuests, isLoading: loadingUserQuests } = useQuery<UserQuest[]>({
    queryKey: [`/api/quests/user/${user?.discordId}`],
    enabled: !!user?.discordId,
  });

  const acceptQuestMutation = useMutation({
    mutationFn: async (questId: string) => {
      const res = await apiRequest("POST", "/api/quests/accept", { questId, discordId: user?.discordId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/quests/user/${user?.discordId}`] });
      toast({ title: "✅ Квест принят!" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const claimRewardMutation = useMutation({
    mutationFn: async (userQuestId: string) => {
      const res = await apiRequest("POST", "/api/quests/claim", { userQuestId, discordId: user?.discordId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/quests/user/${user?.discordId}`] });
      toast({ title: data.message || "🎉 Награда получена!" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const acceptedQuestIds = new Set(userQuests?.map(uq => uq.questId) || []);

  const activeQuests = userQuests?.filter(uq => !uq.isCompleted) || [];
  const completedQuests = userQuests?.filter(uq => uq.isCompleted) || [];
  const availableQuests = quests?.filter(q => q.isActive && !acceptedQuestIds.has(q.id)) || [];

  const isLoading = loadingQuests || loadingUserQuests;

  if (!user?.discordId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <Scroll className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">Квесты</h1>
        <p className="text-muted-foreground">Войдите через Discord, чтобы выполнять квесты</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
            <Scroll className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              Квесты
            </h1>
            <p className="text-muted-foreground">Выполняйте задания и получайте награды</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="glass glass-border">
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 mx-auto mb-1 text-blue-400" />
              <p className="text-2xl font-bold">{activeQuests.length}</p>
              <p className="text-xs text-muted-foreground">Активных</p>
            </CardContent>
          </Card>
          <Card className="glass glass-border">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-400" />
              <p className="text-2xl font-bold">{completedQuests.length}</p>
              <p className="text-xs text-muted-foreground">Выполнено</p>
            </CardContent>
          </Card>
          <Card className="glass glass-border">
            <CardContent className="p-4 text-center">
              <Sparkles className="h-6 w-6 mx-auto mb-1 text-yellow-400" />
              <p className="text-2xl font-bold">{availableQuests.length}</p>
              <p className="text-xs text-muted-foreground">Доступно</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass glass-border w-full justify-start mb-6">
          <TabsTrigger value="active" className="gap-1.5">
            <Target className="h-4 w-4" /> Активные ({activeQuests.length})
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-1.5">
            <Scroll className="h-4 w-4" /> Доступные ({availableQuests.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Выполненные ({completedQuests.length})
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Active quests */}
            <TabsContent value="active" className="space-y-3">
              {activeQuests.length === 0 ? (
                <div className="text-center py-16">
                  <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Нет активных квестов</p>
                  <p className="text-sm text-muted-foreground/60">Примите квест из доступных</p>
                </div>
              ) : (
                activeQuests.map(uq => {
                  const quest = uq.quest;
                  const typeInfo = questTypeLabels[quest.questType] || questTypeLabels.daily;
                  const TypeIcon = typeInfo.icon;
                  const totalRequired = quest.requirements.reduce((sum, r) => sum + r.count, 0);
                  const totalProgress = quest.requirements.reduce((sum, r) => {
                    const key = r.type;
                    return sum + (uq.progress[key] || 0);
                  }, 0);
                  const progressPercent = totalRequired > 0 ? Math.min(100, Math.round((totalProgress / totalRequired) * 100)) : 0;

                  return (
                    <Card key={uq.id} className="glass glass-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {typeInfo.label}
                              </Badge>
                              <h3 className="font-semibold text-sm">{quest.name}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">{quest.description}</p>
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span>Прогресс</span>
                                <span>{progressPercent}%</span>
                              </div>
                              <Progress value={progressPercent} className="h-2" />
                            </div>
                            {quest.rewards?.coins && (
                              <div className="mt-2">
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Coins className="h-3 w-3" />
                                  +{quest.rewards.coins} LC
                                </Badge>
                              </div>
                            )}
                          </div>
                          {uq.isCompleted && !uq.claimedAt && (
                            <Button
                              size="sm"
                              onClick={() => claimRewardMutation.mutate(uq.id)}
                              disabled={claimRewardMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Sparkles className="h-4 w-4 mr-1" /> Забрать
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* Available quests */}
            <TabsContent value="available" className="space-y-3">
              {availableQuests.length === 0 ? (
                <div className="text-center py-16">
                  <Scroll className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Нет доступных квестов</p>
                  <p className="text-sm text-muted-foreground/60">Новые квесты скоро появятся!</p>
                </div>
              ) : (
                availableQuests.map(quest => {
                  const typeInfo = questTypeLabels[quest.questType] || questTypeLabels.daily;
                  const TypeIcon = typeInfo.icon;
                  return (
                    <Card key={quest.id} className="glass glass-border hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {typeInfo.label}
                              </Badge>
                              <h3 className="font-semibold text-sm">{quest.name}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">{quest.description}</p>
                            {quest.rewards?.coins && (
                              <div className="mt-2">
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Coins className="h-3 w-3" />
                                  +{quest.rewards.coins} LC
                                </Badge>
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acceptQuestMutation.mutate(quest.id)}
                            disabled={acceptQuestMutation.isPending}
                          >
                            Принять <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* Completed quests */}
            <TabsContent value="completed" className="space-y-3">
              {completedQuests.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Пока ничего не выполнено</p>
                </div>
              ) : (
                completedQuests.map(uq => {
                  const quest = uq.quest;
                  return (
                    <Card key={uq.id} className="glass glass-border opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{quest.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              Выполнено {uq.completedAt ? new Date(uq.completedAt).toLocaleDateString("ru-RU") : ""}
                            </p>
                          </div>
                          {uq.claimedAt ? (
                            <Badge variant="secondary" className="text-xs">Награда получена</Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => claimRewardMutation.mutate(uq.id)}
                              disabled={claimRewardMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Забрать
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
