import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Server, Plus, RefreshCw, Power, PowerOff, Trash2, Users, Clock, Globe, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConnectedServer {
  id: string;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  ownerDiscordId: string;
  ownerUsername: string;
  memberCount: number;
  isActive: boolean;
  isPrimary: boolean;
  connectedAt: string;
  lastSyncAt: string | null;
}

export default function AdminServersTab() {
  const { toast } = useToast();
  const [botToken, setBotToken] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: servers, isLoading } = useQuery<ConnectedServer[]>({
    queryKey: ["/api/admin/servers"],
  });

  const connectMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/admin/servers/connect", { botToken: token });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Сервер подключён!" });
      setBotToken("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка подключения",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("POST", `/api/admin/servers/${serverId}/disconnect`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Сервер отключён" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("POST", `/api/admin/servers/${serverId}/activate`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Сервер активирован" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/servers/${serverId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Сервер удалён" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("POST", `/api/admin/servers/${serverId}/sync`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Синхронизация завершена" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/servers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка синхронизации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                Подключённые серверы
              </CardTitle>
              <CardDescription>
                Платформа для управления несколькими Discord серверами. Каждый сервер имеет изолированные данные.
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Подключить сервер
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-cyan-500/20">
                <DialogHeader>
                  <DialogTitle>Подключить Discord сервер</DialogTitle>
                  <DialogDescription>
                    Вставьте токен бота, который добавлен на нужный Discord сервер. 
                    Бот должен иметь права на чтение участников.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Токен бота</Label>
                    <Input
                      type="password"
                      placeholder="MTQyMzA0MDg1NjEz..."
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Токен можно получить на{" "}
                      <a
                        href="https://discord.com/developers/applications"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline"
                      >
                        Discord Developer Portal
                      </a>
                    </p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-sm text-amber-200">
                      ⚠️ Убедитесь, что бот добавлен на сервер и имеет права: 
                      Server Members Intent, Read Messages, View Channels
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!botToken || connectMutation.isPending}
                    onClick={() => connectMutation.mutate(botToken)}
                  >
                    {connectMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Проверка токена...
                      </>
                    ) : (
                      <>
                        <Server className="w-4 h-4 mr-2" />
                        Подключить
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : !servers || servers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Нет подключённых серверов</p>
              <p className="text-sm mt-1">Нажмите «Подключить сервер» чтобы начать</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    server.isActive
                      ? "border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10"
                      : "border-gray-500/20 bg-gray-500/5 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {server.guildIcon ? (
                      <img
                        src={server.guildIcon}
                        alt={server.guildName}
                        className="w-12 h-12 rounded-full border-2 border-cyan-500/30"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Server className="w-6 h-6 text-cyan-400" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{server.guildName}</span>
                        {server.isPrimary && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">
                            Основной
                          </Badge>
                        )}
                        <Badge
                          variant={server.isActive ? "default" : "secondary"}
                          className={server.isActive ? "bg-green-500/20 text-green-400" : ""}
                        >
                          {server.isActive ? "Активен" : "Отключён"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {server.memberCount} участников
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {server.lastSyncAt
                            ? `Синхр. ${new Date(server.lastSyncAt).toLocaleDateString("ru")}`
                            : "Не синхронизирован"}
                        </span>
                        <span className="text-xs opacity-60">
                          ID: {server.guildId}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={syncMutation.isPending}
                      onClick={() => syncMutation.mutate(server.id)}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      Синхр.
                    </Button>
                    {server.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-amber-400 hover:text-amber-300"
                        onClick={() => disconnectMutation.mutate(server.id)}
                      >
                        <PowerOff className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-green-400 hover:text-green-300"
                        onClick={() => activateMutation.mutate(server.id)}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-red-400 hover:text-red-300"
                      onClick={() => {
                        if (confirm(`Удалить сервер "${server.guildName}" навсегда?`)) {
                          deleteMutation.mutate(server.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card about how multi-server works */}
      <Card className="glass-card border-cyan-500/10">
        <CardHeader>
          <CardTitle className="text-base">Как работает платформа?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-cyan-400">1.</strong> Создайте бота на{" "}
            <a href="https://discord.com/developers/applications" target="_blank" className="text-cyan-400 hover:underline">
              Discord Developer Portal
            </a>{" "}
            и добавьте его на свой сервер.
          </p>
          <p>
            <strong className="text-cyan-400">2.</strong> Вставьте токен бота — система автоматически определит сервер и синхронизирует участников.
          </p>
          <p>
            <strong className="text-cyan-400">3.</strong> Данные каждого сервера (участники, монеты, статистика) полностью изолированы.
          </p>
          <p>
            <strong className="text-cyan-400">4.</strong> Используйте кнопку «Синхр.» для обновления списка участников с Discord.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
