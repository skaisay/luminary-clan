import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Music2, 
  Play, 
  Pause, 
  SkipForward, 
  StopCircle, 
  Volume2,
  Shuffle,
  Repeat,
  Search,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface VoiceChannel {
  id: string;
  name: string;
  type: string;
}

interface QueueTrack {
  name: string;
  url: string;
  duration: number;
  thumbnail?: string;
}

interface QueueData {
  success: boolean;
  queue?: QueueTrack[];
  currentTrack?: QueueTrack;
  isPaused?: boolean;
  volume?: number;
  repeatMode?: number;
}

export default function Music() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [volume, setVolume] = useState(50);
  const { toast } = useToast();

  const { data: channels, isLoading: channelsLoading, error: channelsError } = useQuery<VoiceChannel[]>({
    queryKey: ["/api/music/voice-channels"],
    retry: false,
  });

  const { data: queueData, isLoading: queueLoading, error: queueError } = useQuery<QueueData>({
    queryKey: ["/api/music/queue"],
    refetchInterval: 5000, // Обновлять каждые 5 секунд
    retry: false,
  });

  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0].id);
    }
  }, [channels, selectedChannel]);

  useEffect(() => {
    if (queueData?.volume !== undefined) {
      setVolume(queueData.volume);
    }
  }, [queueData?.volume]);

  const playMutation = useMutation({
    mutationFn: async (query: string) => {
      return await apiRequest("POST", "/api/music/play", { 
        query, 
        channelId: selectedChannel 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      setSearchQuery("");
      toast({
        title: "Успех",
        description: "Трек добавлен в очередь",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить трек",
        variant: "destructive",
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/music/pause"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/music/resume"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/music/skip"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      toast({
        title: "Трек пропущен",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/music/stop"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      toast({
        title: "Воспроизведение остановлено",
      });
    },
  });

  const shuffleMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/music/shuffle"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
      toast({
        title: "Очередь перемешана",
      });
    },
  });

  const loopMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/music/loop"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
    },
  });

  const volumeMutation = useMutation({
    mutationFn: async (vol: number) => await apiRequest("POST", "/api/music/volume", { volume: vol }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/music/queue"] });
    },
  });

  const handlePlay = () => {
    if (searchQuery.trim()) {
      playMutation.mutate(searchQuery);
    }
  };

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
    volumeMutation.mutate(newVolume);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Проверка доступа
  const isUnauthorized = channelsError && (channelsError as any).message?.includes("401");

  if (isUnauthorized) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl relative">
        <div className="mb-8 ml-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center gap-3">
            <Music2 className="h-10 w-10 text-primary" strokeWidth={1.5} />
            Музыкальный Плеер
          </h1>
        </div>
        <Card className="glass glass-border neon-glow-cyan">
          <CardContent className="py-12">
            <div className="text-center">
              <Music2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-2xl font-bold mb-2">Доступ Ограничен</h2>
              <p className="text-muted-foreground mb-4">
                Только администраторы клана могут управлять музыкальным плеером.
              </p>
              <p className="text-sm text-muted-foreground">
                Войдите как администратор чтобы получить доступ к управлению музыкой.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl relative">
      <div className="mb-8 ml-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 neon-text-cyan tracking-wide flex items-center gap-3">
          <Music2 className="h-12 w-12 animate-pulse-glow" />
          Музыкальный Плеер
        </h1>
        <p className="text-muted-foreground text-lg">
          Управляй музыкой Discord бота прямо из веба
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка - Управление */}
        <div className="lg:col-span-2 space-y-6">
          {/* Выбор канала и поиск */}
          <Card className="glass glass-border neon-glow-cyan">
            <CardHeader>
              <CardTitle>Добавить Трек</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Голосовой канал
                </label>
                {channelsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                    <SelectTrigger data-testid="select-voice-channel" className="glass glass-border">
                      <SelectValue placeholder="Выберите голосовой канал" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels?.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handlePlay()}
                  placeholder="Название трека или YouTube URL..."
                  className="glass glass-border flex-1"
                  disabled={playMutation.isPending || !selectedChannel}
                  data-testid="input-search-track"
                />
                <Button
                  onClick={handlePlay}
                  disabled={!searchQuery.trim() || playMutation.isPending || !selectedChannel}
                  className="neon-glow-cyan"
                  data-testid="button-play-track"
                >
                  {playMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <><Search className="h-5 w-5 mr-2" /> Играть</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Текущий трек */}
          <Card className="glass glass-border neon-glow-purple">
            <CardHeader>
              <CardTitle>Сейчас Играет</CardTitle>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : queueData?.currentTrack ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {queueData.currentTrack.thumbnail && (
                      <img 
                        src={queueData.currentTrack.thumbnail} 
                        alt="Track thumbnail"
                        className="w-24 h-24 rounded-lg object-cover neon-glow-cyan"
                        data-testid="img-current-track-thumbnail"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold truncate" data-testid="text-current-track-name">
                        {queueData.currentTrack.name}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-current-track-duration">
                        Длительность: {formatDuration(queueData.currentTrack.duration)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={queueData.isPaused ? "secondary" : "default"}>
                          {queueData.isPaused ? "Пауза" : "Играет"}
                        </Badge>
                        {queueData.repeatMode === 1 && (
                          <Badge variant="outline">🔁 Повтор очереди</Badge>
                        )}
                        {queueData.repeatMode === 2 && (
                          <Badge variant="outline">🔂 Повтор трека</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Управление воспроизведением */}
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => shuffleMutation.mutate()}
                      disabled={shuffleMutation.isPending}
                      className="glass glass-border"
                      data-testid="button-shuffle"
                    >
                      <Shuffle className="h-5 w-5" />
                    </Button>

                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => queueData.isPaused ? resumeMutation.mutate() : pauseMutation.mutate()}
                      disabled={pauseMutation.isPending || resumeMutation.isPending}
                      className="glass glass-border"
                      data-testid="button-pause-resume"
                    >
                      {queueData.isPaused ? (
                        <Play className="h-6 w-6" />
                      ) : (
                        <Pause className="h-6 w-6" />
                      )}
                    </Button>

                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => skipMutation.mutate()}
                      disabled={skipMutation.isPending}
                      className="glass glass-border"
                      data-testid="button-skip"
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>

                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => loopMutation.mutate()}
                      disabled={loopMutation.isPending}
                      className="glass glass-border"
                      data-testid="button-loop"
                    >
                      <Repeat className="h-5 w-5" />
                    </Button>

                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => stopMutation.mutate()}
                      disabled={stopMutation.isPending}
                      data-testid="button-stop"
                    >
                      <StopCircle className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Громкость */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Громкость</span>
                      </div>
                      <span className="text-sm font-semibold">{volume}%</span>
                    </div>
                    <Slider
                      value={[volume]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid="slider-volume"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Music2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Ничего не играет</p>
                  <p className="text-sm">Добавьте трек чтобы начать</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Правая колонка - Очередь */}
        <div>
          <Card className="glass glass-border neon-glow-cyan">
            <CardHeader>
              <CardTitle>Очередь Треков</CardTitle>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : queueData?.queue && queueData.queue.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {queueData.queue.map((track, index) => (
                    <div
                      key={index}
                      className="glass glass-border rounded-lg p-3 hover-elevate"
                      data-testid={`queue-track-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full glass glass-border flex items-center justify-center text-sm font-semibold neon-text-cyan">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-track-name-${index}`}>
                            {track.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(track.duration)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Очередь пуста</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
