import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Hash, Users as UsersIcon, UserX, Ban, Shield, Plus, Trash2, Search, CheckCircle, XCircle, AlertTriangle, RefreshCw, Volume2, MessageSquare, Eye, Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface DiscordChannel {
  id: string;
  name: string;
  type: number | string;
  parentId?: string | null;
  parentName?: string | null;
}

interface DiscordMember {
  id: string;
  username: string;
  avatar: string;
  roles: string[];
}

interface ChannelRule {
  id: string;
  channelId: string;
  channelName: string;
  channelType: string;
  languageRestriction: string | null;
  blockProfanity: boolean;
  blockDiscrimination: boolean;
  autoDelete: boolean;
  commandsOnly: boolean;
  isActive: boolean;
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
  createdAt: string;
}

export default function AdminDiscordTab() {
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [message, setMessage] = useState("");

  // Channel creation state
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const [newChannelCategory, setNewChannelCategory] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");

  // Rule setup state
  const [ruleChannelId, setRuleChannelId] = useState("");
  const [ruleLang, setRuleLang] = useState<string>("none");
  const [ruleProfanity, setRuleProfanity] = useState(false);
  const [ruleDiscrimination, setRuleDiscrimination] = useState(false);
  const [ruleAutoDelete, setRuleAutoDelete] = useState(false);
  const [ruleCommandsOnly, setRuleCommandsOnly] = useState(false);

  // Flagged message selection
  const [selectedFlagged, setSelectedFlagged] = useState<Set<string>>(new Set());

  const { data: channels, isLoading: channelsLoading, error: channelsError } = useQuery<DiscordChannel[]>({
    queryKey: ["/api/admin/discord/channels"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/channels", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
  });

  const { data: channelsDetailed } = useQuery<{ channels: DiscordChannel[]; categories: { id: string; name: string }[] }>({
    queryKey: ["/api/admin/discord/channels-detailed"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/channels-detailed", { credentials: "include" });
        if (!res.ok) return { channels: [], categories: [] };
        return await res.json();
      } catch { return { channels: [], categories: [] }; }
    },
  });

  const { data: members, isLoading: membersLoading } = useQuery<DiscordMember[]>({
    queryKey: ["/api/admin/discord/members"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/members", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
  });

  const { data: channelRules, isLoading: rulesLoading } = useQuery<ChannelRule[]>({
    queryKey: ["/api/admin/discord/channel-rules"],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/channel-rules", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
  });

  const { data: flaggedMessages, isLoading: flaggedLoading } = useQuery<FlaggedMessage[]>({
    queryKey: ["/api/admin/discord/flagged-messages"],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/flagged-messages", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
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
      toast({ title: "Ошибка отправки", description: error.message, variant: "destructive" });
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
      toast({ title: "Ошибка исключения", description: error.message, variant: "destructive" });
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
      toast({ title: "Ошибка бана", description: error.message, variant: "destructive" });
    },
  });

  // Channel creation
  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; category?: string; topic?: string }) => {
      const res = await apiRequest("POST", "/api/admin/discord/create-channel", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Канал #${data.name} создан!` });
      setNewChannelName("");
      setNewChannelTopic("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/channels-detailed"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка создания канала", description: error.message, variant: "destructive" });
    },
  });

  // Channel deletion
  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const res = await apiRequest("POST", "/api/admin/discord/delete-channel", { channelId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Канал удалён" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/channels-detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/channel-rules"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка удаления канала", description: error.message, variant: "destructive" });
    },
  });

  // Channel rule
  const saveRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/discord/channel-rules", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Правило модерации сохранено!" });
      setRuleChannelId("");
      setRuleLang("none");
      setRuleProfanity(false);
      setRuleDiscrimination(false);
      setRuleAutoDelete(false);
      setRuleCommandsOnly(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/channel-rules"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка сохранения правила", description: error.message, variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`/api/admin/discord/channel-rules/${ruleId}`, { method: "DELETE", credentials: "include" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Правило удалено" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/channel-rules"] });
    },
  });

  // Scan channels
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/discord/scan-channels", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Сканирование завершено",
        description: `Проверено каналов: ${data.channelsScanned}, найдено нарушений: ${data.totalViolations}, новых: ${data.newFlagged}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/flagged-messages"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка сканирования", description: error.message, variant: "destructive" });
    },
  });

  // Delete flagged messages from Discord
  const deleteFlaggedMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      const res = await apiRequest("POST", "/api/admin/discord/delete-flagged", { messageIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Удалено: ${data.deleted}, не удалось: ${data.failed}` });
      setSelectedFlagged(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/flagged-messages"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
    },
  });

  // Approve (dismiss) flagged messages
  const approveFlaggedMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      const res = await apiRequest("POST", "/api/admin/discord/approve-flagged", { messageIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Одобрено: ${data.approved} ` });
      setSelectedFlagged(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/flagged-messages"] });
    },
  });

  const handleSendMessage = () => {
    if (!selectedChannel || !message) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    sendMessageMutation.mutate({ channelId: selectedChannel, message });
  };

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) {
      toast({ title: "Введите название канала", variant: "destructive" });
      return;
    }
    createChannelMutation.mutate({
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
      type: newChannelType,
      category: (newChannelCategory && newChannelCategory !== "__none__") ? newChannelCategory : undefined,
      topic: newChannelTopic || undefined,
    });
  };

  const handleSaveRule = () => {
    if (!ruleChannelId) {
      toast({ title: "Выберите канал", variant: "destructive" });
      return;
    }
    const ch = channels?.find(c => c.id === ruleChannelId) || channelsDetailed?.channels?.find(c => c.id === ruleChannelId);
    saveRuleMutation.mutate({
      channelId: ruleChannelId,
      channelName: ch?.name || "unknown",
      channelType: typeof ch?.type === 'number' ? (ch.type === 2 ? 'voice' : 'text') : (ch?.type || 'text'),
      languageRestriction: ruleLang === "none" ? null : ruleLang,
      blockProfanity: ruleProfanity,
      blockDiscrimination: ruleDiscrimination,
      autoDelete: ruleAutoDelete,
      commandsOnly: ruleCommandsOnly,
    });
  };

  const toggleFlaggedSelection = (id: string) => {
    setSelectedFlagged(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFlagged = () => {
    if (flaggedMessages) {
      setSelectedFlagged(new Set(flaggedMessages.map(m => m.id)));
    }
  };

  const reasonLabel = (reason: string) => {
    switch (reason) {
      case "wrong_language": return "Не тот язык";
      case "profanity": return "Мат";
      case "discrimination": return "Дискриминация";
      default: return reason;
    }
  };

  const reasonColor = (reason: string) => {
    switch (reason) {
      case "discrimination": return "destructive";
      case "profanity": return "secondary";
      case "wrong_language": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold neon-text-cyan mb-2">Управление Discord Сервером</h2>
        <p className="text-muted-foreground">
          Каналы, модерация, правила и участники вашего Discord сервера
        </p>
      </div>

      <Tabs defaultValue="channel-manage" className="w-full">
        <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1.5">
          <TabsTrigger value="channel-manage" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Создать канал
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Shield className="w-4 h-4" />
            Правила
          </TabsTrigger>
          <TabsTrigger value="moderation" className="gap-1.5">
            <Search className="w-4 h-4" />
            Модерация
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <Send className="w-4 h-4" />
            Сообщения
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5">
            <Hash className="w-4 h-4" />
            Каналы
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <UsersIcon className="w-4 h-4" />
            Участники
          </TabsTrigger>
        </TabsList>

        {/* ============ CREATE CHANNEL TAB ============ */}
        <TabsContent value="channel-manage" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Создать новый канал
              </CardTitle>
              <CardDescription>
                Создайте текстовый или голосовой канал на сервере Discord. Бот автоматически будет
                модерировать каналы согласно правилам.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Название канала</Label>
                  <Input
                    placeholder="general-chat"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    data-testid="input-channel-name"
                  />
                </div>
                <div>
                  <Label>Тип канала</Label>
                  <Select value={newChannelType} onValueChange={(v) => setNewChannelType(v as "text" | "voice")}>
                    <SelectTrigger data-testid="select-channel-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">
                        <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Текстовый</span>
                      </SelectItem>
                      <SelectItem value="voice">
                        <span className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Голосовой</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Категория (необязательно)</Label>
                  <Select value={newChannelCategory} onValueChange={setNewChannelCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Без категории" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Без категории</SelectItem>
                      {channelsDetailed?.categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newChannelType === "text" && (
                  <div>
                    <Label>Описание канала</Label>
                    <Input
                      placeholder="Описание канала..."
                      value={newChannelTopic}
                      onChange={(e) => setNewChannelTopic(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateChannel}
                disabled={createChannelMutation.isPending || !newChannelName.trim()}
                className="w-full"
                data-testid="button-create-channel"
              >
                {createChannelMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Создание...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Создать канал</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ RULES TAB ============ */}
        <TabsContent value="rules" className="mt-6 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Настроить правила модерации
              </CardTitle>
              <CardDescription>
                Задайте правила для каналов: ограничение языка, блокировка мата и дискриминации.
                Бот будет автоматически проверять сообщения в реальном времени.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Канал</Label>
                {channelsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={ruleChannelId} onValueChange={setRuleChannelId}>
                    <SelectTrigger data-testid="select-rule-channel">
                      <SelectValue placeholder="Выберите канал" />
                    </SelectTrigger>
                    <SelectContent>
                      {(channelsDetailed?.channels || channels)?.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {(typeof channel.type === 'number' ? channel.type === 2 : channel.type === 'voice')
                            ? `🔊 ${channel.name}`
                            : `# ${channel.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label>Ограничение языка</Label>
                <Select value={ruleLang} onValueChange={setRuleLang}>
                  <SelectTrigger data-testid="select-rule-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без ограничения</SelectItem>
                    <SelectItem value="en">🇬🇧 Только English</SelectItem>
                    <SelectItem value="ru">🇷🇺 Только Русский</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Блокировка мата</Label>
                    <p className="text-xs text-muted-foreground">Обнаружение нецензурной лексики (RU/EN)</p>
                  </div>
                  <Switch checked={ruleProfanity} onCheckedChange={setRuleProfanity} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Блокировка дискриминации</Label>
                    <p className="text-xs text-muted-foreground">Расизм, нацизм, оскорбления по нац. признаку</p>
                  </div>
                  <Switch checked={ruleDiscrimination} onCheckedChange={setRuleDiscrimination} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Автоудаление</Label>
                    <p className="text-xs text-muted-foreground">Бот сам удаляет нарушения (иначе только помечает для вас)</p>
                  </div>
                  <Switch checked={ruleAutoDelete} onCheckedChange={setRuleAutoDelete} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Только команды</Label>
                    <p className="text-xs text-muted-foreground">Игроки не могут писать — только слеш-команды ботов. Обычные сообщения мгновенно удаляются.</p>
                  </div>
                  <Switch checked={ruleCommandsOnly} onCheckedChange={setRuleCommandsOnly} />
                </div>
              </div>

              <Button
                onClick={handleSaveRule}
                disabled={saveRuleMutation.isPending || !ruleChannelId}
                className="w-full"
                data-testid="button-save-rule"
              >
                {saveRuleMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Сохранение...</>
                ) : (
                  <><Shield className="w-4 h-4 mr-2" /> Сохранить правило</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Active rules list */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Активные правила</CardTitle>
              <CardDescription>Текущие правила модерации по каналам</CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : channelRules && channelRules.length > 0 ? (
                <div className="space-y-2">
                  {channelRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg glass glass-border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {rule.channelType === 'voice'
                            ? <Volume2 className="w-4 h-4 text-green-400" />
                            : <Hash className="w-4 h-4 text-blue-400" />}
                          <span className="font-medium">{rule.channelName}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rule.languageRestriction && (
                            <Badge variant="outline" className="text-xs">
                              {rule.languageRestriction === 'en' ? '🇬🇧 English only' : '🇷🇺 Русский only'}
                            </Badge>
                          )}
                          {rule.blockProfanity && (
                            <Badge variant="secondary" className="text-xs">🚫 Мат</Badge>
                          )}
                          {rule.blockDiscrimination && (
                            <Badge variant="destructive" className="text-xs">🚫 Дискриминация</Badge>
                          )}
                          {rule.autoDelete && (
                            <Badge className="text-xs bg-red-600">⚡ Автоудаление</Badge>
                          )}
                          {rule.commandsOnly && (
                            <Badge className="text-xs bg-purple-600">🔒 Только команды</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Удалить правило для #${rule.channelName}?`)) {
                            deleteRuleMutation.mutate(rule.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Нет активных правил. Создайте правило выше.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ MODERATION TAB ============ */}
        <TabsContent value="moderation" className="mt-6 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Сканер сообщений
              </CardTitle>
              <CardDescription>
                Сканирует все каналы с правилами на наличие нарушений. Найденные сообщения можно удалить одной кнопкой.
                Сканирование с задержками — бот не будет забанен.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-scan-channels"
              >
                {scanMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Сканирование... (может занять 30 сек)</>
                ) : (
                  <><Search className="w-5 h-5 mr-2" /> Сканировать все каналы</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Найденные нарушения
                    {flaggedMessages && flaggedMessages.length > 0 && (
                      <Badge variant="destructive">{flaggedMessages.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Сообщения, нарушающие правила каналов. Выберите и удалите.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/flagged-messages"] })}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {flaggedLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : flaggedMessages && flaggedMessages.length > 0 ? (
                <div className="space-y-3">
                  {/* Action bar */}
                  <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg glass glass-border">
                    <Button size="sm" variant="outline" onClick={selectAllFlagged}>
                      <Eye className="w-4 h-4 mr-1" /> Выбрать все ({flaggedMessages.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={selectedFlagged.size === 0 || deleteFlaggedMutation.isPending}
                      onClick={() => deleteFlaggedMutation.mutate(Array.from(selectedFlagged))}
                    >
                      {deleteFlaggedMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Удаление...</>
                      ) : (
                        <><Trash2 className="w-4 h-4 mr-1" /> Удалить выбранные ({selectedFlagged.size})</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedFlagged.size === 0 || approveFlaggedMutation.isPending}
                      onClick={() => approveFlaggedMutation.mutate(Array.from(selectedFlagged))}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Одобрить
                    </Button>
                    {selectedFlagged.size > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setSelectedFlagged(new Set())}>
                        <XCircle className="w-4 h-4 mr-1" /> Сбросить
                      </Button>
                    )}
                  </div>

                  {/* Messages list */}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {flaggedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => toggleFlaggedSelection(msg.id)}
                        className={`cursor-pointer p-3 rounded-lg glass glass-border transition-colors ${
                          selectedFlagged.has(msg.id) ? "ring-2 ring-red-500 bg-red-500/10" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedFlagged.has(msg.id)}
                            onChange={() => toggleFlaggedSelection(msg.id)}
                            className="mt-1 accent-red-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm">{msg.authorUsername}</span>
                              <span className="text-xs text-muted-foreground">в #{msg.channelName}</span>
                              <Badge variant={reasonColor(msg.reason) as any} className="text-xs">
                                {reasonLabel(msg.reason)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground break-words">
                              {msg.content.length > 200 ? msg.content.substring(0, 200) + "..." : msg.content}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">{msg.reasonDetail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  ✅ Нет нарушений. Нажмите «Сканировать» чтобы проверить каналы.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ MESSAGES TAB ============ */}
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
                      {channels?.filter(c => c.type === 0 || c.type === 'text').map((channel) => (
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

        {/* ============ CHANNELS TAB ============ */}
        <TabsContent value="channels" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Каналы сервера</CardTitle>
              <CardDescription>
                Все каналы Discord сервера. Можно удалить ненужные.
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
                  {(channelsDetailed?.channels || channels)?.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center gap-3 p-3 rounded-lg glass glass-border"
                    >
                      {(typeof channel.type === 'number' ? channel.type === 2 : channel.type === 'voice')
                        ? <Volume2 className="w-5 h-5 text-green-400" />
                        : <Hash className="w-5 h-5 text-muted-foreground" />}
                      <div className="flex-1">
                        <span className="font-medium">{channel.name}</span>
                        {channel.parentName && (
                          <span className="text-xs text-muted-foreground ml-2">({channel.parentName})</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {(typeof channel.type === 'number' ? channel.type === 2 : channel.type === 'voice') ? "Голосовой" : "Текстовый"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => {
                          if (confirm(`Удалить канал #${channel.name}? Это действие нельзя отменить!`)) {
                            deleteChannelMutation.mutate(channel.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ MEMBERS TAB ============ */}
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
