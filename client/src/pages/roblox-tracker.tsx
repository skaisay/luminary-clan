import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Gamepad2, Clock, Users, UserPlus, Eye, ExternalLink, User, Calendar, Shield, Loader2, History, XCircle, Globe, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryClient } from "@/lib/queryClient";

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  avatar: string | null;
  status: string;
  statusColor: string;
  lastOnline: string | null;
  lastLocation: string;
  currentGame: {
    id: number;
    name: string;
    description: string;
    playing: number;
    visits: number;
    maxPlayers: number;
    placeId: number;
    rootPlaceId: number;
    creator: string;
  } | null;
  stats: {
    friends: number;
    followers: number;
    followings: number;
  };
  presence: {
    type: number;
    placeId: number | null;
    rootPlaceId: number | null;
    universeId: number | null;
    gameId: string | null;
  } | null;
  profileUrl: string;
}

interface SearchResult {
  success: boolean;
  error?: string;
  user?: RobloxUser;
}

interface HistoryItem {
  username: string;
  userId: number;
  timestamp: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 30) return `${days} дн. назад`;
  return formatDate(dateStr);
}

function formatNumber(num: number) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

function StatusIndicator({ status, color }: { status: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500 shadow-green-500/50',
    blue: 'bg-blue-500 shadow-blue-500/50',
    orange: 'bg-orange-500 shadow-orange-500/50',
    gray: 'bg-gray-500 shadow-gray-500/50',
  };
  
  const bgBadge: Record<string, string> = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  
  return (
    <Badge variant="outline" className={`${bgBadge[color] || bgBadge.gray} gap-1.5`}>
      <span className={`w-2.5 h-2.5 rounded-full ${colorMap[color] || colorMap.gray} shadow-lg animate-pulse`} />
      {status}
    </Badge>
  );
}

function AccountAge(props: { created: string }) {
  const created = new Date(props.created);
  const now = new Date();
  const years = now.getFullYear() - created.getFullYear();
  const months = now.getMonth() - created.getMonth();
  const totalMonths = years * 12 + months;
  
  if (totalMonths < 1) return <span>Меньше месяца</span>;
  if (totalMonths < 12) return <span>{totalMonths} мес.</span>;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return <span>{y} г. {m > 0 ? `${m} мес.` : ''}</span>;
}

export default function RobloxTracker() {
  const { t } = useLanguage();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: result, isLoading, isError, error } = useQuery<SearchResult>({
    queryKey: ['/api/roblox/lookup', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/roblox/lookup/${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length >= 3,
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 15000,
  });

  const { data: historyData } = useQuery<{ history: HistoryItem[] }>({
    queryKey: ['/api/roblox/history'],
    staleTime: 10000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed.length >= 3) {
      setSearchQuery(trimmed);
    }
  };

  const handleHistoryClick = (username: string) => {
    setSearchInput(username);
    setSearchQuery(username);
  };

  const user = result?.user;

  // Авто-обновление текста
  useEffect(() => {
    if (user && (user.presence?.type === 1 || user.presence?.type === 2)) {
      setAutoRefresh(true);
    } else {
      setAutoRefresh(false);
    }
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-sm">
            <Gamepad2 className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold neon-text-cyan tracking-wide">
            Roblox Трекер
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Отслеживайте активность любого игрока Roblox в реальном времени
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Введите никнейм в Roblox..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 h-12 text-base glass glass-border"
              maxLength={20}
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || searchInput.trim().length < 3} 
            className="h-12 px-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            <span className="ml-2 hidden sm:inline">Найти</span>
          </Button>
        </div>
      </form>

      {/* Search History */}
      {historyData?.history && historyData.history.length > 0 && !user && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <History className="h-4 w-4" />
            <span>Недавние поиски</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {historyData.history.map((item) => (
              <button
                key={item.userId}
                onClick={() => handleHistoryClick(item.username)}
                className="glass glass-border rounded-lg px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors"
              >
                {item.username}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Загрузка данных из Roblox...</p>
        </div>
      )}

      {/* Error */}
      {result && !result.success && (
        <div className="max-w-2xl mx-auto">
          <Card className="glass glass-border border-red-500/30">
            <CardContent className="flex items-center gap-4 py-8">
              <XCircle className="h-12 w-12 text-red-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-red-400">Пользователь не найден</h3>
                <p className="text-muted-foreground">{result.error || 'Проверьте правильность никнейма'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {user && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          
          {/* Profile Card */}
          <Card className="glass glass-border overflow-hidden">
            <div className="relative">
              {/* Background gradient */}
              <div className="absolute inset-0 h-32 bg-gradient-to-br from-red-600/20 via-orange-500/10 to-purple-600/20" />
              
              <CardContent className="relative pt-6 pb-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-28 h-28 rounded-2xl overflow-hidden ring-4 ring-background shadow-2xl">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                          <User className="h-12 w-12 text-white" />
                        </div>
                      )}
                    </div>
                    {/* Status dot */}
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-background
                      ${user.statusColor === 'green' ? 'bg-green-500' : 
                        user.statusColor === 'blue' ? 'bg-blue-500' : 
                        user.statusColor === 'orange' ? 'bg-orange-500' : 'bg-gray-500'}
                    `} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
                      <h2 className="text-2xl font-bold">{user.displayName}</h2>
                      {user.displayName !== user.name && (
                        <span className="text-muted-foreground text-sm">@{user.name}</span>
                      )}
                      <StatusIndicator status={user.status} color={user.statusColor} />
                      {user.isBanned && (
                        <Badge variant="destructive" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Заблокирован
                        </Badge>
                      )}
                    </div>

                    {user.description && (
                      <p className="text-sm text-muted-foreground mb-3 max-w-lg line-clamp-2">
                        {user.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        Создан: {formatDate(user.created)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        Возраст: <AccountAge created={user.created} />
                      </span>
                      {user.lastOnline && user.presence?.type === 0 && (
                        <span className="flex items-center gap-1.5">
                          <Globe className="h-4 w-4" />
                          Был: {formatRelativeTime(user.lastOnline)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Profile link */}
                  <a 
                    href={user.profileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <Button variant="outline" className="gap-2 glass glass-border">
                      <ExternalLink className="h-4 w-4" />
                      Профиль
                    </Button>
                  </a>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="glass glass-border text-center py-4">
              <div className="flex flex-col items-center gap-1">
                <Users className="h-5 w-5 text-blue-400" />
                <span className="text-2xl font-bold">{formatNumber(user.stats.friends)}</span>
                <span className="text-xs text-muted-foreground">Друзья</span>
              </div>
            </Card>
            <Card className="glass glass-border text-center py-4">
              <div className="flex flex-col items-center gap-1">
                <UserPlus className="h-5 w-5 text-purple-400" />
                <span className="text-2xl font-bold">{formatNumber(user.stats.followers)}</span>
                <span className="text-xs text-muted-foreground">Подписчики</span>
              </div>
            </Card>
            <Card className="glass glass-border text-center py-4">
              <div className="flex flex-col items-center gap-1">
                <Eye className="h-5 w-5 text-green-400" />
                <span className="text-2xl font-bold">{formatNumber(user.stats.followings)}</span>
                <span className="text-xs text-muted-foreground">Подписки</span>
              </div>
            </Card>
          </div>

          {/* Current Game */}
          {user.currentGame && (
            <Card className="glass glass-border overflow-hidden border-blue-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Gamepad2 className="h-5 w-5" />
                  Сейчас играет
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{user.currentGame.name}</h3>
                    {user.currentGame.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{user.currentGame.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {formatNumber(user.currentGame.playing)} играют
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Eye className="h-3 w-3" />
                        {formatNumber(user.currentGame.visits)} посещений
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" />
                        {user.currentGame.creator}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href={`https://www.roblox.com/games/${user.currentGame.placeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500">
                        <Gamepad2 className="h-4 w-4" />
                        Присоединиться
                      </Button>
                    </a>
                    <a
                      href={`https://www.roblox.com/games/${user.currentGame.placeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="w-full gap-2 glass glass-border">
                        <ExternalLink className="h-4 w-4" />
                        Страница игры
                      </Button>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location Info (if online but not in game) */}
          {user.presence?.type === 1 && user.lastLocation && (
            <Card className="glass glass-border border-green-500/30">
              <CardContent className="flex items-center gap-4 py-6">
                <Globe className="h-8 w-8 text-green-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-400">Сейчас онлайн</h3>
                  <p className="text-sm text-muted-foreground">{user.lastLocation || 'На сайте Roblox'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Offline / Studio */}
          {user.presence?.type === 0 && (
            <Card className="glass glass-border border-gray-500/30">
              <CardContent className="flex items-center gap-4 py-6">
                <Clock className="h-8 w-8 text-gray-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-400">Оффлайн</h3>
                  <p className="text-sm text-muted-foreground">
                    {user.lastOnline 
                      ? `Последний раз в сети: ${formatRelativeTime(user.lastOnline)}`
                      : 'Время последнего входа неизвестно'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {user.presence?.type === 3 && (
            <Card className="glass glass-border border-orange-500/30">
              <CardContent className="flex items-center gap-4 py-6">
                <Gamepad2 className="h-8 w-8 text-orange-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-orange-400">В Roblox Studio</h3>
                  <p className="text-sm text-muted-foreground">Занимается разработкой игры</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auto-refresh indicator */}
          {autoRefresh && (
            <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Авто-обновление каждые 30 секунд
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !result && !searchQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-red-500/10 to-orange-500/10 mb-6">
            <Gamepad2 className="h-16 w-16 text-red-400/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Начните поиск</h3>
          <p className="text-muted-foreground max-w-md">
            Введите никнейм любого игрока Roblox, чтобы увидеть его профиль, статус и текущую игру
          </p>
        </div>
      )}
    </div>
  );
}
