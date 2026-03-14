import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquarePlus, Clock, CheckCircle, XCircle, Send, Trash2, User2, Ban } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Request } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminRequestsTab() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [userToBan, setUserToBan] = useState<{ discordId: string; username: string } | null>(null);
  const [banDuration, setBanDuration] = useState<string>("permanent");

  const { data: requests, isLoading } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
  });

  const { data: authData } = useQuery<{
    authenticated: boolean;
    admin?: { id: number; username: string };
  }>({
    queryKey: ["/api/admin/check"],
  });

  const respondMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminResponse,
    }: {
      id: string;
      status: string;
      adminResponse: string;
    }) => {
      return await apiRequest("PATCH", `/api/requests/${id}/respond`, {
        status,
        adminResponse,
        respondedBy: authData?.admin?.username || "Admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Успешно!",
        description: "Ответ отправлен пользователю",
      });
      setSelectedRequest(null);
      setResponse("");
      setNewStatus("approved");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить ответ",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/requests/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Успешно",
        description: "Запрос удален",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить запрос",
        variant: "destructive",
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

  const handleRespond = () => {
    if (!selectedRequest) return;
    respondMutation.mutate({
      id: selectedRequest.id,
      status: newStatus,
      adminResponse: response,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Ожидает
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Одобрено
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Отклонено
          </Badge>
        );
      default:
        return null;
    }
  };

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const processedRequests = requests?.filter((r) => r.status !== "pending") || [];

  return (
    <div className="space-y-6">
      <Card className="glass glass-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="neon-text-cyan flex items-center gap-2">
                <MessageSquarePlus className="h-6 w-6" />
                Управление Запросами
              </CardTitle>
              <CardDescription>
                Просматривайте и отвечайте на запросы участников клана
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Ожидает ответа</p>
                <p className="text-2xl font-bold text-primary">{pendingRequests.length}</p>
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
      ) : (
        <>
          {pendingRequests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold neon-text-cyan">Новые Запросы</h3>
              {pendingRequests.map((request) => (
                <Card key={request.id} className="glass glass-border neon-glow-purple">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <MemberAvatar 
                          discordId={request.discordId} 
                          fallbackUsername={request.username}
                          size="md"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-xl">{request.username}</CardTitle>
                            <Badge variant="secondary">{request.requestType}</Badge>
                          </div>
                          {request.discordId && (
                            <p className="text-xs text-muted-foreground">
                              Discord ID: {request.discordId}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.createdAt).toLocaleDateString("ru-RU", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground">
                        Сообщение:
                      </h4>
                      <p className="text-sm leading-relaxed">{request.content}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setSelectedRequest(request)}
                        className="neon-glow-cyan flex-1"
                        data-testid={`button-respond-${request.id}`}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Ответить
                      </Button>
                      {request.discordId && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setUserToBan({ discordId: request.discordId!, username: request.username });
                            setBanDialogOpen(true);
                          }}
                          data-testid={`button-ban-${request.id}`}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(request.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${request.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {processedRequests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-muted-foreground">
                Обработанные Запросы
              </h3>
              {processedRequests.map((request) => (
                <Card key={request.id} className="glass glass-border opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User2 className="h-5 w-5 text-primary" />
                          <CardTitle className="text-xl">{request.username}</CardTitle>
                          <Badge variant="secondary">{request.requestType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString("ru-RU", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground">
                        Запрос:
                      </h4>
                      <p className="text-sm leading-relaxed">{request.content}</p>
                    </div>
                    {request.adminResponse && (
                      <div className="glass rounded-lg p-4 border border-primary/20">
                        <h4 className="font-semibold mb-2 text-sm neon-text-cyan flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Ваш Ответ:
                        </h4>
                        <p className="text-sm leading-relaxed mb-2">{request.adminResponse}</p>
                        {request.respondedBy && (
                          <p className="text-xs text-muted-foreground">— {request.respondedBy}</p>
                        )}
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(request.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-processed-${request.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {requests && requests.length === 0 && (
            <Card className="glass glass-border">
              <CardContent className="py-12">
                <div className="text-center">
                  <MessageSquarePlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-xl font-bold mb-2">Нет Запросов</h3>
                  <p className="text-muted-foreground">
                    Пока что участники не отправили ни одного запроса
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="glass glass-border">
          <DialogHeader>
            <DialogTitle className="neon-text-cyan">Ответить на Запрос</DialogTitle>
            <DialogDescription>
              Запрос от {selectedRequest?.username}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="glass glass-border rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Тип: {selectedRequest.requestType}</p>
                <p className="text-sm leading-relaxed">{selectedRequest.content}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Статус</Label>
                <Select value={newStatus} onValueChange={(value: any) => setNewStatus(value)}>
                  <SelectTrigger data-testid="select-response-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Одобрить</SelectItem>
                    <SelectItem value="rejected">Отклонить</SelectItem>
                    <SelectItem value="pending">Оставить на рассмотрении</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="response">Ваш Ответ</Label>
                <Textarea
                  id="response"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Напишите ответ пользователю..."
                  className="min-h-32"
                  data-testid="textarea-admin-response"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              data-testid="button-cancel-response"
            >
              Отмена
            </Button>
            <Button
              onClick={handleRespond}
              disabled={respondMutation.isPending || !response.trim()}
              className="neon-glow-cyan"
              data-testid="button-send-response"
            >
              {respondMutation.isPending ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="ban-duration">Длительность бана</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger id="ban-duration" data-testid="select-ban-duration">
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
                    reason: `Забанен через админ-панель (Запросы)`,
                    duration: banDuration,
                  });
                }
              }}
              disabled={quickBanMutation.isPending}
              data-testid="button-confirm-ban"
            >
              {quickBanMutation.isPending ? "Бан..." : "Забанить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
