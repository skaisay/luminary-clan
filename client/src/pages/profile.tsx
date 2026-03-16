import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  User, Trophy, Coins, Zap, Shield, Star, Clock, BarChart3,
  Loader2, Flame, Medal, Crown, Package, Award, TrendingUp,
  Search, ArrowLeftRight, ArrowLeft, ExternalLink, Copy, Check, Pencil, Save, X as XIcon, Upload, Sparkles
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
import { useAllDecorations, MemberDecorations } from "@/components/member-decorations";

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

function DecorationsModal({ open, onOpenChange, discordId, isOwnProfile }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  discordId: string; isOwnProfile: boolean;
}) {
  const { isAuthenticated, updateBalance } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isRu = (language || 'ru') === 'ru';
  const [activeType, setActiveType] = useState("all");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [equippingId, setEquippingId] = useState<string | null>(null);

  const { data: allDecorations } = useQuery<DecModalDecoration[]>({
    queryKey: ["/api/decorations"],
    enabled: open,
  });

  const { data: owned } = useQuery<DecModalOwned[]>({
    queryKey: ["/api/decorations/my"],
    enabled: open && isAuthenticated && isOwnProfile,
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
    },
    onError: () => {
      setEquippingId(null);
      toast({ title: isRu ? "Ошибка" : "Error", variant: "destructive" });
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

  const filtered = (allDecorations || []).filter(d => activeType === "all" || d.type === activeType);
  const sorted = [...filtered].sort((a, b) => {
    const rarityOrder = ["legendary", "epic", "rare", "uncommon", "common"];
    const aOwned = ownedMap.has(a.id) ? 0 : 1;
    const bOwned = ownedMap.has(b.id) ? 0 : 1;
    if (aOwned !== bOwned) return aOwned - bOwned;
    return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 bg-background/80 backdrop-blur-xl border-white/10">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            {isRu ? "Коллекция декораций" : "Decoration Collection"}
            <Badge variant="outline" className="ml-2 text-xs">
              {owned?.length ?? 0} / {allDecorations?.length ?? 0}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Type filter tabs */}
        <div className="px-6 flex flex-wrap gap-1">
          {types.map(t => (
            <Button key={t} size="sm" variant={activeType === t ? "default" : "ghost"}
              className="h-7 text-xs gap-1" onClick={() => setActiveType(t)}>
              {typeIcons[t] || "📦"} {typeLabelsMap[t]}
            </Button>
          ))}
        </div>

        {/* Items grid */}
        <ScrollArea className="flex-1 px-6 pb-6 pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {sorted.map(dec => {
              const myOwned = ownedMap.get(dec.id);
              const isOwned = !!myOwned;
              const isEquipped = myOwned?.isEquipped ?? false;
              const isSoldOut = dec.maxOwners !== null && dec.maxOwners > 0 && dec.currentOwners >= dec.maxOwners;

              return (
                <div key={dec.id} className={`relative rounded-xl border p-3 transition-colors ${
                  rarityColors[dec.rarity] || "border-border/40"
                } ${isOwned ? "bg-white/5 backdrop-blur-sm" : "bg-background/30 backdrop-blur-sm opacity-70"}`}>
                  {/* Emoji / icon */}
                  <div className="text-2xl mb-1">{dec.emoji || typeIcons[dec.type] || "✦"}</div>

                  {/* Name */}
                  <p className="text-xs font-semibold truncate" style={{ color: dec.color || undefined }}>
                    {dec.name}
                  </p>

                  {/* Rarity + type */}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {rarityLabels[dec.rarity] || dec.rarity}
                  </p>

                  {/* Description */}
                  {dec.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{dec.description}</p>
                  )}

                  {/* Price */}
                  <div className="flex items-center gap-1 mt-2 text-xs text-yellow-500">
                    <Coins className="h-3 w-3" /> {dec.price.toLocaleString()}
                  </div>

                  {/* Status badges */}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {isOwned && (
                      <Badge variant="outline" className="text-[9px] h-4 bg-green-500/10 text-green-400 border-green-600/30">
                        {isRu ? "В коллекции" : "Owned"}
                      </Badge>
                    )}
                    {isEquipped && (
                      <Badge variant="outline" className="text-[9px] h-4 bg-purple-500/10 text-purple-400 border-purple-600/30">
                        {isRu ? "Надето" : "Equipped"}
                      </Badge>
                    )}
                    {isSoldOut && !isOwned && (
                      <Badge variant="outline" className="text-[9px] h-4 bg-red-500/10 text-red-400 border-red-600/30">
                        {isRu ? "Распродано" : "Sold out"}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  {isOwnProfile && isAuthenticated && (
                    <div className="mt-2 flex gap-1">
                      {!isOwned && !isSoldOut && (
                        <Button size="sm" className="h-6 text-[10px] flex-1" variant="outline"
                          disabled={buyingId === dec.id} onClick={() => buyMutation.mutate(dec.id)}>
                          {buyingId === dec.id ? <Loader2 className="h-3 w-3 animate-spin" /> :
                           (isRu ? "Купить" : "Buy")}
                        </Button>
                      )}
                      {isOwned && (
                        <Button size="sm" className={`h-6 text-[10px] flex-1 ${isEquipped ? "bg-purple-600/20" : ""}`}
                          variant="outline" disabled={equippingId === dec.id}
                          onClick={() => equipMutation.mutate({ decorationId: dec.id, equip: !isEquipped })}>
                          {equippingId === dec.id ? <Loader2 className="h-3 w-3 animate-spin" /> :
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
              <p className="text-sm">{isRu ? "Декорации не найдены" : "No decorations found"}</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const params = useParams<{ discordId?: string }>();
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDecorations, setShowDecorations] = useState(false);
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
  });

  const { data: achievements, isLoading: loadingAchievements } = useQuery<ProfileAchievement[]>({
    queryKey: [`/api/achievements/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  const { data: inventory } = useQuery<InventoryItem[]>({
    queryKey: [`/api/inventory/${targetDiscordId}`],
    enabled: !!targetDiscordId,
  });

  const { data: allDecorations } = useAllDecorations();

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
      <Card className="glass glass-border overflow-hidden mb-6 relative" style={cd.cardColor ? { borderColor: cd.cardColor + '40' } : undefined}>
        <div
          className="h-32 relative"
          style={cd.bannerColor1 && !cd.bannerImage
            ? { background: `linear-gradient(to right, ${cd.bannerColor1}, ${cd.bannerColor2 || cd.bannerColor1})` }
            : undefined
          }
        >
          {cd.bannerImage && (
            <img src={cd.bannerImage} alt="" className="w-full h-full object-cover absolute inset-0" />
          )}
          {!cd.bannerColor1 && !cd.bannerImage && (
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-[hsl(var(--accent))]/30" />
          )}
          {profile.equippedBanner && !cd.bannerColor1 && !cd.bannerImage && (
            <img src={profile.equippedBanner} alt="" className="w-full h-full object-cover absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <CardContent className="relative -mt-12 pb-6">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <Avatar className="w-24 h-24 border-4 border-background shadow-xl">
              <AvatarImage src={cd.customAvatar || profile.avatar || undefined} />
              <AvatarFallback className="text-2xl">{profile.username[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">
                  {profile.username}
                  <MemberDecorations discordId={profile.discordId} decorations={allDecorations} />
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
              <div className="flex gap-1.5 justify-end flex-wrap">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleCopyId}>
                  {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  ID
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowDecorations(true)}>
                  <Sparkles className="h-3 w-3" />
                  {(language || 'ru') === 'ru' ? 'Декор' : 'Decor'}
                </Button>
                {!isOwnProfile && user?.discordId && (
                  <Link href={`/trading?target=${encodeURIComponent(profile.username)}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <ArrowLeftRight className="h-3 w-3" /> {t('profile.trade')}
                    </Button>
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
            <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-border/50 space-y-3">
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
