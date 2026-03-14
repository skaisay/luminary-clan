import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Hash, Users as UsersIcon, UserX, Ban, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordMember {
  id: string;
  username: string;
  avatar: string;
  roles: string[];
}

export default function AdminDiscordTab() {
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [message, setMessage] = useState("");

  const { data: channels, isLoading: channelsLoading } = useQuery<DiscordChannel[]>({
    queryKey: ["/api/admin/discord/channels"],
  });

  const { data: members, isLoading: membersLoading } = useQuery<DiscordMember[]>({
    queryKey: ["/api/admin/discord/members"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { channelId: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/discord/send-message", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Сообщение отправлено в Discord!" });
      setMessage("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Ошибка отправки", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const kickMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", "/api/admin/discord/kick", { userId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Участник исключен с сервера" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/members"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Ошибка исключения", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const banMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", "/api/admin/discord/ban", { userId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Участник забанен" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/members"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Ошибка бана", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleSendMessage = () => {
    if (!selectedChannel || !message) {
      toast({ 
        title: "Заполните все поля", 
        variant: "destructive"
      });
      return;
    }
    sendMessageMutation.mutate({ channelId: selectedChannel, message });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text-cyan mb-2">Управление Discord Сервером</h2>
        <p className="text-muted-foreground">
          Полный контроль над вашим Discord сервером через панель управления
        </p>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="messages">
            <Send className="w-4 h-4 mr-2" />
            Сообщения
          </TabsTrigger>
          <TabsTrigger value="channels">
            <Hash className="w-4 h-4 mr-2" />
            Каналы
          </TabsTrigger>
          <TabsTrigger value="members">
            <UsersIcon className="w-4 h-4 mr-2" />
            Участники
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Отправить объявление</CardTitle>
              <CardDescription>
                Отправьте сообщение в любой текстовый канал вашего Discord сервера
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="channel">Канал</Label>
                {channelsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                    <SelectTrigger data-testid="select-channel">
                      <SelectValue placeholder="Выберите канал" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels?.filter(c => c.type === 0).map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          #{channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="message">Сообщение</Label>
                <Textarea
                  id="message"
                  placeholder="Введите ваше сообщение..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-32"
                  data-testid="input-message"
                />
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending}
                className="w-full"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendMessageMutation.isPending ? "Отправка..." : "Отправить"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Каналы сервера</CardTitle>
              <CardDescription>
                Список всех каналов на вашем Discord сервере
              </CardDescription>
            </CardHeader>
            <CardContent>
              {channelsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {channels?.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center gap-3 p-3 rounded-lg glass glass-border"
                    >
                      <Hash className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{channel.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {channel.type === 0 ? "Текстовый" : channel.type === 2 ? "Голосовой" : "Другой"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Участники сервера</CardTitle>
              <CardDescription>
                Управление участниками Discord сервера
              </CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {members?.slice(0, 50).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-lg glass glass-border"
                    >
                      <img
                        src={member.avatar}
                        alt={member.username}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{member.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.roles.length} ролей
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Исключить ${member.username} с сервера?`)) {
                              kickMemberMutation.mutate(member.id);
                            }
                          }}
                          data-testid={`button-kick-${member.id}`}
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Забанить ${member.username}?`)) {
                              banMemberMutation.mutate(member.id);
                            }
                          }}
                          data-testid={`button-ban-${member.id}`}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      </div>
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
