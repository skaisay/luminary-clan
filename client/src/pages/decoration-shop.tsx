import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Coins, Sparkles, Shield, Palette, Frame, Star, Check, ShoppingBag, LogIn } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

type Decoration = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  emoji: string | null;
  imageUrl: string | null;
  cssEffect: string | null;
  color: string | null;
  rarity: string;
  price: number;
  category: string | null;
  maxOwners: number | null;
  currentOwners: number;
};

type OwnedDecoration = {
  memberDecorationId: string;
  decorationId: string;
  isEquipped: boolean;
  decoration: Decoration;
};

export default function DecorationShop() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [equippingId, setEquippingId] = useState<string | null>(null);

  const { data: decorations, isLoading } = useQuery<Decoration[]>({
    queryKey: ["/api/decorations"],
  });

  const { data: owned } = useQuery<OwnedDecoration[]>({
    queryKey: ["/api/decorations/my"],
    enabled: isAuthenticated,
  });

  const buyMutation = useMutation({
    mutationFn: async (decorationId: string) => {
      setBuyingId(decorationId);
      const resp = await apiRequest("POST", "/api/decorations/buy", { decorationId });
      return resp.json();
    },
    onSuccess: (data: any) => {
      setBuyingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/decorations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/all-equipped"] });
      toast({
        title: "🎉 Куплено!",
        description: `${data.decoration?.name || "Украшение"} теперь ваше. Баланс: ${data.newBalance} LC`,
      });
    },
    onError: (error: any) => {
      setBuyingId(null);
      toast({
        variant: "destructive",
        title: "❌ Ошибка",
        description: error.message || "Не удалось купить",
      });
    },
  });

  const equipMutation = useMutation({
    mutationFn: async ({ memberDecorationId, equip }: { memberDecorationId: string; equip: boolean }) => {
      setEquippingId(memberDecorationId);
      const resp = await apiRequest("POST", "/api/decorations/equip", { memberDecorationId, equip });
      return resp.json();
    },
    onSuccess: () => {
      setEquippingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/all-equipped"] });
    },
    onError: (error: any) => {
      setEquippingId(null);
      toast({
        variant: "destructive",
        title: "❌ Ошибка",
        description: error.message,
      });
    },
  });

  const ownedIds = new Set(owned?.map(o => o.decorationId) || []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "badge": return <Shield className="h-5 w-5" />;
      case "name_color": return <Palette className="h-5 w-5" />;
      case "avatar_frame": return <Frame className="h-5 w-5" />;
      default: return <Sparkles className="h-5 w-5" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "badge": return "Значки";
      case "name_color": return "Цвета ника";
      case "avatar_frame": return "Рамки аватара";
      case "profile_effect": return "Эффекты профиля";
      case "banner": return "Баннеры";
      default: return type;
    }
  };

  const getRarityStyle = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border-yellow-500/40 shadow-lg shadow-yellow-500/10";
      case "epic":
        return "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/40 shadow-lg shadow-purple-500/10";
      case "rare":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/15 text-gray-400 border-gray-500/30";
    }
  };

  const getRarityLabel = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "✨ Легендарный";
      case "epic": return "💎 Эпический";
      case "rare": return "⭐ Редкий";
      default: return "Обычный";
    }
  };

  const getCardBorder = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "border-yellow-500/30 hover:border-yellow-400/50";
      case "epic": return "border-purple-500/30 hover:border-purple-400/50";
      case "rare": return "border-blue-500/20 hover:border-blue-400/40";
      default: return "border-border/50 hover:border-primary/30";
    }
  };

  const types = decorations ? Array.from(new Set(decorations.map(d => d.type))) : [];

  const renderDecorationCard = (dec: Decoration) => {
    const isOwned = ownedIds.has(dec.id);
    const ownedEntry = owned?.find(o => o.decorationId === dec.id);
    const isSoldOut = dec.maxOwners !== null && dec.currentOwners >= dec.maxOwners;

    return (
      <Card key={dec.id} className={`glass glass-border ${getCardBorder(dec.rarity)} transition-all hover:shadow-lg`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {dec.emoji ? (
                <span className="text-2xl">{dec.emoji}</span>
              ) : (
                getTypeIcon(dec.type)
              )}
              <div>
                <CardTitle className="text-base">{dec.name}</CardTitle>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge className={`text-[10px] ${getRarityStyle(dec.rarity)}`}>
                    {getRarityLabel(dec.rarity)}
                  </Badge>
                </div>
              </div>
            </div>
            {isOwned && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                <Check className="h-3 w-3 mr-0.5" /> В коллекции
              </Badge>
            )}
          </div>
          {dec.description && (
            <CardDescription className="text-xs mt-1">{dec.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pb-3">
          {/* Preview */}
          {dec.cssEffect && dec.type === "name_color" && (
            <div className="mb-3 p-2 rounded-lg bg-background/50 text-center">
              <span className="text-sm font-semibold" style={parseCssEffect(dec.cssEffect)}>
                {user?.username || "Пример ника"}
              </span>
            </div>
          )}
          {dec.type === "badge" && dec.emoji && (
            <div className="mb-3 p-2 rounded-lg bg-background/50 text-center">
              <span className="text-3xl" style={{ color: dec.color || undefined }}>
                {dec.emoji}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-lg font-bold tabular-nums text-primary">{dec.price.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">LC</span>
            </div>
            {dec.maxOwners !== null && (
              <span className="text-[10px] text-muted-foreground">
                {dec.currentOwners}/{dec.maxOwners} владельцев
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          {isOwned ? (
            <Button
              onClick={() => ownedEntry && equipMutation.mutate({
                memberDecorationId: ownedEntry.memberDecorationId,
                equip: !ownedEntry.isEquipped,
              })}
              disabled={equippingId === ownedEntry?.memberDecorationId}
              variant={ownedEntry?.isEquipped ? "default" : "outline"}
              className="w-full"
              size="sm"
            >
              {ownedEntry?.isEquipped ? "✓ Надето — Снять" : "Надеть"}
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (!isAuthenticated) {
                  setLocation('/login');
                  return;
                }
                buyMutation.mutate(dec.id);
              }}
              disabled={buyingId === dec.id || isSoldOut || !isAuthenticated}
              className="w-full"
              size="sm"
            >
              {buyingId === dec.id ? "Покупка..." : isSoldOut ? "Распродано" : `Купить за ${dec.price.toLocaleString()} LC`}
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center justify-center gap-3">
          <ShoppingBag className="h-10 w-10 text-primary" />
          Украшения профиля
        </h1>
        <p className="text-muted-foreground text-lg">
          Значки, цвета ника и рамки — выделись среди остальных
        </p>
      </div>

      {!isAuthenticated && (
        <Card className="glass glass-border border-primary/40 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-6 w-6 text-primary" />
              Войдите для покупки
            </CardTitle>
            <CardDescription>Для покупки украшений нужно авторизоваться через Discord</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setLocation('/login')} className="w-full">
              Войти через Discord
            </Button>
          </CardFooter>
        </Card>
      )}

      {isAuthenticated && user && (
        <Card className="glass glass-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-primary" />
              Баланс
            </CardTitle>
            <CardDescription>
              {user.username} • {user.lumiCoins || 0} LC
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Owned decorations */}
      {owned && owned.length > 0 && (
        <Card className="glass glass-border mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Моя коллекция ({owned.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {owned.map(o => (
                <div
                  key={o.memberDecorationId}
                  className={`flex items-center gap-2 p-2 px-3 rounded-lg border transition-all cursor-pointer ${
                    o.isEquipped 
                      ? "bg-primary/10 border-primary/40" 
                      : "bg-muted/10 border-border/30 hover:border-primary/20"
                  }`}
                  onClick={() => equipMutation.mutate({
                    memberDecorationId: o.memberDecorationId,
                    equip: !o.isEquipped,
                  })}
                >
                  <span className="text-lg">{o.decoration.emoji || "✦"}</span>
                  <span className="text-sm font-medium">{o.decoration.name}</span>
                  {o.isEquipped && <Check className="h-3.5 w-3.5 text-green-400" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all">
        <TabsList className="glass glass-border mb-6 flex flex-wrap w-full gap-2 h-auto p-2">
          <TabsTrigger value="all">Все</TabsTrigger>
          {types.map(type => (
            <TabsTrigger key={type} value={type}>
              <span className="flex items-center gap-1.5">
                {getTypeIcon(type)}
                {getTypeName(type)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="glass glass-border">
                  <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
                  <CardContent><Skeleton className="h-16 w-full" /></CardContent>
                </Card>
              ))
            ) : decorations && decorations.length > 0 ? (
              [...decorations]
                .sort((a, b) => b.price - a.price)
                .map(dec => renderDecorationCard(dec))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">Украшений пока нет</p>
              </div>
            )}
          </div>
        </TabsContent>

        {types.map(type => (
          <TabsContent key={type} value={type}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {decorations
                ?.filter(d => d.type === type)
                .sort((a, b) => b.price - a.price)
                .map(dec => renderDecorationCard(dec))
              }
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function parseCssEffect(cssEffect: string): React.CSSProperties {
  const style: Record<string, string> = {};
  cssEffect.split(";").forEach(rule => {
    const [prop, val] = rule.split(":").map(s => s.trim());
    if (prop && val) {
      const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      style[camelProp] = val;
    }
  });
  return style;
}
