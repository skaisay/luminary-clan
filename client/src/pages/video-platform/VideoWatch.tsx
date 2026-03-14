import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Eye, Share2, Trash2, ThumbsUp, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import type { Video as VideoType } from "@shared/schema";
import DiscordAuthModal from "@/components/video-platform/DiscordAuthModal";

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateShort(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  return `${Math.floor(days / 30)} мес. назад`;
}

export default function VideoWatch() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const videoId = params.id as string;
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  const { data: video, isLoading } = useQuery<VideoType>({
    queryKey: [`/api/videos/${videoId}`],
    enabled: !!videoId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: allVideos = [] } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const recommendedVideos = allVideos.filter((v) => v.id !== videoId).slice(0, 10);

  useEffect(() => {
    if (!video) return;

    const baseUrl = window.location.origin;
    const videoUrl = `${baseUrl}/v/${videoId}`;
    const videoStreamUrl = `${baseUrl}/api/videos/${videoId}/stream`;
    const thumbnailUrl = video.thumbnailPath ? `${baseUrl}/api/videos/${videoId}/thumbnail` : '';

    const setMetaTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMetaTag('og:type', 'video.other');
    setMetaTag('og:url', videoUrl);
    setMetaTag('og:title', video.title);
    setMetaTag('og:description', video.description || `Смотрите видео "${video.title}" на Highlights`);
    setMetaTag('og:video', videoStreamUrl);
    setMetaTag('og:video:url', videoStreamUrl);
    setMetaTag('og:video:secure_url', videoStreamUrl);
    setMetaTag('og:video:type', 'video/mp4');
    setMetaTag('og:video:width', '1280');
    setMetaTag('og:video:height', '720');
    
    if (thumbnailUrl) {
      setMetaTag('og:image', thumbnailUrl);
      setMetaTag('og:image:width', '1280');
      setMetaTag('og:image:height', '720');
    }

    setMetaTag('twitter:card', 'player');
    setMetaTag('twitter:title', video.title);
    setMetaTag('twitter:description', video.description || `Смотрите видео "${video.title}" на Highlights`);
    if (thumbnailUrl) {
      setMetaTag('twitter:image', thumbnailUrl);
    }
    setMetaTag('twitter:player', videoStreamUrl);
    setMetaTag('twitter:player:width', '1280');
    setMetaTag('twitter:player:height', '720');

    document.title = `${video.title} - Highlights`;

    return () => {
      document.title = 'Highlights';
    };
  }, [video, videoId]);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/v/${videoId}`;
    copyToClipboard(shareUrl);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/videos/${videoId}/like`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to like video");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/videos/${videoId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos/liked/my"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete video");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: [`/api/videos/${videoId}`] });
      navigate("/video-platform");
    },
    onError: () => {},
  });

  if (isLoading) {
    return (
      <div className="p-0 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Mobile skeleton */}
          <div className="md:hidden">
            <Skeleton className="aspect-video w-full bg-white/10" />
            <div className="p-3 space-y-3">
              <Skeleton className="h-6 w-full bg-white/10" />
              <Skeleton className="h-4 w-2/3 bg-white/10" />
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 bg-white/10" />
                  <Skeleton className="h-3 w-1/4 bg-white/10" />
                </div>
              </div>
            </div>
          </div>
          {/* Desktop skeleton */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="aspect-video w-full rounded-3xl bg-white/10" />
              <Skeleton className="h-8 w-3/4 bg-white/10" />
              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3 bg-white/10" />
                  <Skeleton className="h-4 w-1/4 bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 md:p-6">
        <Card className="max-w-md w-full backdrop-blur-xl bg-white/10 border-white/20 rounded-2xl md:rounded-3xl">
          <CardContent className="text-center py-10 md:py-12">
            <h3 className="text-lg font-semibold text-white mb-2">
              Видео не найдено
            </h3>
            <p className="text-white/70 mb-6 text-sm md:text-base">
              Запрашиваемое видео не существует
            </p>
            <Button
              onClick={() => navigate("/video-platform")}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
              data-testid="button-back"
            >
              Вернуться назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = isAuthenticated && user && user.discordId === video.uploadedBy;

  return (
    <>
      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col h-screen bg-black">
        {/* Fixed Video Player + Controls */}
        <div className="flex-shrink-0 overflow-y-auto">
          {/* Video Player - Full width */}
          <div className="bg-black">
            <video
              controls
              className="w-full aspect-video bg-black"
              data-testid="video-player-mobile"
              playsInline
            >
              <source src={`/api/videos/${videoId}/stream`} type="video/mp4" />
              Ваш браузер не поддерживает воспроизведение видео.
            </video>
          </div>

          {/* Video Info */}
          <div className="px-3 py-3 space-y-3">
          {/* Title */}
          <h1 className="text-base font-semibold text-white leading-tight">
            {video.title}
          </h1>
          
          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>{formatViews(video.views || 0)} просмотров</span>
            <span>•</span>
            <span>{formatDateShort(video.createdAt.toString())}</span>
          </div>

          {/* Action Buttons - Horizontal scroll */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!isAuthenticated) {
                  setShowAuthModal(true);
                } else {
                  likeMutation.mutate();
                }
              }}
              disabled={likeMutation.isPending}
              className="flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white h-9 px-4"
              data-testid="button-like-mobile"
            >
              <ThumbsUp className={`h-4 w-4 mr-1.5 ${(video as any).hasLiked ? 'fill-emerald-500 text-emerald-500' : ''}`} />
              {(video as any).likeCount || 0}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white h-9 px-4"
              data-testid="button-share-mobile"
            >
              <Share2 className="h-4 w-4 mr-1.5" />
              Поделиться
            </Button>

            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Вы уверены, что хотите удалить это видео?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex-shrink-0 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 h-9 px-4"
                data-testid="button-delete-mobile"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Удалить
              </Button>
            )}
          </div>

          {/* Channel Info */}
          <div className="flex items-center gap-3 py-2 border-t border-b border-white/10">
            {video.uploadedByAvatar ? (
              <Avatar className="h-10 w-10">
                <AvatarImage src={video.uploadedByAvatar} />
                <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
                  {video.uploadedByUsername.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                {video.uploadedByUsername.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white text-sm truncate">
                {video.uploadedByUsername}
              </p>
            </div>
          </div>

          {/* Description - Collapsible */}
          {video.description && (
            <div 
              className="bg-white/5 rounded-xl p-3 cursor-pointer"
              onClick={() => setShowDescription(!showDescription)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Описание</span>
                {showDescription ? (
                  <ChevronUp className="h-4 w-4 text-white/70" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white/70" />
                )}
              </div>
              <p className={`text-sm text-white/90 mt-2 whitespace-pre-wrap ${showDescription ? '' : 'line-clamp-2'}`}>
                {video.description}
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Scrollable Recommendations */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-3">
            <h2 className="text-sm font-semibold text-white mb-3 sticky top-0 bg-black z-10 py-2">Рекомендации</h2>
            <div className="space-y-3">
              {recommendedVideos.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-4">Нет доступных видео</p>
              ) : (
                recommendedVideos.map((recVideo) => (
                  <div
                    key={recVideo.id}
                    className="flex gap-3 cursor-pointer"
                    onClick={() => navigate(`/video-platform/watch/${recVideo.id}`)}
                    data-testid={`recommended-mobile-${recVideo.id}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-40 flex-shrink-0 rounded-lg overflow-hidden bg-white/10">
                      {recVideo.thumbnailPath ? (
                        <img
                          src={`/api/videos/${recVideo.id}/thumbnail`}
                          alt={recVideo.title}
                          className="w-full h-[90px] object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-[90px] bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                          <span className="text-white/30 text-xs">Нет превью</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <h3 className="text-sm font-medium text-white line-clamp-2 mb-1">
                        {recVideo.title}
                      </h3>
                      <p className="text-xs text-white/60 truncate">
                        {recVideo.uploadedByUsername}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-white/50 mt-0.5">
                        <span>{formatViews(recVideo.views || 0)} просм.</span>
                        <span>•</span>
                        <span>{formatDateShort(recVideo.createdAt.toString())}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Video Section */}
            <div className="lg:col-span-2 space-y-4">
              {/* Video Player */}
              <Card className="bg-black rounded-3xl overflow-hidden border-0">
                <CardContent className="p-0">
                  <video
                    controls
                    className="w-full aspect-video bg-black"
                    data-testid="video-player"
                  >
                    <source src={`/api/videos/${videoId}/stream`} type="video/mp4" />
                    Ваш браузер не поддерживает воспроизведение видео.
                  </video>
                </CardContent>
              </Card>

              {/* Video Title */}
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {video.title}
                </h1>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {formatViews(video.views || 0)} просмотров
                  </span>
                  <span>•</span>
                  <span>{formatDate(video.createdAt.toString())}</span>
                </div>
              </div>

              {/* Actions Bar */}
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Channel Info */}
                    <div className="flex items-center gap-3">
                      {video.uploadedByAvatar ? (
                        <Avatar className="h-10 w-10 ring-2 ring-white/30">
                          <AvatarImage src={video.uploadedByAvatar} />
                          <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
                            {video.uploadedByUsername.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold ring-2 ring-white/30">
                          {video.uploadedByUsername.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white text-sm">
                          {video.uploadedByUsername}
                        </p>
                        <p className="text-xs text-white/70">
                          Автор видео
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!isAuthenticated) {
                            setShowAuthModal(true);
                          } else {
                            likeMutation.mutate();
                          }
                        }}
                        disabled={likeMutation.isPending}
                        className="rounded-full border-white/30 bg-white/10 hover:bg-white/20 text-white"
                        data-testid="button-like"
                      >
                        <ThumbsUp className={`h-4 w-4 mr-2 ${(video as any).hasLiked ? 'fill-emerald-500 text-emerald-500' : ''}`} />
                        {(video as any).likeCount || 0}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleShare}
                        className="rounded-full border-white/30 bg-white/10 hover:bg-white/20 text-white"
                        data-testid="button-share"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Поделиться
                      </Button>

                      {isOwner && (
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Вы уверены, что хотите удалить это видео?")) {
                              deleteMutation.mutate();
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="rounded-full"
                          data-testid="button-delete"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              {video.description && (
                <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
                  <CardContent className="p-6">
                    <p className="text-white/90 whitespace-pre-wrap">
                      {video.description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar - Recommended Videos */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-semibold text-white mb-4">Рекомендации</h2>
              <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
                {recommendedVideos.length === 0 ? (
                  <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-2xl">
                    <CardContent className="p-6 text-center">
                      <p className="text-white/70 text-sm">Нет доступных видео</p>
                    </CardContent>
                  </Card>
                ) : (
                  recommendedVideos.map((recVideo) => (
                    <Card
                      key={recVideo.id}
                      className="backdrop-blur-xl bg-white/10 border-white/20 hover:bg-white/20 rounded-2xl cursor-pointer transition-all overflow-hidden"
                      onClick={() => navigate(`/video-platform/watch/${recVideo.id}`)}
                      data-testid={`recommended-${recVideo.id}`}
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col gap-0">
                          {/* Thumbnail */}
                          <div className="relative w-full aspect-video">
                            {recVideo.thumbnailPath ? (
                              <img
                                src={`/api/videos/${recVideo.id}/thumbnail`}
                                alt={recVideo.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                                <span className="text-white/50 text-xs">Нет превью</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 p-3 min-w-0">
                            <h3 className="text-base font-semibold text-white line-clamp-2 mb-2">
                              {recVideo.title}
                            </h3>
                            <p className="text-sm text-white/70 truncate mb-1">
                              {recVideo.uploadedByUsername}
                            </p>
                            <div className="flex items-center gap-1 text-sm text-white/60">
                              <Eye className="h-4 w-4" />
                              <span>{formatViews(recVideo.views || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <DiscordAuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
}
