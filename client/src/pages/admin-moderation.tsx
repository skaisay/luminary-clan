import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, ShieldOff, Clock, AlertTriangle, CheckCircle, Trash2, Eye, ArrowLeft, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

interface MutedUser {
  discordId: string;
  username: string;
  avatar: string;
  muteExpiresAt: string | null;
  reason: string;
  source: 'timeout' | 'restricted' | 'bot-level';
}

interface FlaggedMessage {
  id: string;
  messageId: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorUsername: string;
  content: string;
  reason: string;
  reasonDetail: string;
  status: string;
  messageTimestamp: string;
  createdAt: string;
}

function formatTimeLeft(expiresAt: string | null): string {
  if (!expiresAt) return 'Бессрочно';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Истёк';
  if (diff < 60000) return `${Math.ceil(diff / 1000)}с`;
  if (diff < 3600000) return `${Math.ceil(diff / 60000)}мин`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}ч ${Math.ceil((diff % 3600000) / 60000)}мин`;
  return `${Math.floor(diff / 86400000)}д ${Math.floor((diff % 86400000) / 3600000)}ч`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'timeout': return 'Timeout';
    case 'restricted': return 'Restricted Role';
    case 'bot-level': return 'Bot Enforcement';
    default: return source;
  }
}

function reasonBadge(reason: string) {
  switch (reason) {
    case 'profanity': return <Badge variant="destructive">Мат</Badge>;
    case 'discrimination': return <Badge variant="destructive">Дискриминация</Badge>;
    case 'wrong_language': return <Badge variant="secondary">Язык</Badge>;
    case 'spam': return <Badge className="bg-orange-500">Спам</Badge>;
    default: return <Badge variant="outline">{reason}</Badge>;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'deleted': return <Badge variant="destructive"><Trash2 className="w-3 h-3 mr-1" />Удалено</Badge>;
    case 'approved': return <Badge variant="secondary"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
    case 'pending': return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />На модерации</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminModeration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  // Auth check
  useEffect(() => {
    fetch("/api/admin/check", { credentials: "include" })
      .then(r => { setIsAuthed(r.ok); if (!r.ok) navigate("/admin/login"); })
      .catch(() => { setIsAuthed(false); navigate("/admin/login"); });
  }, [navigate]);

  // === Data queries ===
  const { data: mutedUsers, isLoading: mutedLoading } = useQuery<MutedUser[]>({
    queryKey: ["/api/admin/discord/muted-users"],
    enabled: isAuthed === true,
    refetchInterval: 10000, // auto-refresh every 10s
  });

  const { data: moderationLog, isLoading: logLoading } = useQuery<FlaggedMessage[]>({
    queryKey: ["/api/admin/discord/moderation-log"],
    enabled: isAuthed === true,
  });

  // === Mutations ===
  const unmuteMutation = useMutation({
    mutationFn: async (discordId: string) => {
      const res = await apiRequest("POST", "/api/admin/discord/unmute", { discordId });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/muted-users"] });
      toast({ title: "✅ Размучен", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteFlaggedMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      return await apiRequest("POST", "/api/admin/discord/delete-flagged", { messageIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/moderation-log"] });
      toast({ title: "Удалено" });
    },
  });

  const approveFlaggedMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      return await apiRequest("POST", "/api/admin/discord/approve-flagged", { messageIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/moderation-log"] });
      toast({ title: "Одобрено" });
    },
  });

  if (isAuthed === null) {
    return <div className="flex items-center justify-center min-h-screen"><Skeleton className="h-8 w-48" /></div>;
  }

  const pendingMessages = moderationLog?.filter(m => m.status === 'pending') || [];
  const allMessages = moderationLog || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" /> Модерация бота
            </h1>
            <p className="text-muted-foreground text-sm">Управление мутами, банами и нарушениями</p>
          </div>
        </div>

        <Tabs defaultValue="muted" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="muted" className="flex items-center gap-1">
              <ShieldOff className="w-4 h-4" />
              Замученные
              {mutedUsers && mutedUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{mutedUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              На модерации
              {pendingMessages.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-xs bg-yellow-500">{pendingMessages.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="log" className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              Лог
            </TabsTrigger>
          </TabsList>

          {/* === TAB 1: MUTED USERS === */}
          <TabsContent value="muted" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Замученные пользователи</CardTitle>
                    <CardDescription>Пользователи с активным мутом. Правила одинаковые для всех.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/muted-users"] })}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Обновить
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {mutedLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : !mutedUsers || mutedUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Нет замученных пользователей</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mutedUsers.map((user) => (
                      <div key={user.discordId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">{sourceLabel(user.source)}</Badge>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeLeft(user.muteExpiresAt)}
                              </span>
                            </div>
                            {user.reason && (
                              <p className="text-xs text-muted-foreground mt-0.5">{user.reason}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unmuteMutation.mutate(user.discordId)}
                          disabled={unmuteMutation.isPending}
                          className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                        >
                          <ShieldOff className="w-4 h-4 mr-1" /> Размутить
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TAB 2: PENDING MODERATION === */}
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Ожидают модерации</CardTitle>
                <CardDescription>Сообщения, помеченные ботом как нарушения</CardDescription>
              </CardHeader>
              <CardContent>
                {logLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : pendingMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Нет сообщений на модерации</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingMessages.map((msg) => (
                      <div key={msg.id} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{msg.authorUsername}</span>
                            <span className="text-xs text-muted-foreground">#{msg.channelName}</span>
                            {reasonBadge(msg.reason)}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</span>
                        </div>
                        <p className="text-sm bg-muted/50 p-2 rounded break-all">{msg.content}</p>
                        <p className="text-xs text-muted-foreground">{msg.reasonDetail}</p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteFlaggedMutation.mutate([msg.id])}
                            disabled={deleteFlaggedMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Удалить
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => approveFlaggedMutation.mutate([msg.id])}
                            disabled={approveFlaggedMutation.isPending}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Одобрить
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TAB 3: FULL LOG === */}
          <TabsContent value="log" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Лог модерации</CardTitle>
                    <CardDescription>Все нарушения, обнаруженные ботом</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/moderation-log"] })}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Обновить
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {logLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : allMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Лог пуст</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allMessages.map((msg) => (
                      <div key={msg.id} className="flex items-start justify-between p-3 rounded-lg border bg-card gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{msg.authorUsername}</span>
                            <span className="text-xs text-muted-foreground">#{msg.channelName}</span>
                            {reasonBadge(msg.reason)}
                            {statusBadge(msg.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">{msg.content}</p>
                          <p className="text-xs text-muted-foreground">{msg.reasonDetail}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(msg.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
