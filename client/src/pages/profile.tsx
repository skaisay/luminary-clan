import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  User, Trophy, Coins, Zap, Shield, Star, Clock, BarChart3,
  Loader2, Flame, Medal, Crown, Package, Award, TrendingUp,
  Search, ArrowLeftRight, ArrowLeft, ExternalLink, Copy, Check, Pencil, Save, X as XIcon, Upload, Sparkles, Share2, Download, Image as ImageIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams } from "wouter";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAllDecorations } from "@/components/member-decorations";
import { AvatarFrame, StyledUsername, UserBadges, useEquippedBanner } from "@/components/UserBadges";
import { MemberDecorations } from "@/components/member-decorations";

interface MemberProfile {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  role: string;
  rank: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  lumiCoins: number;
  experience: number;
  level: number;
  equippedTitle: string | null;
  equippedBanner: string | null;
  joinedAt: string;
}

interface ProfileAchievement {
  userAchievementId: string;
  progress: number;
  isCompleted: boolean;
  completedAt: string | null;
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string | null;
    category: string;
  };
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  rarity: string;
  quantity: number;
  isEquipped: boolean;
}

const rankBadges: Record<string, { ru: string; en: string; color: string; icon: any }> = {
  legend: { ru: "Легенда", en: "Legend", color: "text-yellow-400 bg-yellow-500/10", icon: Crown },
  elite: { ru: "Элита", en: "Elite", color: "text-purple-400 bg-purple-500/10", icon: Star },
  veteran: { ru: "Ветеран", en: "Veteran", color: "text-blue-400 bg-blue-500/10", icon: Shield },
  fighter: { ru: "Боец", en: "Fighter", color: "text-green-400 bg-green-500/10", icon: Medal },
};

function getRankTitle(level: number): { ru: string; en: string; color: string; icon: any } {
  if (level >= 50) return rankBadges.legend;
  if (level >= 30) return rankBadges.elite;
  if (level >= 15) return rankBadges.veteran;
  return rankBadges.fighter;
}

function getXpForNextLevel(level: number): number {
  return level * 100 + 50;
}

// ============= DECORATIONS MODAL =============
const rarityColors: Record<string, string> = {
  common: "text-gray-400 border-gray-600/40",
  uncommon: "text-green-400 border-green-600/40",
  rare: "text-blue-400 border-blue-600/40",
  epic: "text-purple-400 border-purple-600/40",
  legendary: "text-yellow-400 border-yellow-600/40 shadow-yellow-500/10 shadow-lg",
};
const rarityLabels: Record<string, string> = {
  common: "⬜ Common", uncommon: "🟩 Uncommon", rare: "🟦 Rare", epic: "🟪 Epic", legendary: "🟨 Legendary",
};
const typeIcons: Record<string, string> = {
  badge: "🏅", avatar_frame: "🖼️", profile_effect: "✨", banner: "🎨", name_color: "🌈",
};

type DecModalDecoration = {
  id: string; name: string; description: string | null; type: string; emoji: string | null;
  imageUrl: string | null; cssEffect: string | null; color: string | null;
  rarity: string; price: number; category: string | null;
  maxOwners: number | null; currentOwners: number;
};
type DecModalOwned = {
  memberDecorationId: string; decorationId: string; isEquipped: boolean;
  decoration: DecModalDecoration;
};

function DecorationPreview({ dec }: { dec: DecModalDecoration }) {
  const isRu = true;
  if (dec.type === 'badge') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border/30">
        <span className="text-lg">{isRu ? 'Имя игрока' : 'Player Name'}</span>
        <span className="text-xl" style={{ color: dec.color || undefined, filter: dec.cssEffect || undefined }}>{dec.emoji || "✦"}</span>
      </div>
    );
  }
  if (dec.type === 'name_color') {
    const style: Record<string, string> = {};
    (dec.cssEffect || '').split(';').forEach(rule => {
      const [prop, val] = rule.split(':').map(s => s.trim());
      if (prop && val) style[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
    });
    return (
      <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
        <span className="text-lg font-bold" style={style}>{isRu ? 'Имя игрока' : 'Player Name'}</span>
      </div>
    );
  }
  if (dec.type === 'avatar_frame') {
    const isSquare = (dec.cssEffect || '').includes('rounded-lg');
    const shapeClass = isSquare ? 'rounded-lg' : 'rounded-full';
    return (
      <div className="flex justify-center p-3">
        <div className={`w-16 h-16 ${shapeClass} bg-gradient-to-br from-primary/30 to-accent/30 ${dec.cssEffect || ''}`}>
          <div className={`w-full h-full ${shapeClass} bg-muted/50 flex items-center justify-center text-lg`}>👤</div>
        </div>
      </div>
    );
  }
  if (dec.type === 'banner') {
    return (
      <div className="h-12 rounded-lg" style={{ background: dec.cssEffect || `linear-gradient(135deg, ${dec.color || '#666'}, #222)` }} />
    );
  }
  if (dec.type === 'profile_effect') {
    return (
      <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-center">
        <span className="text-2xl">{dec.emoji || "✨"}</span>
        <p className="text-[10px] text-muted-foreground mt-1">{dec.cssEffect || 'visual effect'}</p>
      </div>
    );
  }
  return null;
}

function DecorationsModal({ open, onOpenChange, discordId, isOwnProfile }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  discordId: string; isOwnProfile: boolean;
}) {
  const { isAuthenticated, updateBalance } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isRu = (language || 'ru') === 'ru';
  const [activeType, setActiveType] = useState("all");
  const [viewMode, setViewMode] = useState<"shop" | "collection">("shop");
  const [selectedDec, setSelectedDec] = useState<DecModalDecoration | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [equippingId, setEquippingId] = useState<string | null>(null);

  const { data: allDecorations } = useQuery<DecModalDecoration[]>({
    queryKey: ["/api/decorations"],
    enabled: open,
  });

  const { data: owned } = useQuery<DecModalOwned[]>({
    queryKey: ["/api/decorations/my"],
    enabled: open && isAuthenticated,
  });

  const buyMutation = useMutation({
    mutationFn: async (decorationId: string) => {
      setBuyingId(decorationId);
      const resp = await apiRequest("POST", "/api/decorations/buy", { decorationId });
      return resp.json();
    },
    onSuccess: (data: any) => {
      setBuyingId(null);
      if (data.newBalance !== undefined) updateBalance(data.newBalance);
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decorations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/all-equipped"] });
      // Refresh profile balance too
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith('/api/profile/') });
      toast({ title: isRu ? "Куплено!" : "Purchased!", description: data.message });
    },
    onError: (err: any) => {
      setBuyingId(null);
      toast({ title: isRu ? "Ошибка" : "Error", description: err?.message || "Failed", variant: "destructive" });
    },
  });

  const equipMutation = useMutation({
    mutationFn: async ({ decorationId, equip }: { decorationId: string; equip: boolean }) => {
      setEquippingId(decorationId);
      const resp = await apiRequest("POST", "/api/decorations/equip", { decorationId, equip });
      return resp.json();
    },
    onSuccess: () => {
      setEquippingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decorations/all-equipped"] });
      toast({ title: isRu ? "✅ Готово!" : "✅ Done!" });
    },
    onError: (err: any) => {
      setEquippingId(null);
      toast({ title: isRu ? "Ошибка" : "Error", description: err?.message || "Failed", variant: "destructive" });
    },
  });

  const ownedMap = new Map<string, DecModalOwned>();
  owned?.forEach(o => ownedMap.set(o.decorationId, o));

  const types = ["all", "badge", "name_color", "avatar_frame", "profile_effect", "banner"];
  const typeLabelsMap: Record<string, string> = {
    all: isRu ? "Все" : "All",
    badge: isRu ? "Значки" : "Badges",
    name_color: isRu ? "Цвета" : "Colors",
    avatar_frame: isRu ? "Рамки" : "Frames",
    profile_effect: isRu ? "Эффекты" : "Effects",
    banner: isRu ? "Баннеры" : "Banners",
  };

  // In shop mode — filter all decorations; in collection mode — only owned
  const baseList = viewMode === "collection"
    ? (owned || []).map(o => o.decoration)
    : (allDecorations || []);

  const filtered = baseList.filter(d => activeType === "all" || d.type === activeType);
  const sorted = [...filtered].sort((a, b) => {
    const rarityOrder = ["legendary", "epic", "rare", "uncommon", "common"];
    if (viewMode === "shop") {
      const aOwned = ownedMap.has(a.id) ? 0 : 1;
      const bOwned = ownedMap.has(b.id) ? 0 : 1;
      if (aOwned !== bOwned) return aOwned - bOwned;
    }
    return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 bg-background/80 backdrop-blur-xl border-white/10">
        <DialogHeader className="px-6 pt-5 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            {isRu ? "Декорации" : "Decorations"}
            <Badge variant="outline" className="ml-2 text-xs">
              {owned?.length ?? 0} / {allDecorations?.length ?? 0}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Mode & type filter */}
        <div className="px-6 flex flex-col gap-2 shrink-0">
          {/* Shop / Collection toggle */}
          {isOwnProfile && isAuthenticated && (
            <div className="flex gap-1">
              <Button size="sm" variant={viewMode === "shop" ? "default" : "ghost"}
                className="h-7 text-xs gap-1" onClick={() => { setViewMode("shop"); setSelectedDec(null); }}>
                🛒 {isRu ? "Магазин" : "Shop"}
              </Button>
              <Button size="sm" variant={viewMode === "collection" ? "default" : "ghost"}
                className="h-7 text-xs gap-1" onClick={() => { setViewMode("collection"); setSelectedDec(null); }}>
                📦 {isRu ? "Моя коллекция" : "My Collection"} ({owned?.length ?? 0})
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {types.map(tp => (
              <Button key={tp} size="sm" variant={activeType === tp ? "default" : "ghost"}
                className="h-6 text-[10px] gap-0.5 px-2" onClick={() => setActiveType(tp)}>
                {typeIcons[tp] || "📦"} {typeLabelsMap[tp]}
              </Button>
            ))}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* Items grid — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-3 decor-scroll">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {sorted.map(dec => {
                const myOwned = ownedMap.get(dec.id);
                const isOwned = !!myOwned;
                const isEquipped = myOwned?.isEquipped ?? false;
                const isSoldOut = dec.maxOwners !== null && dec.maxOwners > 0 && dec.currentOwners >= dec.maxOwners;
                const isSelected = selectedDec?.id === dec.id;

                return (
                  <div key={dec.id}
                    onClick={() => setSelectedDec(isSelected ? null : dec)}
                    className={`relative rounded-xl border p-2.5 cursor-pointer transition-colors ${
                      rarityColors[dec.rarity] || "border-border/40"
                    } ${isOwned ? "bg-white/5" : "bg-background/30 opacity-70"} ${
                      isSelected ? "ring-2 ring-purple-500/60" : ""
                    }`}>
                    <div className="text-xl mb-0.5">{dec.emoji || typeIcons[dec.type] || "✦"}</div>
                    <p className="text-[11px] font-semibold truncate" style={{ color: dec.color || undefined }}>{dec.name}</p>
                    <p className="text-[9px] text-muted-foreground">{rarityLabels[dec.rarity]}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-yellow-500">
                      <Coins className="h-2.5 w-2.5" /> {dec.price.toLocaleString()}
                    </div>
                    <div className="flex gap-0.5 mt-1 flex-wrap">
                      {isOwned && <Badge variant="outline" className="text-[8px] h-3.5 bg-green-500/10 text-green-400 border-green-600/30 px-1">✓</Badge>}
                      {isEquipped && <Badge variant="outline" className="text-[8px] h-3.5 bg-purple-500/10 text-purple-400 border-purple-600/30 px-1">⚡</Badge>}
                      {isSoldOut && !isOwned && <Badge variant="outline" className="text-[8px] h-3.5 bg-red-500/10 text-red-400 border-red-600/30 px-1">✕</Badge>}
                    </div>
                    {/* Inline action buttons on each card */}
                    {isOwnProfile && isAuthenticated && (
                      <div className="mt-1.5 flex gap-1" onClick={e => e.stopPropagation()}>
                        {!isOwned && !isSoldOut && (
                          <Button size="sm" className="h-5 text-[9px] flex-1 px-1" variant="outline"
                            disabled={buyingId === dec.id} onClick={() => buyMutation.mutate(dec.id)}>
                            {buyingId === dec.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> :
                             (isRu ? "Купить" : "Buy")}
                          </Button>
                        )}
                        {isOwned && (
                          <Button size="sm" className={`h-5 text-[9px] flex-1 px-1 ${isEquipped ? "bg-purple-600/20" : ""}`}
                            variant="outline" disabled={equippingId === dec.id}
                            onClick={() => equipMutation.mutate({ decorationId: dec.id, equip: !isEquipped })}>
                            {equippingId === dec.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> :
                             isEquipped ? (isRu ? "Снять" : "Unequip") : (isRu ? "Надеть" : "Equip")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {sorted.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{viewMode === "collection" ? (isRu ? "У вас пока нет декораций" : "No decorations yet") :
                  (isRu ? "Декорации не найдены" : "No decorations found")}</p>
              </div>
            )}
          </div>

          {/* Preview panel — sidebar on sm+, bottom strip on mobile */}
          {selectedDec && (
            <div className="sm:w-64 shrink-0 border-t sm:border-t-0 sm:border-l border-white/10 p-4 overflow-y-auto flex flex-col gap-3 bg-background/40 max-h-[35vh] sm:max-h-none decor-scroll">
              <div className="flex sm:flex-col items-center sm:items-stretch gap-3">
                <div className="text-3xl sm:text-center">{selectedDec.emoji || typeIcons[selectedDec.type] || "✦"}</div>
                <div className="flex-1 sm:text-center">
                  <h3 className="text-sm font-bold" style={{ color: selectedDec.color || undefined }}>{selectedDec.name}</h3>
                  <p className="text-[10px] text-muted-foreground">{rarityLabels[selectedDec.rarity]}</p>
                </div>
              </div>
              {selectedDec.description && <p className="text-xs text-muted-foreground">{selectedDec.description}</p>}

              {/* Visual preview */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 font-semibold">{isRu ? "Предпросмотр:" : "Preview:"}</p>
                <DecorationPreview dec={selectedDec} />
              </div>

              <div className="flex items-center gap-1 text-sm text-yellow-500 justify-center">
                <Coins className="h-4 w-4" /> {selectedDec.price.toLocaleString()} LC
              </div>

              {/* Action buttons */}
              {isOwnProfile && isAuthenticated && (() => {
                const myOwned = ownedMap.get(selectedDec.id);
                const isOwned = !!myOwned;
                const isEquipped = myOwned?.isEquipped ?? false;
                const isSoldOut = selectedDec.maxOwners !== null && selectedDec.maxOwners > 0 && selectedDec.currentOwners >= selectedDec.maxOwners;
                return (
                  <div className="flex flex-col gap-1.5">
                    {!isOwned && !isSoldOut && (
                      <Button size="sm" className="w-full h-8 text-xs" disabled={buyingId === selectedDec.id}
                        onClick={() => buyMutation.mutate(selectedDec.id)}>
                        {buyingId === selectedDec.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        {isRu ? "Купить" : "Buy"}
                      </Button>
                    )}
                    {isOwned && (
                      <Button size="sm" className={`w-full h-8 text-xs ${isEquipped ? "bg-purple-600/20" : ""}`}
                        variant="outline" disabled={equippingId === selectedDec.id}
                        onClick={() => equipMutation.mutate({ decorationId: selectedDec.id, equip: !isEquipped })}>
                        {equippingId === selectedDec.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        {isEquipped ? (isRu ? "Снять" : "Unequip") : (isRu ? "Надеть" : "Equip")}
                      </Button>
                    )}
                    {isOwned && (
                      <Badge variant="outline" className="text-xs justify-center py-1 bg-green-500/10 text-green-400 border-green-600/30">
                        {isRu ? "В коллекции ✓" : "Owned ✓"}
                      </Badge>
                    )}
                    {isSoldOut && !isOwned && (
                      <Badge variant="outline" className="text-xs justify-center py-1 bg-red-500/10 text-red-400">
                        {isRu ? "Распродано" : "Sold out"}
                      </Badge>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const params = useParams<{ discordId?: string }>();
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [screenshotting, setScreenshotting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDecorations, setShowDecorations] = useState(false);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const ogReadyRef = useRef(false);
  const { toast } = useToast();
  const bannerFileRef = useRef<HTMLInputElement>(null);

  interface CustomProfileData {
    bannerColor1: string;
    bannerColor2: string;
    cardColor: string;
    bio: string;
    customAvatar: string;
    bannerImage: string;
    hiddenSections: string[];
    robloxUsername: string;
  }

  const defaultCustom: CustomProfileData = {
    bannerColor1: "",
    bannerColor2: "",
    cardColor: "",
    bio: "",
    customAvatar: "",
    bannerImage: "",
    hiddenSections: [],
    robloxUsername: "",
  };

  const [editData, setEditData] = useState<CustomProfileData>(defaultCustom);

  const targetDiscordId = params.discordId || user?.discordId;
  const isOwnProfile = !params.discordId || params.discordId === user?.discordId;

  // Load custom profile data from server (visible to all users)
  const { data: customData } = useQuery<CustomProfileData>({
    queryKey: [`/api/profile-custom/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  const cd = customData || defaultCustom;

  // Sync editData when customData loads
  useEffect(() => {
    if (customData) {
      setEditData({ ...defaultCustom, ...customData });
    }
  }, [customData]);

  const saveMutation = useMutation({
    mutationFn: async (data: CustomProfileData) => {
      const resp = await apiRequest("POST", `/api/profile-custom/${targetDiscordId}`, data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profile-custom/${targetDiscordId}`] });
      setEditing(false);
      toast({ title: language === 'ru' ? '✅ Профиль сохранён' : '✅ Profile saved' });
    },
    onError: (error: any) => {
      toast({ title: language === 'ru' ? '❌ Ошибка сохранения' : '❌ Save error', description: error.message, variant: 'destructive' });
    },
  });

  const saveCustomProfile = () => {
    if (targetDiscordId) {
      saveMutation.mutate(editData);
    } else {
      toast({ title: language === 'ru' ? '❌ Не авторизован' : '❌ Not authorized', variant: 'destructive' });
    }
  };

  // Upload banner image
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: language === 'ru' ? '❌ Макс. размер 5MB' : '❌ Max size 5MB', variant: 'destructive' });
      return;
    }
    const formData = new FormData();
    formData.append('banner', file);
    try {
      const resp = await fetch(`/api/profile-banner-upload/${targetDiscordId}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      if (data.url) {
        setEditData(d => ({ ...d, bannerImage: data.url }));
        toast({ title: language === 'ru' ? '✅ Баннер загружен' : '✅ Banner uploaded' });
      }
    } catch (err: any) {
      toast({ title: language === 'ru' ? '❌ Ошибка загрузки' : '❌ Upload error', description: err.message, variant: 'destructive' });
    }
  };

  const cancelEditing = () => {
    setEditData({ ...defaultCustom, ...cd });
    setEditing(false);
  };

  const toggleHiddenSection = (section: string) => {
    setEditData(d => ({
      ...d,
      hiddenSections: d.hiddenSections.includes(section)
        ? d.hiddenSections.filter(s => s !== section)
        : [...d.hiddenSections, section],
    }));
  };

  const { data: profile, isLoading: loadingProfile } = useQuery<MemberProfile>({
    queryKey: [`/api/profile/${targetDiscordId}`],
    enabled: !!targetDiscordId,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });

  const { data: achievements, isLoading: loadingAchievements } = useQuery<ProfileAchievement[]>({
    queryKey: [`/api/achievements/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  const { data: inventory } = useQuery<InventoryItem[]>({
    queryKey: [`/api/inventory/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  const { data: allEquippedData } = useAllDecorations(); // keep query warm + pass to MemberDecorations
  const equippedBanner = useEquippedBanner(targetDiscordId || undefined);

  // Helper: capture profile card screenshot and upload as OG image
  const captureAndUploadOG = async (discordId: string): Promise<boolean> => {
    if (!profileCardRef.current) return false;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(profileCardRef.current, {
        backgroundColor: '#0f0a1e',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
      if (blob) {
        await fetch(`/api/og-screenshot/${discordId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: blob,
        });
        return true;
      }
    } catch (_) { /* silent */ }
    return false;
  };

  // Auto-capture OG screenshot when profile card is rendered (ensures fresh preview)
  useEffect(() => {
    const discordId = profile?.discordId;
    if (!discordId || !profileCardRef.current) return;
    ogReadyRef.current = false;
    const timer = setTimeout(async () => {
      const ok = await captureAndUploadOG(discordId);
      if (ok) ogReadyRef.current = true;
    }, 3000); // wait 3s for images/banner to load
    return () => clearTimeout(timer);
  }, [profile?.discordId, customData]);

  const handleSearch = () => {
    const q = searchInput.trim();
    if (!q) return;
    navigate(`/profile/${q}`);
    setSearchInput("");
  };

  const handleCopyId = () => {
    if (profile?.discordId) {
      navigator.clipboard.writeText(profile.discordId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleShareLink = async () => {
    const discordId = profile?.discordId || targetDiscordId;
    if (!discordId) return;
    const url = `${window.location.origin}/profile/${discordId}`;

    // If auto-capture hasn't finished yet — capture + upload BEFORE copying link
    if (!ogReadyRef.current && profileCardRef.current) {
      setSharing(true);
      const ok = await captureAndUploadOG(discordId);
      if (ok) ogReadyRef.current = true;
      setSharing(false);
    }

    // Copy URL
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopiedLink(true);
    toast({ title: isRu ? '✅ Ссылка скопирована!' : '✅ Link copied!', description: isRu ? 'Превью профиля актуально ✓' : 'Profile preview is up to date ✓' });
    setTimeout(() => setCopiedLink(false), 2500);

    // Re-capture in background for next time
    if (profileCardRef.current) {
      captureAndUploadOG(discordId).then(ok => { if (ok) ogReadyRef.current = true; });
    }
  };

  const handleScreenshot = async () => {
    if (!profileCardRef.current || screenshotting) return;
    setScreenshotting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(profileCardRef.current, {
        backgroundColor: '#0f0a1e',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      // Try to copy to clipboard first, then fallback to download
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast({ title: isRu ? '📸 Скриншот скопирован!' : '📸 Screenshot copied!', description: isRu ? 'Вставьте в любой чат' : 'Paste anywhere' });
        } catch {
          // Fallback: download as file
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `luminary-${profile?.username || 'profile'}.png`;
          a.click();
          URL.revokeObjectURL(a.href);
          toast({ title: isRu ? '📸 Сохранено!' : '📸 Saved!', description: isRu ? 'Скриншот профиля скачан' : 'Profile screenshot downloaded' });
        }
      }, 'image/png');
    } catch (err: any) {
      toast({ title: isRu ? 'Ошибка' : 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setScreenshotting(false);
    }
  };

  if (!targetDiscordId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">{t('profile.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('profile.loginHint')}</p>
        <div className="flex gap-2 max-w-md mx-auto">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={t('profile.searchPlaceholder')}
            className="glass glass-border"
          />
          <Button onClick={handleSearch} className="gap-1.5">
            <Search className="h-4 w-4" /> {t('profile.find')}
          </Button>
        </div>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24 text-center">
        <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">{t('profile.notFound')}</h1>
        <p className="text-muted-foreground">{t('profile.notFoundDesc')}</p>
      </div>
    );
  }

  const rankInfo = getRankTitle(profile.level);
  const RankIcon = rankInfo.icon;
  const xpForNext = getXpForNextLevel(profile.level);
  const xpProgress = Math.min(100, Math.round((profile.experience % xpForNext) / xpForNext * 100));
  const completedAchievements = achievements?.filter(a => a.isCompleted) || [];
  const kd = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills.toString();
  const winRate = (profile.wins + profile.losses) > 0
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl pt-24">
      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <Button onClick={() => window.history.back()} variant="outline" size="icon" className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={t('profile.searchMember')}
          className="glass glass-border"
        />
        <Button onClick={handleSearch} size="icon" variant="outline">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Profile Header */}
      <Card ref={profileCardRef} className="glass glass-border overflow-hidden mb-6 relative" style={cd.cardColor ? { borderColor: cd.cardColor + '40' } : undefined}>
        {/* Banner — covers the ENTIRE card as absolute background */}
        {(() => {
          const hasBannerImage = !!cd.bannerImage;
          const hasBannerColors = !!cd.bannerColor1;
          const hasBannerDecor = !!equippedBanner?.cssEffect;
          let bannerStyle: React.CSSProperties | undefined;
          if (hasBannerColors && !hasBannerImage) {
            bannerStyle = { background: `linear-gradient(to right, ${cd.bannerColor1}, ${cd.bannerColor2 || cd.bannerColor1})` };
          } else if (!hasBannerImage && !hasBannerColors && hasBannerDecor) {
            const parsed: Record<string, string> = {};
            equippedBanner!.cssEffect!.split(";").forEach((rule: string) => {
              const idx = rule.indexOf(":");
              if (idx === -1) {
                if (rule.trim()) parsed.background = rule.trim();
                return;
              }
              const prop = rule.slice(0, idx).trim();
              const val = rule.slice(idx + 1).trim();
              if (prop && val) {
                const camelProp = prop.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
                parsed[camelProp] = val;
              }
            });
            if (!parsed.background) parsed.background = equippedBanner!.cssEffect!;
            bannerStyle = parsed as React.CSSProperties;
          }
          return (
            <div className="absolute inset-0 z-0" style={bannerStyle}>
              {hasBannerImage && (
                <img src={cd.bannerImage} alt="" className="w-full h-full object-cover" />
              )}
              {!hasBannerImage && !hasBannerColors && !hasBannerDecor && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-[hsl(var(--accent))]/30" />
              )}
              {/* Subtle dark overlay at bottom for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            </div>
          );
        })()}
        <CardContent className="relative z-10 pt-24 pb-6">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <AvatarFrame discordId={profile.discordId}>
              <Avatar className="w-24 h-24 border-4 border-background shadow-xl">
                <AvatarImage src={cd.customAvatar || profile.avatar || undefined} />
                <AvatarFallback className="text-2xl">{profile.username[0]}</AvatarFallback>
              </Avatar>
            </AvatarFrame>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold flex items-center gap-1.5">
                  <StyledUsername discordId={profile.discordId} username={profile.username} />
                  <UserBadges discordId={profile.discordId} />
                  <MemberDecorations discordId={profile.discordId} decorations={allEquippedData} />
                </h1>
                {profile.equippedTitle && (
                  <Badge variant="secondary" className="text-xs">{profile.equippedTitle}</Badge>
                )}
                {isOwnProfile && !editing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 rounded-full opacity-60 hover:opacity-100"
                    onClick={() => setEditing(true)}
                    title={t('profile.editProfile')}
                    data-ai="profile-edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <Badge variant="outline" className={`${rankInfo.color} gap-1`}>
                  <RankIcon className="h-3 w-3" /> {rankInfo[language as 'ru' | 'en'] || rankInfo.ru}
                </Badge>
                <span className="text-sm text-muted-foreground">{profile.role}</span>
                {!cd.hiddenSections?.includes('xpLevel') && <span className="text-sm text-muted-foreground">{t('profile.level')} {profile.level}</span>}
              </div>
              {/* XP Progress */}
              {!cd.hiddenSections?.includes('xpLevel') && (
              <div className="mt-3 max-w-md">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('profile.experience')}</span>
                  <span>{profile.experience % xpForNext} / {xpForNext} XP</span>
                </div>
                <Progress value={xpProgress} className="h-2" />
              </div>
              )}
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-1.5 text-yellow-500 justify-end">
                <Coins className="h-5 w-5" />
                <span className="text-xl font-bold">{profile.lumiCoins?.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">LumiCoins</p>
              <div className="flex gap-1 justify-end">
                <button onClick={handleShareLink} disabled={sharing} className="group inline-flex items-center gap-0 h-7 px-1.5 rounded-md border border-border/60 bg-background/40 hover:bg-white/10 transition-all duration-300 ease-in-out hover:gap-1.5 hover:px-2.5 text-muted-foreground hover:text-white disabled:opacity-50">
                  {sharing ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : copiedLink ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Share2 className="h-3.5 w-3.5 shrink-0" />}
                  <span className="text-xs font-medium max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[80px]">{isRu ? 'Поделиться' : 'Share'}</span>
                </button>
                <button onClick={handleScreenshot} disabled={screenshotting} className="group inline-flex items-center gap-0 h-7 px-1.5 rounded-md border border-border/60 bg-background/40 hover:bg-white/10 transition-all duration-300 ease-in-out hover:gap-1.5 hover:px-2.5 text-muted-foreground hover:text-white disabled:opacity-50">
                  {screenshotting ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0" />}
                  <span className="text-xs font-medium max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[80px]">{isRu ? 'Скрин' : 'Snap'}</span>
                </button>
                <button onClick={handleCopyId} className="group inline-flex items-center gap-0 h-7 px-1.5 rounded-md border border-border/60 bg-background/40 hover:bg-white/10 transition-all duration-300 ease-in-out hover:gap-1.5 hover:px-2.5 text-muted-foreground hover:text-white">
                  {copiedId ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                  <span className="text-xs font-medium max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[80px]">ID</span>
                </button>
                <button onClick={() => setShowDecorations(true)} className="group inline-flex items-center gap-0 h-7 px-1.5 rounded-md border border-border/60 bg-background/40 hover:bg-white/10 transition-all duration-300 ease-in-out hover:gap-1.5 hover:px-2.5 text-muted-foreground hover:text-white">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[80px]">{isRu ? 'Декор' : 'Decor'}</span>
                </button>
                {!isOwnProfile && user?.discordId && (
                  <Link href={`/trading?target=${encodeURIComponent(profile.username)}`}>
                    <button className="group inline-flex items-center gap-0 h-7 px-1.5 rounded-md border border-border/60 bg-background/40 hover:bg-white/10 transition-all duration-300 ease-in-out hover:gap-1.5 hover:px-2.5 text-muted-foreground hover:text-white">
                      <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs font-medium max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[80px]">{isRu ? 'Трейд' : 'Trade'}</span>
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {cd.bio && !editing && (
            <p className="text-sm text-muted-foreground mt-4 italic">{cd.bio}</p>
          )}

          {/* Edit Panel */}
          {editing && isOwnProfile && (
            <div className="mt-4 p-4 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('profile.bannerColor')}</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editData.bannerColor1 || "#6366f1"}
                      onChange={e => setEditData(d => ({ ...d, bannerColor1: e.target.value }))}
                      className="w-10 h-9 p-1 cursor-pointer"
                    />
                    <Input
                      type="color"
                      value={editData.bannerColor2 || "#8b5cf6"}
                      onChange={e => setEditData(d => ({ ...d, bannerColor2: e.target.value }))}
                      className="w-10 h-9 p-1 cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground self-center">Gradient</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('profile.cardColor')}</label>
                  <Input
                    type="color"
                    value={editData.cardColor || "#6366f1"}
                    onChange={e => setEditData(d => ({ ...d, cardColor: e.target.value }))}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('profile.bio')}</label>
                <Textarea
                  value={editData.bio}
                  onChange={e => setEditData(d => ({ ...d, bio: e.target.value }))}
                  placeholder={t('profile.bioPlaceholder')}
                  className="glass glass-border resize-none h-20"
                  maxLength={200}
                  data-ai="profile-bio"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('profile.customAvatar')}</label>
                <Input
                  value={editData.customAvatar}
                  onChange={e => setEditData(d => ({ ...d, customAvatar: e.target.value }))}
                  placeholder={t('profile.avatarPlaceholder')}
                  className="glass glass-border"
                  data-ai="profile-avatar"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('profile.bannerImage')}</label>
                <div className="flex gap-2">
                  <Input
                    value={editData.bannerImage}
                    onChange={e => setEditData(d => ({ ...d, bannerImage: e.target.value }))}
                    placeholder={t('profile.bannerImagePlaceholder')}
                    className="glass glass-border flex-1"
                    data-ai="profile-banner"
                  />
                  <input
                    ref={bannerFileRef}
                    type="file"
                    accept="image/*,.gif"
                    className="hidden"
                    onChange={handleBannerUpload}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    onClick={() => bannerFileRef.current?.click()}
                    title={language === 'ru' ? 'Загрузить файл' : 'Upload file'}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('profile.bannerImageHint')}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">🎮 Roblox никнейм</label>
                <Input
                  value={editData.robloxUsername}
                  onChange={e => setEditData(d => ({ ...d, robloxUsername: e.target.value }))}
                  placeholder="Ваш ник в Roblox"
                  className="glass glass-border"
                  maxLength={30}
                  data-ai="profile-roblox"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Для отображения 3D аватара на главной</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{t('profile.showSections')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['stats', 'achievements', 'info', 'inventory', 'xpLevel'] as const).map(section => (
                    <label key={section} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!editData.hiddenSections?.includes(section)}
                        onChange={() => {
                          setEditData(d => {
                            const hidden = d.hiddenSections || [];
                            const next = hidden.includes(section) ? hidden.filter(s => s !== section) : [...hidden, section];
                            return { ...d, hiddenSections: next };
                          });
                        }}
                        className="rounded accent-primary"
                        data-ai={`profile-section-${section}`}
                      />
                      {t(`profile.section${section.charAt(0).toUpperCase() + section.slice(1)}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="gap-1" onClick={cancelEditing} data-ai="profile-cancel">
                  <XIcon className="h-3 w-3" /> {t('profile.back')}
                </Button>
                <Button size="sm" className="gap-1" onClick={saveCustomProfile} disabled={saveMutation.isPending} data-ai="profile-save">
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {t('profile.saveProfile')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats */}
        <div className="md:col-span-2 space-y-6">
          {/* Stat cards */}
          {!cd.hiddenSections?.includes('stats') && (<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <Trophy className="h-5 w-5 mx-auto mb-1 text-green-400" />
                <p className="text-xl font-bold">{profile.wins}</p>
                <p className="text-xs text-muted-foreground">{t('profile.wins')}</p>
              </CardContent>
            </Card>
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <p className="text-xl font-bold">{winRate}%</p>
                <p className="text-xs text-muted-foreground">{t('profile.winRate')}</p>
              </CardContent>
            </Card>
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-red-400" />
                <p className="text-xl font-bold">{kd}</p>
                <p className="text-xs text-muted-foreground">{t('profile.kd')}</p>
              </CardContent>
            </Card>
            <Card className="glass glass-border">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-purple-400" />
                <p className="text-xl font-bold">{profile.kills}</p>
                <p className="text-xs text-muted-foreground">{t('profile.kills')}</p>
              </CardContent>
            </Card>
          </div>)}

          {/* Achievements */}
          {!cd.hiddenSections?.includes('achievements') && (<Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-500" />
                                {t('profile.achievements')} ({completedAchievements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedAchievements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('profile.noAchievements')}</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {completedAchievements.slice(0, 9).map(a => (
                    <div key={a.userAchievementId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                      <span className="text-lg">{a.achievement.icon || "🏆"}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{a.achievement.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.achievement.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>)}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info */}
          {!cd.hiddenSections?.includes('info') && (<Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('profile.info')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('profile.role')}</span>
                <span>{profile.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('profile.rank')}</span>
                <span>#{profile.rank || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {t('profile.inClanSince')}</span>
                <span>{new Date(profile.joinedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('profile.assists')}</span>
                <span>{profile.assists}</span>
              </div>
            </CardContent>
          </Card>)}

          {/* Inventory preview */}
          {!cd.hiddenSections?.includes('inventory') && (<Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                                {t('profile.inventory')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!inventory || inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('profile.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {inventory.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{item.name}</span>
                      <Badge variant="outline" className="text-[10px]">{item.quantity}x</Badge>
                    </div>
                  ))}
                  {inventory.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">{t('profile.andMore')} {inventory.length - 5}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>)}
        </div>
      </div>

      {/* Decorations Modal */}
      <DecorationsModal
        open={showDecorations}
        onOpenChange={setShowDecorations}
        discordId={targetDiscordId || ""}
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
}
