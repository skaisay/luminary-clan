import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Package, Zap, Award, Star, Image as ImageIcon, Sparkles, Wrench } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

type InventoryItem = {
  inventoryId: string;
  quantity: number;
  acquiredAt: string;
  expiresAt: string | null;
  isEquipped: boolean;
  item: {
    id: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    itemData: any;
  };
};

export default function Inventory() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedDiscordId, setSelectedDiscordId] = useState("");
  const [nicknameDialog, setNicknameDialog] = useState<{ open: boolean; inventoryId: string | null; itemName: string }>({
    open: false,
    inventoryId: null,
    itemName: ""
  });
  const [newNickname, setNewNickname] = useState("");

  const { data: inventory, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory", selectedDiscordId],
    enabled: !!selectedDiscordId,
  });

  const useNicknameMutation = useMutation({
    mutationFn: async ({ inventoryId, newNickname, discordId }: { inventoryId: string; newNickname: string; discordId: string }) => {
      const response = await apiRequest("POST", "/api/items/use-nickname-change", { inventoryId, newNickname, discordId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ " + t('common.success'),
        description: `Ваш новый никнейм на сервере: "${data.newNickname}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory", selectedDiscordId] });
      setNicknameDialog({ open: false, inventoryId: null, itemName: "" });
      setNewNickname("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "❌ " + t('common.error'),
        description: error.message || t('common.error'),
      });
    },
  });

  const handleUseNicknameChange = (inventoryId: string, itemName: string) => {
    setNicknameDialog({ open: true, inventoryId, itemName });
  };

  const confirmNicknameChange = () => {
    if (!nicknameDialog.inventoryId || !newNickname.trim() || !selectedDiscordId) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('inventory.discordIdPlaceholder'),
      });
      return;
    }

    if (newNickname.length > 32) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: "Nickname cannot be longer than 32 characters",
      });
      return;
    }

    useNicknameMutation.mutate({ 
      inventoryId: nicknameDialog.inventoryId, 
      newNickname: newNickname.trim(),
      discordId: selectedDiscordId
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "booster":
        return <Zap className="h-5 w-5 text-yellow-400" />;
      case "badge":
        return <Award className="h-5 w-5 text-purple-400" />;
      case "title":
        return <Star className="h-5 w-5 text-cyan-400" />;
      case "banner":
        return <ImageIcon className="h-5 w-5 text-pink-400" />;
      case "collectible":
        return <Package className="h-5 w-5 text-blue-400" />;
      case "service":
        return <Wrench className="h-5 w-5 text-green-400" />;
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

  const isNicknameChangeService = (itemData: any) => {
    return itemData?.serviceType === 'nickname_change' || itemData?.serviceType === 'nickname_change_vip';
  };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center justify-center gap-3">
          <Package className="h-10 w-10 text-primary" strokeWidth={1.5} />
          {t('inventory.title')}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('inventory.description')}
        </p>
      </div>

      <div className="mb-8">
        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              {t('inventory.title')}
            </CardTitle>
            <CardDescription>
              {t('inventory.discordIdDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              value={selectedDiscordId}
              onChange={(e) => setSelectedDiscordId(e.target.value)}
              placeholder={t('inventory.discordIdPlaceholder')}
              className="glass glass-border"
              data-testid="input-discord-id"
            />
          </CardContent>
        </Card>
      </div>

      {selectedDiscordId && (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="glass glass-border">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : inventory && inventory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map((item) => (
                <Card key={item.inventoryId} className="glass glass-border hover-elevate transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(item.item.category)}
                        <CardTitle className="text-lg">{item.item.name}</CardTitle>
                      </div>
                      {getRarityBadge(item.item.rarity)}
                    </div>
                    <CardDescription>{item.item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {item.quantity > 1 && (
                        <Badge variant="secondary">
                          {t('inventory.quantity')}: {item.quantity}
                        </Badge>
                      )}
                      {item.expiresAt && (
                        <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">
                          {t('inventory.expires')}: {new Date(item.expiresAt).toLocaleDateString()}
                        </Badge>
                      )}
                      {item.isEquipped && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          ✓ {t('inventory.equipped')}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  {isNicknameChangeService(item.item.itemData) && (
                    <CardFooter>
                      <Button
                        onClick={() => handleUseNicknameChange(item.inventoryId, item.item.name)}
                        className="w-full neon-glow-cyan"
                        data-testid={`button-use-${item.inventoryId}`}
                      >
                        Использовать
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass glass-border">
              <CardContent className="py-12">
                <div className="text-center">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground text-lg">Инвентарь пуст</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Купите предметы в магазине, чтобы они появились здесь
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={nicknameDialog.open} onOpenChange={(open) => setNicknameDialog({ open, inventoryId: null, itemName: "" })}>
        <DialogContent className="glass glass-border">
          <DialogHeader>
            <DialogTitle className="neon-text-cyan">Смена никнейма на сервере</DialogTitle>
            <DialogDescription>
              Используйте "{nicknameDialog.itemName}" чтобы изменить свой никнейм на Discord сервере
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="Введите новый никнейм (макс. 32 символа)"
              maxLength={32}
              className="glass glass-border"
              data-testid="input-new-nickname"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Осталось символов: {32 - newNickname.length}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNicknameDialog({ open: false, inventoryId: null, itemName: "" })}
              data-testid="button-cancel-nickname"
            >
              Отмена
            </Button>
            <Button
              onClick={confirmNicknameChange}
              disabled={useNicknameMutation.isPending || !newNickname.trim()}
              className="neon-glow-cyan"
              data-testid="button-confirm-nickname"
            >
              {useNicknameMutation.isPending ? "Изменение..." : "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
