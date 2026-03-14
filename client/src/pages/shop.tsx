import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Coins, ShoppingCart, Star, Sparkles, Zap, Award, Image as ImageIcon, Package, Wrench, Shield, LogIn } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { PurchaseAnimation } from "@/components/PurchaseAnimation";

type Item = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  rarity: string;
  itemData: any;
  imageUrl: string | null;
  stock: number;
  isAvailable: boolean;
  itemType?: string;
  roleColor?: string;
};

type PurchaseStatus = "loading" | "success" | "error" | null;

export default function Shop() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { isAuthenticated, isGuest, user } = useAuth();
  const [, setLocation] = useLocation();
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>(null);
  const [purchasingItemName, setPurchasingItemName] = useState<string>("");

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/shop/items"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) => {
      setPurchaseStatus("loading");
      return await apiRequest("POST", "/api/shop/purchase", { itemId });
    },
    onSuccess: (data: any) => {
      setPurchaseStatus("success");
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
      queryClient.invalidateQueries({ queryKey: ["/auth/user"] });
      
      setTimeout(() => {
        setPurchaseStatus(null);
        toast({
          title: "🎉 " + t('common.success'),
          description: `${t('shop.buy')}. ${t('convert.youWillReceive')}: ${data.newBalance} LC`,
        });
      }, 2000);
    },
    onError: (error: any) => {
      setPurchaseStatus("error");
      
      setTimeout(() => {
        setPurchaseStatus(null);
        toast({
          variant: "destructive",
          title: "❌ " + t('common.error'),
          description: error.message,
        });
      }, 2000);
    },
  });

  const handlePurchase = (itemId: string, itemName: string) => {
    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: t('login.title'),
        description: t('login.description'),
      });
      setLocation('/login');
      return;
    }

    setPurchasingItemName(itemName);
    purchaseMutation.mutate({ itemId });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "booster":
        return <Zap className="h-5 w-5" />;
      case "badge":
        return <Award className="h-5 w-5" />;
      case "title":
        return <Star className="h-5 w-5" />;
      case "banner":
        return <ImageIcon className="h-5 w-5" />;
      case "collectible":
        return <Package className="h-5 w-5" />;
      case "service":
        return <Wrench className="h-5 w-5" />;
      case "role":
        return <Shield className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return <Badge className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-300 border-yellow-500/40 shadow-lg shadow-yellow-500/20">✨ Legendary</Badge>;
      case "epic":
        return <Badge className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-300 border-purple-500/40 shadow-lg shadow-purple-500/20">💎 Epic</Badge>;
      case "rare":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">⭐ Rare</Badge>;
      case "common":
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Common</Badge>;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case "booster": return t('shop.boosters');
      case "badge": return t('shop.badges');
      case "title": return t('shop.titles');
      case "banner": return t('shop.banners');
      case "collectible": return t('shop.collectibles');
      case "service": return t('shop.services');
      case "role": return t('shop.roles');
      default: return t('shop.allItems');
    }
  };

  const categories = items ? Array.from(new Set(items.map(item => item.category))) : [];

  const getRarityName = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "Легендарные";
      case "epic": return "Эпические";
      case "rare": return "Редкие";
      case "common": return "Обычные";
      default: return "Все";
    }
  };

  const filterItemsByRarity = (itemsToFilter: Item[]) => {
    if (rarityFilter === "all") return itemsToFilter;
    return itemsToFilter.filter(item => item.rarity === rarityFilter);
  };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center justify-center gap-3">
          <ShoppingCart className="h-10 w-10 text-primary" strokeWidth={1.5} />
          {t('shop.title')}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('shop.description')}
        </p>
      </div>

      {!isAuthenticated && (
        <div className="mb-8">
          <Card className="glass glass-border border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-6 w-6 text-primary" />
                {t('login.title')}
              </CardTitle>
              <CardDescription>
                {t('login.guestInfo')}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button 
                onClick={() => setLocation('/login')} 
                className="w-full"
                data-testid="button-goto-login"
              >
                {t('login.discord')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {isAuthenticated && user && (
        <div className="mb-8">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-primary" />
                {t('common.balance', 'Balance')}
              </CardTitle>
              <CardDescription>
                {user.username} • {user.lumiCoins || 0} LC
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="mb-6">
        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Фильтр по редкости
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setRarityFilter("all")}
                variant={rarityFilter === "all" ? "default" : "outline"}
                size="sm"
                data-testid="button-filter-all"
              >
                Все
              </Button>
              <Button
                onClick={() => setRarityFilter("legendary")}
                variant={rarityFilter === "legendary" ? "default" : "outline"}
                size="sm"
                className={rarityFilter === "legendary" ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600" : ""}
                data-testid="button-filter-legendary"
              >
                ✨ Легендарные
              </Button>
              <Button
                onClick={() => setRarityFilter("epic")}
                variant={rarityFilter === "epic" ? "default" : "outline"}
                size="sm"
                className={rarityFilter === "epic" ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" : ""}
                data-testid="button-filter-epic"
              >
                💎 Эпические
              </Button>
              <Button
                onClick={() => setRarityFilter("rare")}
                variant={rarityFilter === "rare" ? "default" : "outline"}
                size="sm"
                className={rarityFilter === "rare" ? "bg-blue-500 hover:bg-blue-600" : ""}
                data-testid="button-filter-rare"
              >
                ⭐ Редкие
              </Button>
              <Button
                onClick={() => setRarityFilter("common")}
                variant={rarityFilter === "common" ? "default" : "outline"}
                size="sm"
                className={rarityFilter === "common" ? "bg-gray-500 hover:bg-gray-600" : ""}
                data-testid="button-filter-common"
              >
                Обычные
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="">
        <TabsList className="glass glass-border mb-6 flex flex-wrap w-full gap-2 h-auto p-2">
          <TabsTrigger value="all">{t('shop.allItems')}</TabsTrigger>
          {categories.map(category => (
            <TabsTrigger key={category} value={category}>
              <span className="flex items-center gap-2">
                {getCategoryIcon(category)}
                {getCategoryName(category)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="glass glass-border">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : items && items.length > 0 ? (
              filterItemsByRarity(items).map((item) => (
                <Card key={item.id} className="glass glass-border hover-elevate transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(item.category)}
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                      </div>
                      {getRarityBadge(item.rarity)}
                    </div>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold neon-text-cyan">{item.price.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">LC</span>
                      </div>
                      {item.stock > 0 && item.stock !== -1 && (
                        <Badge variant="outline">
                          {t('shop.stock')}: {item.stock}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => handlePurchase(item.id, item.name)}
                      disabled={purchaseMutation.isPending || (item.stock <= 0 && item.stock !== -1) || !isAuthenticated}
                      className="w-full neon-glow-cyan"
                      data-testid={`button-purchase-${item.id}`}
                    >
                      {purchaseMutation.isPending ? t('shop.buying') : (item.stock <= 0 && item.stock !== -1) ? t('shop.outOfStock') : t('shop.buy')}
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">{t('shop.noItems')}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {categories.map(category => (
          <TabsContent key={category} value={category}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filterItemsByRarity(items?.filter(item => item.category === category) || [])
                .map((item) => (
                  <Card key={item.id} className="glass glass-border hover-elevate transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(item.category)}
                          <CardTitle className="text-lg">{item.name}</CardTitle>
                        </div>
                        {getRarityBadge(item.rarity)}
                      </div>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-primary" />
                          <span className="text-2xl font-bold neon-text-cyan">{item.price.toLocaleString()}</span>
                          <span className="text-sm text-muted-foreground">LC</span>
                        </div>
                        {item.stock > 0 && item.stock !== -1 && (
                          <Badge variant="outline">
                            {t('shop.stock')}: {item.stock}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={() => handlePurchase(item.id, item.name)}
                        disabled={purchaseMutation.isPending || (item.stock <= 0 && item.stock !== -1) || !isAuthenticated}
                        className="w-full neon-glow-cyan"
                        data-testid={`button-purchase-${item.id}`}
                      >
                        {purchaseMutation.isPending ? t('shop.buying') : (item.stock <= 0 && item.stock !== -1) ? t('shop.outOfStock') : t('shop.buy')}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Анимация покупки */}
      <PurchaseAnimation 
        status={purchaseStatus} 
        itemName={purchasingItemName}
      />
    </div>
  );
}
