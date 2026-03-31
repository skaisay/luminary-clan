import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Hash, Users as UsersIcon, UserX, Ban, Shield, Plus, Trash2, Search, CheckCircle, XCircle, AlertTriangle, RefreshCw, Volume2, MessageSquare, Eye, Loader2, Zap, Bot, Edit, Power, Activity, Wifi, WifiOff, BarChart3, Megaphone, Brain, Crown, Copy } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

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
  const [newChannelRoleIds, setNewChannelRoleIds] = useState<string[]>([]);

  // Roles query
  const { data: roles } = useQuery<Array<{id: string; name: string; color: string; position: number; memberCount: number}>>({
    queryKey: ["/api/admin/discord/roles"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/roles", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
  });

  // Rule setup state
  const [ruleChannelId, setRuleChannelId] = useState("");
  const [ruleLang, setRuleLang] = useState<string>("none");
  const [ruleProfanity, setRuleProfanity] = useState(false);
  const [ruleDiscrimination, setRuleDiscrimination] = useState(false);
  const [ruleAutoDelete, setRuleAutoDelete] = useState(false);
  const [ruleCommandsOnly, setRuleCommandsOnly] = useState(false);

  // Flagged message selection
  const [selectedFlagged, setSelectedFlagged] = useState<Set<string>>(new Set());

  // Auto-response trigger state
  const [triggerWords, setTriggerWords] = useState("");
  const [triggerResponse, setTriggerResponse] = useState("");
  const [triggerType, setTriggerType] = useState<string>("link");
  const [triggerDescription, setTriggerDescription] = useState("");
  const [triggerCooldown, setTriggerCooldown] = useState("30");
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);

  // Soft-ban state
  const [softBanUserId, setSoftBanUserId] = useState("");
  const [softBanReason, setSoftBanReason] = useState("");
  const [softBanSearch, setSoftBanSearch] = useState("");

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

  // ── Auto-response triggers ──
  interface AutoResponse {
    id: string;
    triggerWords: string;
    response: string;
    responseType: string;
    description: string | null;
    isActive: boolean;
    cooldownMs: number;
    createdAt: string;
  }

  const { data: autoResponses, isLoading: autoResponsesLoading } = useQuery<AutoResponse[]>({
    queryKey: ["/api/admin/discord/auto-responses"],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/auto-responses", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
  });

  // ── AI Health Check ──
  interface AiProviderStatus {
    status: string;
    latencyMs: number;
    error?: string;
    chars?: number;
    tier?: string;
  }
  interface AiHealthData {
    summary: string;
    onlineCount: number;
    totalCount: number;
    keyedOnline?: number;
    hasGeminiKey?: boolean;
    hasGroqKey?: boolean;
    hasOpenRouterKey?: boolean;
    checkedAt: string;
    providers: Record<string, AiProviderStatus>;
  }

  const [aiHealthLoading, setAiHealthLoading] = useState(false);
  const [aiHealth, setAiHealth] = useState<AiHealthData | null>(null);

  const runAiHealthCheck = async () => {
    setAiHealthLoading(true);
    try {
      const res = await fetch("/api/admin/ai-health", { credentials: "include" });
      if (res.ok) {
        setAiHealth(await res.json());
      } else {
        toast({ title: "Ошибка проверки AI", variant: "destructive" });
      }
    } catch {
      toast({ title: "Не удалось проверить AI", variant: "destructive" });
    } finally {
      setAiHealthLoading(false);
    }
  };

  const createTriggerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/discord/auto-responses", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Триггер создан!" });
      setTriggerWords(""); setTriggerResponse(""); setTriggerDescription("");
      setTriggerType("link"); setTriggerCooldown("30"); setEditingTriggerId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/auto-responses"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка создания триггера", description: error.message, variant: "destructive" });
    },
  });

  const updateTriggerMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/admin/discord/auto-responses/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Триггер обновлён" });
      setTriggerWords(""); setTriggerResponse(""); setTriggerDescription("");
      setTriggerType("link"); setTriggerCooldown("30"); setEditingTriggerId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/auto-responses"] });
    },
  });

  const deleteTriggerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/discord/auto-responses/${id}`, { method: "DELETE", credentials: "include" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Триггер удалён" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/auto-responses"] });
    },
  });

  const toggleTriggerMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/discord/auto-responses/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/auto-responses"] });
    },
  });

  const handleSaveTrigger = () => {
    if (!triggerWords.trim() || !triggerResponse.trim()) {
      toast({ title: "Заполните ключевые слова и ответ", variant: "destructive" });
      return;
    }
    const payload = {
      triggerWords: triggerWords.trim(),
      response: triggerResponse.trim(),
      responseType: triggerType,
      description: triggerDescription.trim() || null,
      cooldownMs: Math.max(5000, parseInt(triggerCooldown) * 1000),
    };
    if (editingTriggerId) {
      updateTriggerMutation.mutate({ id: editingTriggerId, ...payload });
    } else {
      createTriggerMutation.mutate(payload);
    }
  };

  const startEditTrigger = (t: AutoResponse) => {
    setEditingTriggerId(t.id);
    setTriggerWords(t.triggerWords);
    setTriggerResponse(t.response);
    setTriggerType(t.responseType);
    setTriggerDescription(t.description || "");
    setTriggerCooldown(String(Math.round(t.cooldownMs / 1000)));
  };

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

  // ── Soft-ban (restrict) system ──
  const { data: softBanned, isLoading: softBannedLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/discord/soft-banned"],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/soft-banned", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
  });

  const softBanMutation = useMutation({
    mutationFn: async (data: { userId: string; reason?: string }) => {
      const res = await apiRequest("POST", "/api/admin/discord/soft-ban", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Участник ограничен", description: data.message });
      setSoftBanUserId("");
      setSoftBanReason("");
      setSoftBanSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/soft-banned"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка ограничения", description: error.message, variant: "destructive" });
    },
  });

  const softUnbanMutation = useMutation({
    mutationFn: async (data: { userId: string }) => {
      const res = await apiRequest("POST", "/api/admin/discord/soft-unban", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Ограничение снято", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/soft-banned"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка снятия", description: error.message, variant: "destructive" });
    },
  });

  // ── Bot channel permissions ──
  interface BotChannelPerm {
    id: string;
    channelId: string;
    channelName: string;
    allowAutoMessages: boolean;
  }

  const { data: botChannels } = useQuery<BotChannelPerm[]>({
    queryKey: ["/api/admin/discord/bot-channels"],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/discord/bot-channels", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    },
  });

  const [botChannelToggles, setBotChannelToggles] = useState<Record<string, boolean>>({});

  // Initialize toggles from DB data
  useEffect(() => {
    if (botChannels && botChannels.length > 0) {
      const toggles: Record<string, boolean> = {};
      for (const ch of botChannels) {
        toggles[ch.channelId] = ch.allowAutoMessages;
      }
      setBotChannelToggles(toggles);
    }
  }, [botChannels]);

  const saveBotChannelsMutation = useMutation({
    mutationFn: async (channelList: Array<{ channelId: string; channelName: string; allowAutoMessages: boolean }>) => {
      const res = await apiRequest("POST", "/api/admin/discord/bot-channels", { channels: channelList });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Настройки каналов бота сохранены!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/bot-channels"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    },
  });

  // Channel creation
  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; category?: string; topic?: string; allowedRoleIds?: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/discord/create-channel", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Канал #${data.name} создан!` });
      setNewChannelName("");
      setNewChannelTopic("");
      setNewChannelRoleIds([]);
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
      allowedRoleIds: newChannelRoleIds.length > 0 ? newChannelRoleIds : undefined,
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
          <TabsTrigger value="triggers" className="gap-1.5">
            <Zap className="w-4 h-4" />
            Триггеры
          </TabsTrigger>
          <TabsTrigger value="ai-monitor" className="gap-1.5">
            <Activity className="w-4 h-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="soft-ban" className="gap-1.5">
            <Ban className="w-4 h-4" />
            Ограничения
          </TabsTrigger>
          <TabsTrigger value="roles-manage" className="gap-1.5">
            <Crown className="w-4 h-4" />
            Роли
          </TabsTrigger>
          <TabsTrigger value="activity-stats" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Статистика
          </TabsTrigger>
          <TabsTrigger value="ai-analysis" className="gap-1.5">
            <Brain className="w-4 h-4" />
            Анализ AI
          </TabsTrigger>
          <TabsTrigger value="ai-promo" className="gap-1.5">
            <Megaphone className="w-4 h-4" />
            Продвижение
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
                    <SelectContent className="max-h-[300px] overflow-y-auto">
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

                {/* Role-based access */}
                {roles && roles.length > 0 && (
                  <div>
                    <Label>Доступ по ролям (приватный канал)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Если выбраны роли, канал будет виден только участникам с этими ролями
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
                      {roles.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox
                            checked={newChannelRoleIds.includes(role.id)}
                            onCheckedChange={(checked) => {
                              setNewChannelRoleIds(prev =>
                                checked
                                  ? [...prev, role.id]
                                  : prev.filter(id => id !== role.id)
                              );
                            }}
                          />
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: role.color !== "#000000" ? role.color : "#99aab5" }}
                          />
                          <span className="text-sm">{role.name}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">{role.memberCount}</Badge>
                        </label>
                      ))}
                    </div>
                    {newChannelRoleIds.length > 0 && (
                      <p className="text-xs text-amber-500 mt-1">
                        🔒 Канал будет приватным — доступ только для {newChannelRoleIds.length} выбранных ролей
                      </p>
                    )}
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
                    <SelectContent className="max-h-[300px] overflow-y-auto">
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
                    <SelectContent className="max-h-[300px] overflow-y-auto">
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

        {/* ============ TRIGGERS TAB ============ */}
        <TabsContent value="triggers" className="mt-6 space-y-4">
          {/* Create / Edit trigger form */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                {editingTriggerId ? "Редактировать триггер" : "Новый авто-ответ"}
              </CardTitle>
              <CardDescription>
                Бот автоматически ответит, когда пользователь напишет одно из ключевых слов. Поддерживает ссылки, текст, изображения (Discord автоматически покажет превью).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Ключевые слова (через запятую)</Label>
                <Input
                  placeholder="arena,арена,Arena,Арена"
                  value={triggerWords}
                  onChange={(e) => setTriggerWords(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Регистр не важен. Каждое слово — отдельный триггер.</p>
              </div>
              <div>
                <Label>Ответ бота</Label>
                <Textarea
                  placeholder="https://www.roblox.com/games/15887744763/Arena-MWT"
                  value={triggerResponse}
                  onChange={(e) => setTriggerResponse(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">Ссылки на Roblox/YouTube/картинки автоматически покажут превью в Discord.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Тип ответа</Label>
                  <Select value={triggerType} onValueChange={setTriggerType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link">Ссылка</SelectItem>
                      <SelectItem value="text">Текст</SelectItem>
                      <SelectItem value="embed">Embed-карточка</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Кулдаун (сек)</Label>
                  <Input
                    type="number"
                    min={5}
                    value={triggerCooldown}
                    onChange={(e) => setTriggerCooldown(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Минимум 5 сек между ответами в одном канале</p>
                </div>
              </div>
              <div>
                <Label>Заметка (необязательно)</Label>
                <Input
                  placeholder="Ссылка на арену для игроков"
                  value={triggerDescription}
                  onChange={(e) => setTriggerDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveTrigger} disabled={createTriggerMutation.isPending || updateTriggerMutation.isPending}>
                  {(createTriggerMutation.isPending || updateTriggerMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingTriggerId ? "Сохранить изменения" : "Создать триггер"}
                </Button>
                {editingTriggerId && (
                  <Button variant="outline" onClick={() => {
                    setEditingTriggerId(null);
                    setTriggerWords(""); setTriggerResponse(""); setTriggerDescription("");
                    setTriggerType("link"); setTriggerCooldown("30");
                  }}>
                    Отмена
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* List of triggers */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Активные триггеры</CardTitle>
              <CardDescription>
                {autoResponses?.length || 0} авто-ответов настроено
              </CardDescription>
            </CardHeader>
            <CardContent>
              {autoResponsesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : !autoResponses?.length ? (
                <p className="text-muted-foreground text-center py-8">
                  Нет триггеров. Создайте первый авто-ответ выше.
                </p>
              ) : (
                <div className="space-y-3">
                  {autoResponses.map((t) => (
                    <div
                      key={t.id}
                      className={`p-4 rounded-lg glass glass-border ${!t.isActive ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {t.triggerWords.split(',').map((word, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {word.trim()}
                              </Badge>
                            ))}
                            <Badge variant={t.responseType === 'link' ? 'default' : 'outline'} className="text-xs">
                              {t.responseType === 'link' ? '🔗 Ссылка' : t.responseType === 'embed' ? '📋 Embed' : '💬 Текст'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{t.response}</p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-1">📝 {t.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            ⏱ Кулдаун: {Math.round(t.cooldownMs / 1000)}с
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={t.isActive}
                            onCheckedChange={(checked) => toggleTriggerMutation.mutate({ id: t.id, isActive: checked })}
                          />
                          <Button size="sm" variant="ghost" onClick={() => startEditTrigger(t)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => {
                              if (confirm(`Удалить триггер "${t.triggerWords}"?`)) {
                                deleteTriggerMutation.mutate(t.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ AI MONITORING TAB ============ */}
        <TabsContent value="ai-monitor" className="mt-6 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Мониторинг AI-провайдеров
              </CardTitle>
              <CardDescription>
                Проверка доступности всех нейросетей, подключённых к боту. Нажмите чтобы протестировать каждый провайдер в реальном времени.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button onClick={runAiHealthCheck} disabled={aiHealthLoading}>
                  {aiHealthLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {aiHealthLoading ? "Тестирование..." : "Запустить проверку"}
                </Button>
                {aiHealth && (
                  <span className="text-sm text-muted-foreground">
                    Последняя проверка: {new Date(aiHealth.checkedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {aiHealth && (
                <>
                  {/* Summary */}
                  <div className={`p-4 rounded-lg border ${
                    aiHealth.onlineCount >= 3 ? 'border-green-500/50 bg-green-500/10' :
                    aiHealth.onlineCount >= 1 ? 'border-yellow-500/50 bg-yellow-500/10' :
                    'border-red-500/50 bg-red-500/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      {aiHealth.onlineCount >= 3 ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : aiHealth.onlineCount >= 1 ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="text-lg font-bold">
                        {aiHealth.summary}
                      </span>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {aiHealth.onlineCount >= 3
                        ? "Бот работает стабильно. Достаточно провайдеров для надёжной работы."
                        : aiHealth.onlineCount >= 1
                        ? "Работает, но мало доступных провайдеров. Возможны задержки."
                        : "Все провайдеры недоступны! Бот будет отвечать заготовленными фразами."
                      }
                    </p>
                  </div>

                  {/* API Key Status */}
                  {(!aiHealth.hasGeminiKey || !aiHealth.hasGroqKey || !aiHealth.hasOpenRouterKey) && (
                    <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-sm">
                      <p className="font-semibold mb-1">💡 Рекомендация: добавьте бесплатные ключи для стабильной работы</p>
                      {!aiHealth.hasOpenRouterKey && (
                        <p className="text-xs text-blue-300">• <strong>OPENROUTER_API_KEY</strong> — бесплатно на <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">openrouter.ai/keys</a> (работает из РФ, бесплатные модели)</p>
                      )}
                      {!aiHealth.hasGroqKey && (
                        <p className="text-xs text-blue-300">• <strong>GROQ_API_KEY</strong> — бесплатно на <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="underline">console.groq.com</a> (30 запросов/мин)</p>
                      )}
                      {!aiHealth.hasGeminiKey && (
                        <p className="text-xs text-blue-300">• <strong>GEMINI_API_KEY</strong> — бесплатно на <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com/apikey</a> (может не работать из РФ)</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Добавьте в Environment Variables на Render Dashboard → перезапустите сервис.</p>
                    </div>
                  )}

                  {/* Provider list */}
                  <div className="grid gap-2">
                    {Object.entries(aiHealth.providers).map(([name, info]) => (
                      <div
                        key={name}
                        className={`flex items-center justify-between p-3 rounded-lg glass glass-border ${
                          info.status === 'online' ? '' : 'opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {info.status === 'online' ? (
                            <Wifi className="w-4 h-4 text-green-500" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              {name}
                              {info.tier === 'keyed' && (
                                <span className="ml-2 text-xs text-yellow-400">🔑 КЛЮЧ</span>
                              )}
                            </p>
                            {info.error && (
                              <p className="text-xs text-red-400 max-w-md truncate">{info.error}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={info.status === 'online' ? 'default' : 'destructive'} className="text-xs">
                            {info.status === 'online' ? '✅ Online' : '❌ Offline'}
                          </Badge>
                          <span className="text-xs text-muted-foreground w-16 text-right">
                            {info.latencyMs}ms
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Explanation */}
                  <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-white/10">
                    <p className="font-semibold text-yellow-400">🔑 Приоритетные (с API-ключом, самые надёжные):</p>
                    <p>� <strong>OpenRouter</strong> — Llama 3.1 8B, бесплатный ключ, работает из РФ ✅</p>
                    <p>⚡ <strong>Groq</strong> — Llama 3.1 8B, бесплатный ключ, 30 запросов/мин</p>
                    <p>🟣 <strong>Gemini</strong> — Google Gemini 2.0 Flash (может не работать из РФ)</p>
                    <p className="font-semibold text-blue-400 pt-1">🌐 Бесплатные (без ключа, запасные):</p>
                    <p>🦆 <strong>DuckDuckGo</strong> — GPT-4o-mini через DDG, бесплатный</p>
                    <p>🤖 <strong>Pollinations</strong> — openai/mistral модели, бесплатный</p>
                    <p>🤗 <strong>HuggingFace</strong> — Mistral-7B-Instruct, бесплатный</p>
                    <p>🧠 <strong>Cerebras</strong> — Llama 3.1 8B, бесплатный</p>
                    <p className="pt-1">Бот сначала пробует провайдеры с ключом (если есть), затем бесплатные <strong>по очереди</strong> (не одновременно, чтобы не получить IP-бан). Если все упадут — ответит заготовленной фразой.</p>
                  </div>
                </>
              )}

              {!aiHealth && !aiHealthLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Нажмите «Запустить проверку» чтобы протестировать все AI-провайдеры</p>
                  <p className="text-xs mt-1">Проверка занимает ~10-15 секунд</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bot Channel Permissions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                Каналы автосообщений бота
              </CardTitle>
              <CardDescription>
                Выберите каналы, в которых бот может сам писать сообщения для активации чата. Если ни один канал не выбран — бот использует авто-фильтр (пишет везде кроме правил/логов/админки).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {channelsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <>
                  <div className="max-h-[350px] overflow-y-auto space-y-1">
                    {(channelsDetailed?.channels || channels)?.filter(c => {
                      const t = typeof c.type === 'number' ? c.type : (c.type === 'text' ? 0 : 2);
                      return t !== 2 && t !== 13; // all text-like channels (text, announcement, forum)
                    }).map((channel) => (
                      <div
                        key={channel.id}
                        className="flex items-center justify-between p-2 rounded-lg glass glass-border"
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{channel.name}</span>
                        </div>
                        <Switch
                          checked={botChannelToggles[channel.id] ?? false}
                          onCheckedChange={(checked) => {
                            setBotChannelToggles(prev => ({ ...prev, [channel.id]: checked }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={saveBotChannelsMutation.isPending}
                    onClick={() => {
                      const allChannels = (channelsDetailed?.channels || channels) || [];
                      const textChannels = allChannels.filter(c => {
                        const t = typeof c.type === 'number' ? c.type : (c.type === 'text' ? 0 : 2);
                        return t !== 2 && t !== 13; // all text-like channels
                      });
                      const payload = textChannels.map(ch => ({
                        channelId: ch.id,
                        channelName: ch.name,
                        allowAutoMessages: botChannelToggles[ch.id] ?? false,
                      }));
                      saveBotChannelsMutation.mutate(payload);
                    }}
                  >
                    {saveBotChannelsMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Сохранение...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Сохранить настройки каналов</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    ✨ Бот также умеет: отвечать на вопросы, искать игроков в Roblox (напишите "найди [ник] в Roblox"), вести диалоги при ответе на его сообщения.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* ============ SOFT-BAN TAB ============ */}
        <TabsContent value="soft-ban" className="mt-6 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-400" />
                Ограничить участника
              </CardTitle>
              <CardDescription>
                Мягкий бан — участник остаётся на сервере, видит каналы, но не может писать и подключаться к голосу. Можно ограничить по имени или по Discord ID (даже если игрок ещё не на сервере).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Способ 1: Поиск по имени + выбор из списка */}
              <div className="space-y-2">
                <Label>🔍 Найти по имени или выбрать из списка</Label>
                <Input
                  placeholder="Введите имя или часть имени..."
                  value={softBanSearch}
                  onChange={(e) => setSoftBanSearch(e.target.value)}
                />
              </div>

              {membersLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="max-h-[250px] overflow-y-auto space-y-1">
                  {members?.filter(m => {
                    if (!softBanSearch.trim()) return true; // показываем всех если поиск пустой
                    return m.username.toLowerCase().includes(softBanSearch.toLowerCase())
                      || m.id.includes(softBanSearch);
                  }).map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        softBanUserId === member.id
                          ? 'bg-red-500/20 border border-red-500/50'
                          : 'hover:bg-white/5 glass glass-border'
                      }`}
                      onClick={() => {
                        setSoftBanUserId(member.id);
                        setSoftBanSearch(member.username);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={member.avatar}
                          alt={member.username}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <span className="text-sm font-medium">{member.username}</span>
                          <p className="text-xs text-muted-foreground">{member.id}</p>
                        </div>
                      </div>
                      {softBanUserId === member.id && (
                        <CheckCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  ))}
                  {softBanSearch.trim() && members?.filter(m =>
                    m.username.toLowerCase().includes(softBanSearch.toLowerCase())
                    || m.id.includes(softBanSearch)
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Никого не найдено на сервере</p>
                  )}
                </div>
              )}

              {/* Способ 2: Прямой ввод Discord ID */}
              <div className="pt-2 border-t border-white/10">
                <Label>🆔 Или введите Discord ID напрямую</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="123456789012345678"
                    value={softBanUserId}
                    onChange={(e) => {
                      // Очистить поиск при ручном вводе ID
                      setSoftBanUserId(e.target.value.trim());
                    }}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Работает даже если игрок ещё не на сервере — ограничения применятся автоматически при входе
                </p>
              </div>

              {softBanUserId && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                    <Ban className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-mono">{softBanUserId}</span>
                  </div>
                  <div>
                    <Label>Причина (необязательно)</Label>
                    <Input
                      placeholder="Нарушение правил, спам..."
                      value={softBanReason}
                      onChange={(e) => setSoftBanReason(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={softBanMutation.isPending}
                    onClick={() => softBanMutation.mutate({ userId: softBanUserId, reason: softBanReason })}
                  >
                    {softBanMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ограничение...</>
                    ) : (
                      <><Ban className="w-4 h-4 mr-2" /> Ограничить участника</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* List of currently restricted users */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-orange-400" />
                Ограниченные участники
              </CardTitle>
              <CardDescription>Участники, которые не могут писать и подключаться к голосу</CardDescription>
            </CardHeader>
            <CardContent>
              {softBannedLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (softBanned && softBanned.length > 0) ? (
                <div className="space-y-2">
                  {softBanned.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg glass glass-border">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <Ban className="w-4 h-4 text-red-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{user.username}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground font-mono">{user.id}</p>
                            {user.isPreBan && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Пре-бан</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={softUnbanMutation.isPending}
                        onClick={() => softUnbanMutation.mutate({ userId: user.id })}
                      >
                        {softUnbanMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>✅ Снять</>  
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Нет ограниченных участников</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ROLES MANAGEMENT TAB ============ */}
        <TabsContent value="roles-manage" className="mt-6 space-y-4">
          <RolesManageTab />
        </TabsContent>

        {/* ============ ACTIVITY STATS TAB ============ */}
        <TabsContent value="activity-stats" className="mt-6 space-y-4">
          <ActivityStatsTab />
        </TabsContent>

        {/* ============ AI ANALYSIS TAB ============ */}
        <TabsContent value="ai-analysis" className="mt-6 space-y-4">
          <AiAnalysisTab />
        </TabsContent>

        {/* ============ AI PROMOTION TAB ============ */}
        <TabsContent value="ai-promo" className="mt-6 space-y-4">
          <AiPromoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ ROLES MANAGEMENT SUB-TAB ============
function RolesManageTab() {
  const { toast } = useToast();
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#5865f2");
  const [newRoleHoist, setNewRoleHoist] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleColor, setEditRoleColor] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignMemberId, setAssignMemberId] = useState("");

  const { data: roles, isLoading: rolesLoading } = useQuery<Array<{id: string; name: string; color: string; position: number; memberCount: number}>>({
    queryKey: ["/api/admin/discord/roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/discord/roles", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const { data: members } = useQuery<Array<{id: string; username: string; avatar: string; roles: string[]}>>({
    queryKey: ["/api/admin/discord/members"],
    queryFn: async () => {
      const res = await fetch("/api/admin/discord/members", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; hoist: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/discord/roles", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Роль "${data.name}" создана!` });
      setNewRoleName("");
      setNewRoleColor("#5865f2");
      setNewRoleHoist(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/roles"] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const editRoleMutation = useMutation({
    mutationFn: async ({ roleId, data }: { roleId: string; data: { name?: string; color?: string } }) => {
      const res = await apiRequest("PUT", `/api/admin/discord/roles/${roleId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Роль обновлена!" });
      setEditingRoleId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/roles"] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/discord/roles/${roleId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Роль удалена!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/roles"] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const assignRoleMutation = useMutation({
    mutationFn: async (data: { discordId: string; roleId: string }) => {
      const res = await apiRequest("POST", "/api/admin/discord/roles/assign", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Роль "${data.roleName}" выдана ${data.memberName}` });
      setAssignMemberId("");
      setAssignRoleId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/members"] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (data: { discordId: string; roleId: string }) => {
      const res = await apiRequest("POST", "/api/admin/discord/roles/remove", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Роль "${data.roleName}" снята с ${data.memberName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/members"] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      {/* Create Role */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Создать роль
          </CardTitle>
          <CardDescription>Создание новых ролей для Discord сервера</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Название</Label>
              <Input
                placeholder="Название роли..."
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
            <div>
              <Label>Цвет</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border"
                />
                <Input value={newRoleColor} onChange={(e) => setNewRoleColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={newRoleHoist} onCheckedChange={(v) => setNewRoleHoist(!!v)} />
                <span className="text-sm">Отображать отдельно</span>
              </label>
            </div>
          </div>
          <Button
            onClick={() => createRoleMutation.mutate({ name: newRoleName.trim(), color: newRoleColor, hoist: newRoleHoist })}
            disabled={createRoleMutation.isPending || !newRoleName.trim()}
            className="w-full"
          >
            {createRoleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Создать роль
          </Button>
        </CardContent>
      </Card>

      {/* Assign/Remove Role */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            Назначить / Снять роль
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Участник</Label>
              <Select value={assignMemberId} onValueChange={setAssignMemberId}>
                <SelectTrigger><SelectValue placeholder="Выберите участника" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {members?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Роль</Label>
              <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                <SelectTrigger><SelectValue placeholder="Выберите роль" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {roles?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color !== "#000000" ? r.color : "#99aab5" }} />
                        {r.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => assignRoleMutation.mutate({ discordId: assignMemberId, roleId: assignRoleId })}
              disabled={!assignMemberId || !assignRoleId || assignRoleMutation.isPending}
              className="flex-1"
            >
              {assignRoleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Назначить роль
            </Button>
            <Button
              variant="outline"
              onClick={() => removeRoleMutation.mutate({ discordId: assignMemberId, roleId: assignRoleId })}
              disabled={!assignMemberId || !assignRoleId || removeRoleMutation.isPending}
              className="flex-1"
            >
              {removeRoleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Снять роль
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Все роли сервера</CardTitle>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : roles && roles.length > 0 ? (
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color !== "#000000" ? role.color : "#99aab5" }} />
                    {editingRoleId === role.id ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={editRoleName}
                          onChange={(e) => setEditRoleName(e.target.value)}
                          className="w-40 h-8"
                        />
                        <input type="color" value={editRoleColor} onChange={(e) => setEditRoleColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                        <Button size="sm" onClick={() => editRoleMutation.mutate({ roleId: role.id, data: { name: editRoleName, color: editRoleColor } })}>
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingRoleId(null)}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">{role.name}</span>
                    )}
                    <Badge variant="secondary" className="text-xs">{role.memberCount} чел.</Badge>
                  </div>
                  {editingRoleId !== role.id && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingRoleId(role.id);
                          setEditRoleName(role.name);
                          setEditRoleColor(role.color);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteRoleMutation.mutate(role.id)}
                        disabled={deleteRoleMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground text-sm">Ролей нет</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ============ ACTIVITY STATS SUB-TAB ============
function ActivityStatsTab() {
  const { data: stats, isLoading } = useQuery<{
    server: { totalMembers: number; onlineMembers: number; textChannels: number; voiceChannels: number; rolesCount: number; boostLevel: number; boostCount: number; createdAt: string; guildName: string };
    totals: { totalMessages: number; totalVoiceMinutes: number; totalReactions: number; activeMembers: number };
    topActive: Array<{ discordId: string; username: string; avatar: string; messageCount: number; voiceMinutes: number; reactionCount: number; lastActivity: string; lumiCoins: number; level: number }>;
    inactive: Array<{ discordId: string; username: string; avatar: string; lastActivity: string; messageCount: number }>;
  }>({
    queryKey: ["/api/admin/discord/activity-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/discord/activity-stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!stats) return <p className="text-muted-foreground text-center py-8">Нет данных</p>;

  return (
    <>
      {/* Server Overview */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Обзор сервера: {stats.server.guildName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{stats.server.totalMembers}</div>
              <div className="text-xs text-muted-foreground">Участников</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-green-500">{stats.server.onlineMembers}</div>
              <div className="text-xs text-muted-foreground">Онлайн</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{stats.server.textChannels}</div>
              <div className="text-xs text-muted-foreground">Текстовых каналов</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{stats.server.voiceChannels}</div>
              <div className="text-xs text-muted-foreground">Голосовых каналов</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-500">{stats.totals.totalMessages}</div>
              <div className="text-xs text-muted-foreground">Всего сообщений</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-500">{Math.round((stats.totals.totalVoiceMinutes || 0) / 60)}</div>
              <div className="text-xs text-muted-foreground">Часов в голосовых</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-yellow-500">{stats.totals.totalReactions}</div>
              <div className="text-xs text-muted-foreground">Реакций</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-cyan-500">{stats.totals.activeMembers}</div>
              <div className="text-xs text-muted-foreground">Активных участников</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Active Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Топ активных участников
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Участник</th>
                  <th className="text-right py-2 px-2">Сообщ.</th>
                  <th className="text-right py-2 px-2">Голос (мин)</th>
                  <th className="text-right py-2 px-2">Реакции</th>
                  <th className="text-right py-2 px-2">LC</th>
                  <th className="text-right py-2 px-2">Ур.</th>
                </tr>
              </thead>
              <tbody>
                {stats.topActive.map((m, i) => (
                  <tr key={m.discordId} className="border-b border-muted/20">
                    <td className="py-2 px-2 font-bold">{i + 1}</td>
                    <td className="py-2 px-2 flex items-center gap-2">
                      {m.avatar ? <img src={m.avatar} className="w-6 h-6 rounded-full" alt="" /> : <UsersIcon className="w-6 h-6 text-muted-foreground" />}
                      {m.username}
                    </td>
                    <td className="py-2 px-2 text-right">{m.messageCount || 0}</td>
                    <td className="py-2 px-2 text-right">{m.voiceMinutes || 0}</td>
                    <td className="py-2 px-2 text-right">{m.reactionCount || 0}</td>
                    <td className="py-2 px-2 text-right text-amber-500">{m.lumiCoins || 0}</td>
                    <td className="py-2 px-2 text-right">{m.level || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Inactive Members */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-red-500" />
            Неактивные участники (7+ дней)
          </CardTitle>
          <CardDescription>Участники, которые не проявляли активность более 7 дней</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.inactive.length > 0 ? (
            <div className="space-y-2">
              {stats.inactive.map((m) => (
                <div key={m.discordId} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    {m.avatar ? <img src={m.avatar} className="w-6 h-6 rounded-full" alt="" /> : <UsersIcon className="w-6 h-6 text-muted-foreground" />}
                    <span className="text-sm">{m.username}</span>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Посл. активность: {new Date(m.lastActivity).toLocaleDateString('ru-RU')}</p>
                    <p>{m.messageCount || 0} сообщ.</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Все участники активны!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ============ AI ANALYSIS SUB-TAB ============
function AiAnalysisTab() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<string | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/ai/analyze-server");
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
    },
    onError: (e: any) => toast({ title: "Ошибка анализа", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Анализ сервера
        </CardTitle>
        <CardDescription>
          Искусственный интеллект проанализирует ваш сервер и даст рекомендации по улучшению
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="w-full"
          size="lg"
        >
          {analyzeMutation.isPending ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Анализируем сервер...</>
          ) : (
            <><Brain className="w-5 h-5 mr-2" /> Запустить анализ</>
          )}
        </Button>

        {analysis && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg prose prose-sm prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm">{analysis}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ AI PROMOTION SUB-TAB ============
function AiPromoTab() {
  const { toast } = useToast();
  const [promoType, setPromoType] = useState("general");
  const [promoLang, setPromoLang] = useState("ru");
  const [promoResult, setPromoResult] = useState<string | null>(null);

  const promoMutation = useMutation({
    mutationFn: async (data: { type: string; language: string }) => {
      const res = await apiRequest("POST", "/api/admin/ai/generate-promotion", data);
      return res.json();
    },
    onSuccess: (data) => {
      setPromoResult(data.content);
    },
    onError: (e: any) => toast({ title: "Ошибка генерации", description: e.message, variant: "destructive" }),
  });

  const copyToClipboard = () => {
    if (promoResult) {
      navigator.clipboard.writeText(promoResult);
      toast({ title: "Скопировано!" });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          AI Продвижение сервера
        </CardTitle>
        <CardDescription>
          Генерация рекламных текстов для привлечения новых участников
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Тип контента</Label>
            <Select value={promoType} onValueChange={setPromoType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">🎯 Общий рекламный пост</SelectItem>
                <SelectItem value="social">📱 Для соц. сетей</SelectItem>
                <SelectItem value="recruitment">🎮 Рекрутинг игроков</SelectItem>
                <SelectItem value="description">📝 Описание сервера</SelectItem>
                <SelectItem value="event">🎉 Анонс мероприятия</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Язык</Label>
            <Select value={promoLang} onValueChange={setPromoLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                <SelectItem value="en">🇺🇸 English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={() => promoMutation.mutate({ type: promoType, language: promoLang })}
          disabled={promoMutation.isPending}
          className="w-full"
          size="lg"
        >
          {promoMutation.isPending ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Генерируем...</>
          ) : (
            <><Megaphone className="w-5 h-5 mr-2" /> Сгенерировать</>
          )}
        </Button>

        {promoResult && (
          <div className="mt-4 relative">
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="whitespace-pre-wrap text-sm">{promoResult}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={copyToClipboard}
            >
              <Copy className="w-4 h-4 mr-1" /> Копировать
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
