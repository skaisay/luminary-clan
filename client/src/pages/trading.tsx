import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeftRight, Coins, Package, Search, Loader2, Plus, Check, X,
  Clock, Send, Inbox, ArrowRight, User as UserIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TradeOffer {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  offerCoins: number;
  requestCoins: number;
  offerItems: { itemId: string; quantity: number; name?: string }[];
  requestItems: { itemId: string; quantity: number; name?: string }[];
  status: string;
  message: string | null;
  createdAt: string;
  fromUsername?: string;
  toUsername?: string;
}

const statusStyles: Record<string, { label: string; class: string }> = {
  pending: { label: "Ожидает", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  accepted: { label: "Принято", class: "bg-green-500/10 text-green-400 border-green-500/20" },
  rejected: { label: "Отклонено", class: "bg-red-500/10 text-red-400 border-red-500/20" },
  cancelled: { label: "Отменено", class: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
};

export default function TradingPage() {
  const [activeTab, setActiveTab] = useState("incoming");
  const [targetUser, setTargetUser] = useState("");
  const [offerCoins, setOfferCoins] = useState(0);
  const [requestCoins, setRequestCoins] = useState(0);
  const [message, setMessage] = useState("");
  const [showCreateTrade, setShowCreateTrade] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: trades, isLoading } = useQuery<{ incoming: TradeOffer[]; outgoing: TradeOffer[] }>({
    queryKey: [`/api/trades/${user?.discordId}`],
    enabled: !!user?.discordId,
  });

  const createTradeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/trades", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trades/${user?.discordId}`] });
      setShowCreateTrade(false);
      setTargetUser("");
      setOfferCoins(0);
      setRequestCoins(0);
      setMessage("");
      toast({ title: "✅ Предложение отправлено!" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const respondTradeMutation = useMutation({
    mutationFn: async ({ tradeId, action }: { tradeId: string; action: "accept" | "reject" }) => {
      const res = await apiRequest("POST", `/api/trades/${tradeId}/respond`, { action, discordId: user?.discordId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/trades/${user?.discordId}`] });
      toast({ title: data.message || "✅ Готово!" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const cancelTradeMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      const res = await apiRequest("POST", `/api/trades/${tradeId}/cancel`, { discordId: user?.discordId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trades/${user?.discordId}`] });
      toast({ title: "Предложение отменено" });
    },
  });

  if (!user?.discordId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <ArrowLeftRight className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">Торговля</h1>
        <p className="text-muted-foreground">Войдите через Discord для торговли</p>
      </div>
    );
  }

  const incoming = trades?.incoming?.filter(t => t.status === "pending") || [];
  const outgoing = trades?.outgoing?.filter(t => t.status === "pending") || [];
  const history = [
    ...(trades?.incoming?.filter(t => t.status !== "pending") || []),
    ...(trades?.outgoing?.filter(t => t.status !== "pending") || []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <ArrowLeftRight className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                Торговля
              </h1>
              <p className="text-muted-foreground">Обменивайтесь LumiCoins с другими участниками</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateTrade(!showCreateTrade)} className="gap-2">
            <Plus className="h-4 w-4" /> Новое предложение
          </Button>
        </div>

        {/* Create Trade Form */}
        {showCreateTrade && (
          <Card className="glass glass-border mb-6">
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Кому (Discord ID или имя)</label>
                <Input
                  value={targetUser}
                  onChange={e => setTargetUser(e.target.value)}
                  placeholder="Введите Discord ID или username"
                  className="glass glass-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Вы отдаёте (LC)</label>
                  <Input
                    type="number"
                    min={0}
                    value={offerCoins}
                    onChange={e => setOfferCoins(Number(e.target.value))}
                    className="glass glass-border"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Вы получаете (LC)</label>
                  <Input
                    type="number"
                    min={0}
                    value={requestCoins}
                    onChange={e => setRequestCoins(Number(e.target.value))}
                    className="glass glass-border"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Сообщение (необязательно)</label>
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Напишите комментарий..."
                  className="glass glass-border"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowCreateTrade(false)}>Отмена</Button>
                <Button
                  onClick={() => createTradeMutation.mutate({
                    discordId: user.discordId,
                    targetUser,
                    offerCoins,
                    requestCoins,
                    offerItems: [],
                    requestItems: [],
                    message: message || null,
                  })}
                  disabled={!targetUser.trim() || (offerCoins === 0 && requestCoins === 0) || createTradeMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  {createTradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Отправить
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass glass-border w-full justify-start mb-6">
          <TabsTrigger value="incoming" className="gap-1.5">
            <Inbox className="h-4 w-4" /> Входящие ({incoming.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="gap-1.5">
            <Send className="h-4 w-4" /> Исходящие ({outgoing.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Clock className="h-4 w-4" /> История ({history.length})
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="incoming" className="space-y-3">
              {incoming.length === 0 ? (
                <div className="text-center py-16">
                  <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Нет входящих предложений</p>
                </div>
              ) : (
                incoming.map(trade => (
                  <Card key={trade.id} className="glass glass-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">{trade.fromUsername || 'Участник'}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Вам</span>
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            {trade.offerCoins > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Coins className="h-3 w-3 text-green-400" /> Даёт: {trade.offerCoins} LC
                              </Badge>
                            )}
                            {trade.requestCoins > 0 && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Coins className="h-3 w-3 text-red-400" /> Хочет: {trade.requestCoins} LC
                              </Badge>
                            )}
                          </div>
                          {trade.message && (
                            <p className="text-xs text-muted-foreground mt-2 italic">"{trade.message}"</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 gap-1"
                            onClick={() => respondTradeMutation.mutate({ tradeId: trade.id, action: "accept" })}
                            disabled={respondTradeMutation.isPending}
                          >
                            <Check className="h-4 w-4" /> Принять
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            onClick={() => respondTradeMutation.mutate({ tradeId: trade.id, action: "reject" })}
                            disabled={respondTradeMutation.isPending}
                          >
                            <X className="h-4 w-4" /> Отклонить
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="outgoing" className="space-y-3">
              {outgoing.length === 0 ? (
                <div className="text-center py-16">
                  <Send className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Нет исходящих предложений</p>
                </div>
              ) : (
                outgoing.map(trade => (
                  <Card key={trade.id} className="glass glass-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">Вы</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">{trade.toUsername || 'Участник'}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            {trade.offerCoins > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Coins className="h-3 w-3" /> Отдаёте: {trade.offerCoins} LC
                              </Badge>
                            )}
                            {trade.requestCoins > 0 && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Coins className="h-3 w-3" /> Просите: {trade.requestCoins} LC
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => cancelTradeMutation.mutate(trade.id)}
                          disabled={cancelTradeMutation.isPending}
                        >
                          Отменить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">История торгов пуста</p>
                </div>
              ) : (
                history.map(trade => {
                  const statusInfo = statusStyles[trade.status] || statusStyles.cancelled;
                  return (
                    <Card key={trade.id} className="glass glass-border opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm">{trade.fromUsername || '?'}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{trade.toUsername || '?'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {trade.offerCoins > 0 && <span className="text-xs text-muted-foreground">{trade.offerCoins} LC</span>}
                              {trade.requestCoins > 0 && <span className="text-xs text-muted-foreground">за {trade.requestCoins} LC</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={`text-xs ${statusInfo.class}`}>
                              {statusInfo.label}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground/50 mt-1">
                              {new Date(trade.createdAt).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
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
