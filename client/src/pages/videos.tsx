import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Video, Play, Upload, Eye, ThumbsUp, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Video as VideoType } from "@shared/schema";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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

export default function Videos() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: videos, isLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
  });

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="glass glass-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse-glow">
                <Video className="inline-block mr-3 h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                Видеоплатформа
              </h1>
              <p className="text-muted-foreground mt-2">
                Смотрите и делитесь видео с участниками клана
              </p>
            </div>
            {user ? (
              <Link href="/videos/upload">
                <Button className="glass glass-border gap-2" data-testid="button-upload">
                  <Upload className="h-4 w-4" />
                  Загрузить видео
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="glass glass-border">
                <CardHeader>
                  <Skeleton className="h-48 w-full rounded-lg" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !videos || videos.length === 0 ? (
          <Card className="glass glass-border">
            <CardContent className="text-center py-12">
              <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Видео еще нет</h3>
              <p className="text-muted-foreground mb-4">
                Будьте первым, кто загрузит видео!
              </p>
              {user ? (
                <Link href="/videos/upload">
                  <Button data-testid="button-upload-first">
                    <Upload className="h-4 w-4 mr-2" />
                    Загрузить видео
                  </Button>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Войдите через Discord, чтобы загружать видео
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link key={video.id} href={`/videos/${video.id}`}>
                <Card className="glass glass-border hover-elevate active-elevate-2 h-full group cursor-pointer" data-testid={`card-video-${video.id}`}>
                  <CardHeader className="relative overflow-hidden">
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <Play className="h-16 w-16 text-white opacity-80 group-hover:opacity-100 transition-opacity z-10" />
                      <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1 z-10">
                        <Eye className="h-3 w-3" />
                        {video.views || 0}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <CardTitle className="text-lg line-clamp-2">{video.title}</CardTitle>
                    {video.description && (
                      <CardDescription className="line-clamp-2">
                        {video.description}
                      </CardDescription>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(video.createdAt.toString())}
                      </span>
                      <span>{formatFileSize(video.fileSize)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {video.uploadedByAvatar ? (
                        <img
                          src={video.uploadedByAvatar}
                          alt={video.uploadedByUsername}
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                          {video.uploadedByUsername.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {video.uploadedByUsername}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
