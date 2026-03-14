import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Play, Eye, Heart, User as UserIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { Video as VideoType } from "@shared/schema";

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

function formatDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  if (days < 365) return `${Math.floor(days / 30)} мес. назад`;
  return `${Math.floor(days / 365)} г. назад`;
}

export default function Liked() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const { data: videos, isLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/videos/liked/my"],
    enabled: isAuthenticated && !!user,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <Card className="max-w-md w-full backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardContent className="text-center py-12">
            <UserIcon className="h-16 w-16 mx-auto text-white/70 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Требуется авторизация
            </h3>
            <p className="text-white/70 mb-6">
              Войдите в систему чтобы видеть понравившиеся видео
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
              data-testid="button-login"
            >
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Heart className="h-6 w-6 text-white fill-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Понравившиеся видео</h1>
          </div>
          <p className="text-white/70">Видео, которые вам понравились</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-2xl bg-white/10" />
                <div className="flex gap-3">
                  <Skeleton className="h-9 w-9 rounded-full flex-shrink-0 bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full bg-white/10" />
                    <Skeleton className="h-3 w-2/3 bg-white/10" />
                    <Skeleton className="h-3 w-1/2 bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !videos || videos.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
            <CardContent className="text-center py-20">
              <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center mb-6 mx-auto">
                <Heart className="h-12 w-12 text-white/50" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">
                Нет понравившихся видео
              </h3>
              <p className="text-white/70 text-center max-w-md mx-auto mb-6">
                Лайкайте видео чтобы они появились здесь!
              </p>
              <Button
                onClick={() => navigate("/video-platform")}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
                data-testid="button-home"
              >
                Смотреть видео
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {videos.map((video) => (
              <Link key={video.id} href={`/video-platform/watch/${video.id}`}>
                <div className="cursor-pointer group" data-testid={`card-video-${video.id}`}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 backdrop-blur-xl rounded-2xl overflow-hidden mb-3 border border-white/20">
                    {video.thumbnailPath ? (
                      <img 
                        src={`/api/videos/${video.id}/thumbnail`} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                        <Play className="h-16 w-16 text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Play Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="rounded-full bg-white/20 backdrop-blur-md p-4 border border-white/30">
                        <Play className="h-8 w-8 text-white fill-white" />
                      </div>
                    </div>

                    {/* Views badge */}
                    <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-white font-medium flex items-center gap-1 border border-white/10">
                      <Eye className="h-3 w-3" />
                      {formatViews(video.views || 0)}
                    </div>
                  </div>

                  {/* Video Info */}
                  <div className="flex gap-3">
                    {/* Channel Avatar */}
                    {video.uploadedByAvatar ? (
                      <img
                        src={video.uploadedByAvatar}
                        alt={video.uploadedByUsername}
                        className="h-9 w-9 rounded-full flex-shrink-0 ring-2 ring-white/20"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ring-2 ring-white/20">
                        {video.uploadedByUsername.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Title and metadata */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-white line-clamp-2 mb-1 group-hover:text-emerald-300 transition-colors">
                        {video.title}
                      </h3>
                      
                      <p className="text-xs text-white/70 mb-1">
                        {video.uploadedByUsername}
                      </p>

                      <div className="flex items-center gap-1 text-xs text-white/60">
                        <span>{formatViews(video.views || 0)} просмотров</span>
                        <span>•</span>
                        <span>{formatDate(video.createdAt.toString())}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
