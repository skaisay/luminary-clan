import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Video as VideoIcon, Eye, Upload as UploadIcon, User as UserIcon } from "lucide-react";
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
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function MyVideos() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const { data: videos, isLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
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
              Войдите в систему чтобы видеть свои видео
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

  const userVideos = videos?.filter(v => v.uploadedBy === user?.discordId) || [];

  return (
    <div className="p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <VideoIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Мои видео</h1>
          </div>
          <p className="text-white/70">Видео, которые вы загрузили</p>
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
        ) : userVideos.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
            <CardContent className="text-center py-20">
              <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center mb-6 mx-auto">
                <VideoIcon className="h-12 w-12 text-white/50" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">
                Нет загруженных видео
              </h3>
              <p className="text-white/70 text-center max-w-md mx-auto mb-6">
                Загрузите своё первое видео, чтобы оно появилось здесь!
              </p>
              <Button
                onClick={() => navigate("/video-platform/upload")}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
                data-testid="button-upload"
              >
                <UploadIcon className="mr-2 h-4 w-4" />
                Загрузить видео
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {userVideos.map((video: VideoType) => (
              <Card
                key={video.id}
                className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl overflow-hidden cursor-pointer hover:bg-white/20 transition-all hover:scale-105"
                onClick={() => navigate(`/video-platform/watch/${video.id}`)}
                data-testid={`card-video-${video.id}`}
              >
                <div className="aspect-video bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center relative overflow-hidden">
                  {video.thumbnailPath ? (
                    <img 
                      src={`/api/videos/${video.id}/thumbnail`} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <VideoIcon className="h-12 w-12 text-white/50" />
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold mb-2 line-clamp-2">
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatViews(video.views || 0)}
                    </div>
                    <span>•</span>
                    <span>{formatDate(video.createdAt?.toString() || new Date().toISOString())}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
