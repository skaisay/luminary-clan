import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessagesSquare, Trash2, Ban, Pin, Lock, Unlock, User2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/admin/MemberAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ForumTopic, ForumReply } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function AdminForumTab() {
  const { toast } = useToast();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [userToBan, setUserToBan] = useState<{ discordId: string; username: string } | null>(null);
  const [banDuration, setBanDuration] = useState<string>("permanent");

  const { data: topics, isLoading } = useQuery<ForumTopic[]>({
    queryKey: ["/api/forum/topics"],
  });

  const { data: authData } = useQuery<{
    authenticated: boolean;
    admin?: { id: number; username: string };
  }>({
    queryKey: ["/api/admin/check"],
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/forum/topics/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      toast({
        title: "Успешно",
        description: "Тема форума удалена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить тему",
        variant: "destructive",
      });
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: async ({ topicId, replyId }: { topicId: string; replyId: string }) => {
      return await apiRequest("DELETE", `/api/admin/forum/topics/${topicId}/replies/${replyId}`, {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics", variables.topicId, "replies"] });
      toast({
        title: "Успешно",
        description: "Ответ удален",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить ответ",
        variant: "destructive",
      });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/forum/topics/${id}/pin`, { isPinned: !isPinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      toast({
        title: "Успешно",
        description: "Статус закрепления обновлен",
      });
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async ({ id, isLocked }: { id: string; isLocked: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/forum/topics/${id}/lock`, { isLocked: !isLocked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      toast({
        title: "Успешно",
        description: "Статус блокировки обновлен",
      });
    },
  });

  const calculateBanExpiry = (duration: string): Date | null => {
    if (duration === "permanent") return null;
    
    const now = new Date();
    const durationMap: Record<string, number> = {
      "30s": 30 * 1000,
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    
    const milliseconds = durationMap[duration];
    if (!milliseconds) return null;
    
    return new Date(now.getTime() + milliseconds);
  };

  const quickBanMutation = useMutation({
    mutationFn: async ({ discordId, username, reason, duration }: { discordId: string; username: string; reason: string; duration: string }) => {
      const { insertSiteBanSchema } = await import("@shared/schema");
      const expiresAt = calculateBanExpiry(duration);
      const banData = insertSiteBanSchema.parse({
        discordId,
        username,
        reason,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        bannedBy: authData?.admin?.id || "unknown",
        bannedByUsername: authData?.admin?.username || "Admin",
      });
      return await apiRequest("POST", "/api/admin/site-bans", banData);
    },
    onSuccess: () => {
      toast({
        title: "Успешно!",
        description: "Пользователь забанен",
      });
      setBanDialogOpen(false);
      setUserToBan(null);
      setBanDuration("permanent");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось забанить пользователя",
        variant: "destructive",
      });
    },
  });

  const sortedTopics = topics
    ? [...topics].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  return (
    <div className="space-y-6">
      <Card className="glass glass-border neon-glow-cyan">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 glass rounded-lg neon-glow-purple">
                <MessagesSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl neon-text-cyan">Управление Форумом</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Модерация тем и ответов форума
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Всего тем</p>
                <p className="text-2xl font-bold text-primary">{topics?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass glass-border">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedTopics.length > 0 ? (
        <Accordion type="single" collapsible className="space-y-4">
          {sortedTopics.map((topic) => (
            <TopicItem
              key={topic.id}
              topic={topic}
              onDeleteTopic={() => deleteTopicMutation.mutate(topic.id)}
              onDeleteReply={(replyId) => deleteReplyMutation.mutate({ topicId: topic.id, replyId })}
              onTogglePin={() => togglePinMutation.mutate({ id: topic.id, isPinned: topic.isPinned })}
              onToggleLock={() => toggleLockMutation.mutate({ id: topic.id, isLocked: topic.isLocked })}
              onBanUser={(discordId, username) => {
                setUserToBan({ discordId, username });
                setBanDialogOpen(true);
              }}
              isPending={deleteTopicMutation.isPending || togglePinMutation.isPending || toggleLockMutation.isPending}
            />
          ))}
        </Accordion>
      ) : (
        <Card className="glass glass-border">
          <CardContent className="py-12">
            <div className="text-center">
              <MessagesSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">Нет Тем</h3>
              <p className="text-muted-foreground">Пока что на форуме нет ни одной темы</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="glass glass-border">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Забанить пользователя
            </DialogTitle>
            <DialogDescription>
              Вы собираетесь забанить пользователя {userToBan?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="glass glass-border rounded-lg p-4">
              <p className="text-sm"><strong>Пользователь:</strong> {userToBan?.username}</p>
              <p className="text-sm"><strong>Discord ID:</strong> {userToBan?.discordId}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ban-duration-forum">Длительность бана</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger id="ban-duration-forum" data-testid="select-ban-duration-forum">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30s">30 секунд</SelectItem>
                  <SelectItem value="1m">1 минута</SelectItem>
                  <SelectItem value="5m">5 минут</SelectItem>
                  <SelectItem value="30m">30 минут</SelectItem>
                  <SelectItem value="1h">1 час</SelectItem>
                  <SelectItem value="1d">1 день</SelectItem>
                  <SelectItem value="7d">7 дней</SelectItem>
                  <SelectItem value="30d">30 дней</SelectItem>
                  <SelectItem value="permanent">Постоянный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {banDuration === "permanent" 
                ? "Пользователь будет заблокирован навсегда и не сможет войти на сайт."
                : "Пользователь будет временно заблокирован и не сможет войти на сайт до истечения срока бана."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBanDialogOpen(false);
                setUserToBan(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (userToBan) {
                  quickBanMutation.mutate({
                    discordId: userToBan.discordId,
                    username: userToBan.username,
                    reason: `Забанен через админ-панель (Форум)`,
                    duration: banDuration,
                  });
                }
              }}
              disabled={quickBanMutation.isPending}
              data-testid="button-confirm-ban-forum"
            >
              {quickBanMutation.isPending ? "Бан..." : "Забанить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TopicItem({
  topic,
  onDeleteTopic,
  onDeleteReply,
  onTogglePin,
  onToggleLock,
  onBanUser,
  isPending,
}: {
  topic: ForumTopic;
  onDeleteTopic: () => void;
  onDeleteReply: (replyId: string) => void;
  onTogglePin: () => void;
  onToggleLock: () => void;
  onBanUser: (discordId: string, username: string) => void;
  isPending: boolean;
}) {
  const { data: replies } = useQuery<ForumReply[]>({
    queryKey: ["/api/forum/topics", topic.id, "replies"],
  });

  return (
    <AccordionItem value={topic.id} className="glass glass-border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <MemberAvatar 
            discordId={topic.authorDiscordId}
            fallbackUsername={topic.authorUsername}
            size="md"
          />
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold">{topic.title}</h3>
              {topic.isPinned && (
                <Badge variant="secondary" className="gap-1">
                  <Pin className="h-3 w-3" />
                  Закреплено
                </Badge>
              )}
              {topic.isLocked && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Закрыто
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {topic.authorUsername} • {new Date(topic.createdAt).toLocaleDateString("ru-RU")} •{" "}
              {replies?.length || 0} ответов
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-4">
          <div className="glass glass-border rounded-lg p-4">
            <p className="text-sm leading-relaxed">{topic.content}</p>
            {topic.authorDiscordId && (
              <p className="text-xs text-muted-foreground mt-2">Discord ID: {topic.authorDiscordId}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTogglePin}
              disabled={isPending}
              data-testid={`button-pin-topic-${topic.id}`}
            >
              <Pin className="h-4 w-4 mr-2" />
              {topic.isPinned ? "Открепить" : "Закрепить"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleLock}
              disabled={isPending}
              data-testid={`button-lock-topic-${topic.id}`}
            >
              {topic.isLocked ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              {topic.isLocked ? "Разблокировать" : "Заблокировать"}
            </Button>
            {topic.authorDiscordId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBanUser(topic.authorDiscordId!, topic.authorUsername)}
                data-testid={`button-ban-author-${topic.id}`}
              >
                <Ban className="h-4 w-4 mr-2" />
                Забанить автора
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteTopic}
              disabled={isPending}
              data-testid={`button-delete-topic-${topic.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить тему
            </Button>
          </div>

          {replies && replies.length > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm font-semibold text-muted-foreground">Ответы:</h4>
              {replies.map((reply) => (
                <div key={reply.id} className="glass glass-border rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <MemberAvatar 
                      discordId={reply.authorDiscordId}
                      fallbackUsername={reply.authorUsername}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{reply.authorUsername}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(reply.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed">{reply.content}</p>
                      {reply.authorDiscordId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Discord ID: {reply.authorDiscordId}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {reply.authorDiscordId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onBanUser(reply.authorDiscordId!, reply.authorUsername)}
                          data-testid={`button-ban-reply-${reply.id}`}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteReply(reply.id)}
                        data-testid={`button-delete-reply-${reply.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
