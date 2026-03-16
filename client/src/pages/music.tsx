import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Music2, 
  Play, 
  Pause, 
  SkipForward, 
  StopCircle, 
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Search,
  Loader2,
  Headphones,
  Radio,
  ListMusic,
  Plus,
  Bot,
  LogIn,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface VoiceChannelMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isBot: boolean;
}

interface VoiceChannel {
  id: string;
  name: string;
  type: string;
  memberCount: number;
  members: VoiceChannelMember[];
}

interface SongInfo {
  title: string;
  duration: string;
  url: string;
  thumbnail?: string;
  requestedBy?: string;
}

interface QueueSong {
  position: number;
  title: string;
  duration: string;
  url: string;
  isPlaying: boolean;
}

interface LoadingStatus {
  state: 'idle' | 'resolving' | 'connecting' | 'streaming' | 'playing' | 'error';
  progress: number;
  message: string;
  songTitle?: string;
  errorDetail?: string;
  timestamp: number;
}

interface NowPlayingResult {
  success: boolean;
  message?: string;
  song?: SongInfo;
  isPaused?: boolean;
  loading?: LoadingStatus;
}

interface QueueResult {
  success: boolean;
  message?: string;
  queue?: QueueSong[];
  totalSongs?: number;
  loop?: boolean;
}

export default function MusicPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [volume, setVolume] = useState(50);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Fetch voice channels with members
  const { data: channels, isLoading: channelsLoading, error: channelsError } = useQuery<VoiceChannel[]>({
    queryKey: ["/api/music/voice-channels"],
    refetchInterval: 10000,
    retry: false,
  });

  // Fetch now playing
  const { data: nowPlaying, isLoading: nowPlayingLoading } = useQuery<NowPlayingResult>({
    queryKey: ["/api/music/now-playing"],
    refetchInterval: 2000,
    retry: false,
  });

  // Fetch loading status (polls faster when loading)
  const { data: loadingStatus } = useQuery<LoadingStatus>({
    queryKey: ["/api/music/loading-status"],
    refetchInterval: 1500,
    retry: false,
  });

  // Fetch queue
  const { data: queueData, isLoading: queueLoading } = useQuery<QueueResult>({
    queryKey: ["/api/music/queue"],
    refetchInterval: 3000,
    retry: false,
  });

  // Debug logs (poll less frequently)
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);
  const { data: debugLogs } = useQuery<{ logs: { time: string; msg: string }[]; count: number }>({
    queryKey: ["/api/music/debug-logs"],
    refetchInterval: showDebugLogs ? 3000 : false,
    enabled: showDebugLogs,
    retry: false,
  });

  // Auto-select first channel with members, or first channel
  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannel) {
      const channelWithMembers = channels.find(c => c.memberCount > 0);
      setSelectedChannel(channelWithMembers?.id || channels[0].id);
    }
  }, [channels, selectedChannel]);

  // Mutations
  const playMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/music/play", { query, channelId: selectedChannel });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/now-playing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/voice-channels"] });
      setSearchQuery("");
      setSearchResults([]);
      setShowSearch(false);
      toast({ title: data?.message || t('music.trackAdded') });
    },
    onError: (error: any) => {
      toast({ title: t('music.error'), description: error.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/music/pause"); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/now-playing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/music/resume"); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/now-playing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/music/skip"); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/now-playing"] });
      toast({ title: "⏭️ " + t('music.trackSkipped') });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/music/stop"); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/now-playing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/voice-channels"] });
      toast({ title: "⏹️ " + t('music.stopped') });
    },
  });

  const shuffleMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/music/shuffle"); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      toast({ title: "🔀 " + t('music.shuffled') });
    },
  });

  const loopMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/music/loop"); return r.json(); },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      toast({ title: data?.message || t('music.loopChanged') });
    },
  });

  const volumeMutation = useMutation({
    mutationFn: async (vol: number) => { const r = await apiRequest("POST", "/api/music/volume", { volume: vol }); return r.json(); },
  });

  const jumpMutation = useMutation({
    mutationFn: async (position: number) => {
      const r = await apiRequest("POST", "/api/music/jump", { position });
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/now-playing"] });
      toast({ title: data?.message || t('music.trackSkipped') });
    },
    onError: (error: any) => {
      toast({ title: t('music.error'), description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (position: number) => {
      const r = await apiRequest("POST", "/api/music/remove", { position });
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/music/now-playing"] });
      toast({ title: data?.message || '🗑️ Удалено' });
    },
    onError: (error: any) => {
      toast({ title: t('music.error'), description: error.message, variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const r = await apiRequest("POST", "/api/music/search", { query: q, limit: 5 });
      return r.json();
    },
    onSuccess: (data: any) => {
      if (data?.results) {
        setSearchResults(data.results);
        setShowSearch(true);
      }
    },
  });

  const handlePlay = useCallback(() => {
    if (!searchQuery.trim() || !selectedChannel) return;
    playMutation.mutate(searchQuery);
  }, [searchQuery, selectedChannel]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery);
  }, [searchQuery]);

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
    volumeMutation.mutate(newVolume);
  };

  const isPlaying = nowPlaying?.success && nowPlaying?.song && !nowPlaying?.loading;
  const isPaused = isPlaying && nowPlaying?.isPaused;
  const isLoading = loadingStatus && ['resolving', 'connecting', 'streaming'].includes(loadingStatus.state);
  const isError = loadingStatus?.state === 'error' && loadingStatus.timestamp && (Date.now() - loadingStatus.timestamp) < 120000;
  const isUnauthorized = channelsError && (channelsError as any)?.message?.includes?.("401");

  // Not logged in
  if (isUnauthorized || !user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-24">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Music2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-[hsl(var(--accent))] bg-clip-text text-transparent">
            {t('music.title')}
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {t('music.loginRequired')}
          </p>
          <Button asChild className="mt-6 gap-2" size="lg">
            <a href="/auth/discord?returnTo=/music">
              <LogIn className="h-5 w-5" />
              {t('music.loginDiscord')}
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl pt-24">
      {/* Header */}
      <div className="mb-8 ml-0 md:ml-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
              <Music2 className="h-7 w-7 text-white" />
            </div>
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[hsl(var(--accent))] rounded-full animate-pulse border-2 border-background" />
            )}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-[hsl(var(--accent))] bg-clip-text text-transparent">
              {t('music.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('music.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column - Voice Channels */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones className="h-4 w-4 text-[hsl(var(--accent))]" />
                {t('music.voiceChannels')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {channelsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : channels && channels.length > 0 ? (
                channels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel.id)}
                    className={`w-full text-left rounded-xl p-3 transition-all duration-200 border ${
                      selectedChannel === channel.id
                        ? 'bg-primary/10 border-primary/40 shadow-md shadow-primary/10'
                        : 'bg-card/50 border-border/50 hover:bg-card/80 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Radio className={`h-4 w-4 ${selectedChannel === channel.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium truncate ${selectedChannel === channel.id ? 'text-primary' : ''}`}>
                        {channel.name}
                      </span>
                      {channel.memberCount > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                          {channel.memberCount}
                        </Badge>
                      )}
                    </div>
                    {channel.members.length > 0 && (
                      <div className="space-y-1.5 ml-6">
                        {channel.members.map(member => (
                          <div key={member.id} className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback className="text-[8px]">{member.displayName[0]}</AvatarFallback>
                            </Avatar>
                            <span className={`text-xs truncate ${member.isBot ? 'text-[hsl(var(--accent))]' : 'text-muted-foreground'}`}>
                              {member.displayName}
                              {member.isBot && <Bot className="inline h-3 w-3 ml-1" />}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {channel.memberCount === 0 && (
                      <p className="text-xs text-muted-foreground/50 ml-6">{t('music.emptyChannel')}</p>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Headphones className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('music.noChannels')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center column - Player */}
        <div className="lg:col-span-6 space-y-6">
          {/* Search / Add track */}
          <Card className="glass glass-border">
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handlePlay();
                      }
                    }}
                    placeholder={t('music.searchPlaceholder')}
                    className="pl-10 glass glass-border"
                    disabled={playMutation.isPending || !selectedChannel}
                    data-ai="music-search"
                  />
                </div>
                <Button
                  onClick={handlePlay}
                  disabled={!searchQuery.trim() || playMutation.isPending || !selectedChannel}
                  className="bg-primary hover:bg-primary/90 gap-2"
                  data-ai="music-play"
                >
                  {playMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Play className="h-4 w-4" /> {t('music.play')}</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || searchMutation.isPending}
                  className="glass glass-border"
                  title={t('music.search')}
                  data-ai="music-search-btn"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Search results */}
              {showSearch && searchResults.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
                  <p className="text-xs text-muted-foreground mb-2">{t('music.searchResults')}</p>
                  {searchResults.map((result: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-card/80 transition-colors cursor-pointer group"
                      onClick={() => {
                        playMutation.mutate(result.url || result.title);
                      }}
                    >
                      {result.thumbnail && (
                        <img src={result.thumbnail} alt="" className="w-12 h-9 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        <p className="text-xs text-muted-foreground">{result.duration}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Now Playing */}
          <Card className={`glass glass-border overflow-hidden relative ${isPlaying ? 'ring-1 ring-primary/30' : ''}`}>
            {/* Animated background when playing */}
            {isPlaying && !isPaused && (
              <div className="absolute inset-0 opacity-[0.03]">
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-transparent to-[hsl(var(--accent))] animate-pulse" />
              </div>
            )}
            
            <CardHeader className="pb-3 relative">
              <CardTitle className="text-base flex items-center gap-2">
                {isLoading ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-primary">Загрузка...</span>
                  </div>
                ) : isError ? (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Ошибка</span>
                  </div>
                ) : isPlaying ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex gap-[2px] items-end h-4">
                      <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms', animationDuration: '600ms' }} />
                      <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms', animationDuration: '600ms' }} />
                      <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms', animationDuration: '600ms' }} />
                      <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '80%', animationDelay: '450ms', animationDuration: '600ms' }} />
                    </span>
                    <span className="text-primary">{t('music.nowPlaying')}</span>
                  </div>
                ) : (
                  <>
                    <Music2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('music.nowPlaying')}</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {nowPlayingLoading ? (
                <div className="flex items-center gap-4">
                  <Skeleton className="w-20 h-20 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ) : isLoading ? (
                /* Loading state with progress bar */
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Loader2 className="h-7 w-7 text-primary animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                        {loadingStatus?.songTitle || 'Загрузка трека...'}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {loadingStatus?.message}
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{loadingStatus?.message}</span>
                      <span>{loadingStatus?.progress || 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-[hsl(var(--accent))] rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${loadingStatus?.progress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : isError ? (
                /* Error state */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-destructive">Не удалось загрузить трек</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {loadingStatus?.errorDetail || loadingStatus?.message}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Попробуйте другой трек или прямую ссылку YouTube</p>
                </div>
              ) : isPlaying ? (
                <div className="space-y-5">
                  {/* Track info */}
                  <div className="flex items-start gap-4">
                    {nowPlaying.song?.thumbnail ? (
                      <div className="relative flex-shrink-0">
                        <img 
                          src={nowPlaying.song.thumbnail} 
                          alt={nowPlaying.song.title}
                          className="w-20 h-20 rounded-xl object-cover shadow-lg"
                        />
                        <div className="absolute inset-0 rounded-xl ring-1 ring-white/10" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Music2 className="h-8 w-8 text-primary/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-tight line-clamp-2">
                        {nowPlaying.song?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {nowPlaying.song?.duration}
                      </p>
                      {nowPlaying.song?.url && (
                        <a 
                          href={nowPlaying.song.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary mt-1 transition-colors"
                        >
                          YouTube <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Playback controls */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => shuffleMutation.mutate()}
                      disabled={shuffleMutation.isPending}
                      className="h-10 w-10 rounded-full"
                    >
                      <Shuffle className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => loopMutation.mutate()}
                      disabled={loopMutation.isPending}
                      className={`h-10 w-10 rounded-full ${queueData?.loop ? 'text-primary bg-primary/10' : ''}`}
                    >
                      {queueData?.loop ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                    </Button>

                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => isPaused ? resumeMutation.mutate() : pauseMutation.mutate()}
                      disabled={pauseMutation.isPending || resumeMutation.isPending}
                      className="h-12 w-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-lg shadow-primary/25"
                    >
                      {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => skipMutation.mutate()}
                      disabled={skipMutation.isPending}
                      className="h-10 w-10 rounded-full"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => stopMutation.mutate()}
                      disabled={stopMutation.isPending}
                      className="h-10 w-10 rounded-full text-destructive hover:text-destructive"
                    >
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Volume */}
                  <div className="flex items-center gap-3 px-2">
                    <button 
                      onClick={() => handleVolumeChange([volume > 0 ? 0 : 50])}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <Slider
                      value={[volume]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/30 mb-4">
                    <Music2 className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-muted-foreground font-medium">{t('music.nothingPlaying')}</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">{t('music.addTrackHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Paused state indicator - shown below player when paused */}
          {isPaused && (
            <Card className="glass glass-border border-yellow-500/30">
              <CardContent className="py-3">
                <div className="flex items-center justify-center gap-2 text-yellow-500">
                  <Pause className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('music.paused')}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Queue */}
        <div className="lg:col-span-3">
          <Card className="glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListMusic className="h-4 w-4 text-primary" />
                  {t('music.queue')}
                </div>
                {queueData?.totalSongs && queueData.totalSongs > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {queueData.totalSongs} {t('music.tracks')}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : queueData?.queue && queueData.queue.length > 0 ? (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {queueData.queue.map((track, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        if (!track.isPlaying && !jumpMutation.isPending) {
                          jumpMutation.mutate(track.position);
                        }
                      }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-200 group ${
                        track.isPlaying 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'hover:bg-card/80 cursor-pointer'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        track.isPlaying 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted/50 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                      }`}>
                        {track.isPlaying ? '▶' : track.position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${track.isPlaying ? 'font-semibold text-primary' : 'group-hover:text-primary'}`}>
                          {track.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{track.duration}</p>
                      </div>
                      {!track.isPlaying && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMutation.mutate(track.position);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
                          title="Удалить из очереди"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ListMusic className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t('music.emptyQueue')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Debug Logs Panel */}
        <div className="mt-6">
          <button 
            onClick={() => setShowDebugLogs(!showDebugLogs)}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {showDebugLogs ? '▼ Скрыть логи' : '▶ Показать логи сервера'}
          </button>
          {showDebugLogs && debugLogs?.logs && (
            <Card className="mt-2 bg-black/50 border-muted/20">
              <CardContent className="p-3">
                <div className="flex justify-end mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const text = debugLogs.logs.slice(-50).map(e => `${e.time} ${e.msg}`).join('\n');
                      navigator.clipboard.writeText(text).then(() => {
                        setLogsCopied(true);
                        setTimeout(() => setLogsCopied(false), 2000);
                      });
                    }}
                  >
                    {logsCopied ? <><Check className="h-3 w-3" /> Скопировано</> : <><Copy className="h-3 w-3" /> Копировать логи</>}
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5 select-text">
                  {debugLogs.logs.slice(-50).map((entry, i) => (
                    <div key={i} className={`select-text ${
                      entry.msg.includes('✅') ? 'text-green-400' :
                      entry.msg.includes('❌') ? 'text-red-400' :
                      entry.msg.includes('⚠️') ? 'text-yellow-400' :
                      entry.msg.includes('▶') ? 'text-blue-400' :
                      'text-muted-foreground/70'
                    }`}>
                      <span className="text-muted-foreground/40">{entry.time}</span> {entry.msg}
                    </div>
                  ))}
                  {debugLogs.logs.length === 0 && (
                    <p className="text-muted-foreground/40 text-center py-4">Нет логов</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
