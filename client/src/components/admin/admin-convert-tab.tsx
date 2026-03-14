import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Coins, Settings, Clock, CheckCircle, XCircle, Send, User2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RobuxConversionSettings, RobuxConversionRequest } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminConvertTab() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<RobuxConversionRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState<"approved" | "rejected">("approved");
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editedSettings, setEditedSettings] = useState<Partial<RobuxConversionSettings>>({});

  const { data: settings, isLoading: settingsLoading } = useQuery<RobuxConversionSettings>({
    queryKey: ["/api/robux/settings"],
  });

  const { data: requests, isLoading: requestsLoading } = useQuery<RobuxConversionRequest[]>({
    queryKey: ["/api/admin/robux/requests"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<RobuxConversionSettings>) => {
      return await apiRequest("PATCH", "/api/admin/robux/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/robux/settings"] });
      toast({
        title: "Успешно!",
        description: "Настройки конвертации обновлены",
      });
      setSettingsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройки",
        variant: "destructive",
      });
    },
  });

  const processRequestMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNote,
    }: {
      id: string;
      status: "approved" | "rejected" | "completed";
      adminNote?: string;
    }) => {
      return await apiRequest("PATCH", `/api/admin/robux/requests/${id}`, {
        status,
        adminNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/robux/requests"] });
      toast({
        title: "Успешно!",
        description: "Запрос обработан",
      });
      setSelectedRequest(null);
      setAdminNote("");
      setNewStatus("approved");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обработать запрос",
        variant: "destructive",
      });
    },
  });

  const handleOpenSettings = () => {
    if (settings) {
      setEditedSettings({
        exchangeRate: settings.exchangeRate,
        minAmount: settings.minAmount,
        maxAmount: settings.maxAmount,
        isEnabled: settings.isEnabled,
      });
    }
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(editedSettings);
  };

  const handleProcessRequest = () => {
    if (!selectedRequest) return;
    processRequestMutation.mutate({
      id: selectedRequest.id,
      status: newStatus,
      adminNote: adminNote || undefined,
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
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-blue-500">
            <CheckCircle className="h-3 w-3" />
            Завершено
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (settingsLoading || requestsLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Настройки конвертации
              </CardTitle>
              <CardDescription>
                Управление курсом обмена LumiCoin на Robux
              </CardDescription>
            </div>
            <Button
              onClick={handleOpenSettings}
              variant="default"
              className="gap-2"
              data-testid="button-edit-settings"
            >
              <Settings className="h-4 w-4" />
              Изменить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {settings && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="glass-card p-4 rounded-lg border border-primary/20">
                <div className="text-sm text-muted-foreground">Курс обмена</div>
                <div className="text-2xl font-bold text-primary mt-1">
                  {settings.exchangeRate.toLocaleString()} LC = 1 R$
                </div>
              </div>
              <div className="glass-card p-4 rounded-lg border border-green-500/20">
                <div className="text-sm text-muted-foreground">Минимум</div>
                <div className="text-2xl font-bold text-green-500 mt-1">
                  {settings.minAmount.toLocaleString()} LC
                </div>
              </div>
              <div className="glass-card p-4 rounded-lg border border-orange-500/20">
                <div className="text-sm text-muted-foreground">Максимум</div>
                <div className="text-2xl font-bold text-orange-500 mt-1">
                  {settings.maxAmount.toLocaleString()} LC
                </div>
              </div>
              <div className="glass-card p-4 rounded-lg border border-cyan-500/20">
                <div className="text-sm text-muted-foreground">Статус</div>
                <div className="text-2xl font-bold mt-1">
                  {settings.isEnabled ? (
                    <span className="text-cyan-500">Активно</span>
                  ) : (
                    <span className="text-red-500">Отключено</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Запросы на конвертацию ({requests?.length || 0})
          </CardTitle>
          <CardDescription>
            Обработка запросов пользователей на конвертацию LumiCoin в Robux
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests && requests.length > 0 ? (
              requests.map((request) => (
                <Card
                  key={request.id}
                  className="glass-card border-primary/10 hover-elevate"
                  data-testid={`card-request-${request.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <User2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Discord ID: {request.discordId}</span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Roblox: <span className="font-medium text-foreground">{request.robloxUsername}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Сумма: </span>
                            <span className="font-bold text-primary">{request.lumiCoinAmount.toLocaleString()} LC</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Получит: </span>
                            <span className="font-bold text-green-500">{request.robuxAmount} R$</span>
                          </div>
                        </div>
                        {request.adminNote && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Ответ админа: </span>
                            <span className="text-foreground">{request.adminNote}</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      {request.status === "pending" && (
                        <Button
                          onClick={() => {
                            setSelectedRequest(request);
                            setNewStatus("approved");
                            setAdminNote("");
                          }}
                          variant="default"
                          size="sm"
                          className="gap-2"
                          data-testid={`button-process-${request.id}`}
                        >
                          <Send className="h-4 w-4" />
                          Обработать
                        </Button>
                      )}
                      {request.status === "approved" && (
                        <Button
                          onClick={() => {
                            processRequestMutation.mutate({
                              id: request.id,
                              status: "completed",
                            });
                          }}
                          variant="default"
                          size="sm"
                          className="gap-2 bg-blue-500 hover:bg-blue-600"
                          data-testid={`button-complete-${request.id}`}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Завершить
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Нет запросов на конвертацию</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="glass-card" data-testid="dialog-edit-settings">
          <DialogHeader>
            <DialogTitle>Настройки конвертации</DialogTitle>
            <DialogDescription>
              Измените параметры системы конвертации LumiCoin в Robux
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exchangeRate">Курс обмена (LC за 1 Robux)</Label>
              <Input
                id="exchangeRate"
                type="number"
                value={editedSettings.exchangeRate || 0}
                onChange={(e) =>
                  setEditedSettings({
                    ...editedSettings,
                    exchangeRate: parseInt(e.target.value),
                  })
                }
                placeholder="10000"
                data-testid="input-exchange-rate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minAmount">Минимальная сумма (LC)</Label>
              <Input
                id="minAmount"
                type="number"
                value={editedSettings.minAmount || 0}
                onChange={(e) =>
                  setEditedSettings({
                    ...editedSettings,
                    minAmount: parseInt(e.target.value),
                  })
                }
                placeholder="10000"
                data-testid="input-min-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxAmount">Максимальная сумма (LC)</Label>
              <Input
                id="maxAmount"
                type="number"
                value={editedSettings.maxAmount || 0}
                onChange={(e) =>
                  setEditedSettings({
                    ...editedSettings,
                    maxAmount: parseInt(e.target.value),
                  })
                }
                placeholder="100000"
                data-testid="input-max-amount"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={editedSettings.isEnabled || false}
                onCheckedChange={(checked) =>
                  setEditedSettings({
                    ...editedSettings,
                    isEnabled: checked,
                  })
                }
                data-testid="switch-enabled"
              />
              <Label htmlFor="enabled">Конвертация активна</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettingsDialogOpen(false)}
              data-testid="button-cancel-settings"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateSettingsMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="glass-card" data-testid="dialog-process-request">
          <DialogHeader>
            <DialogTitle>Обработка запроса</DialogTitle>
            <DialogDescription>
              Одобрите или отклоните запрос на конвертацию
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="glass-card p-4 rounded-lg space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Discord ID: </span>
                  <span className="font-medium">{selectedRequest.discordId}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Roblox: </span>
                  <span className="font-medium">{selectedRequest.robloxUsername}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Сумма: </span>
                  <span className="font-bold text-primary">{selectedRequest.lumiCoinAmount.toLocaleString()} LC</span>
                  {" → "}
                  <span className="font-bold text-green-500">{selectedRequest.robuxAmount} R$</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Действие</Label>
                <Select value={newStatus} onValueChange={(value: any) => setNewStatus(value)}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Одобрить</SelectItem>
                    <SelectItem value="rejected">Отклонить</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNote">Заметка (необязательно)</Label>
                <Textarea
                  id="adminNote"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Добавьте заметку для пользователя..."
                  rows={3}
                  data-testid="textarea-admin-note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              data-testid="button-cancel-process"
            >
              Отмена
            </Button>
            <Button
              onClick={handleProcessRequest}
              disabled={processRequestMutation.isPending}
              data-testid="button-submit-process"
            >
              {processRequestMutation.isPending ? "Обработка..." : "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
