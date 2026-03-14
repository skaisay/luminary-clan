import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Search as SearchIcon, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  return `${Math.floor(days / 7)} нед. назад`;
}

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const query = searchParams.get('q') || '';

  const { data: videos, isLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/videos", "search", query],
    queryFn: async () => {
      const res = await fetch(`/api/videos?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to search videos");
      return res.json();
    },
    enabled: !!query,
  });

  const filteredVideos = videos || [];

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Результаты поиска: "{query}"
          </h1>
          <p className="text-white/70">
            {isLoading ? 'Поиск...' : `Найдено ${filteredVideos.length} видео`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-4">
                <Skeleton className="w-full sm:w-80 aspect-video rounded-2xl sm:flex-shrink-0 bg-white/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4 bg-white/10" />
                  <Skeleton className="h-4 w-1/2 bg-white/10" />
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-4 w-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
            <CardContent className="text-center py-12">
              <SearchIcon className="h-16 w-16 mx-auto text-white/70 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Ничего не найдено
              </h3>
              <p className="text-white/70">
                Попробуйте изменить поисковый запрос
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVideos.map((video) => (
              <Link key={video.id} href={`/video-platform/watch/${video.id}`}>
                <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl hover:bg-white/10 backdrop-blur-md cursor-pointer transition-all group border border-transparent hover:border-white/20" data-testid={`video-${video.id}`}>
                  {/* Thumbnail */}
                  <div className="relative w-full sm:w-80 aspect-video bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 backdrop-blur-xl rounded-2xl overflow-hidden sm:flex-shrink-0 border border-white/20">
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
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="rounded-full bg-white/20 backdrop-blur-md p-3 border border-white/30">
                        <Play className="h-6 w-6 text-white fill-white" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white line-clamp-2 mb-2 group-hover:text-emerald-300 transition-colors">
                      {video.title}
                    </h3>

                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
                      <span>{formatViews(video.views || 0)} просмотров</span>
                      <span>•</span>
                      <span>{formatDate(video.createdAt.toString())}</span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      {video.uploadedByAvatar ? (
                        <img
                          src={video.uploadedByAvatar}
                          alt={video.uploadedByUsername}
                          className="h-6 w-6 rounded-full ring-2 ring-white/20"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-xs ring-2 ring-white/20">
                          {video.uploadedByUsername.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-white/70">
                        {video.uploadedByUsername}
                      </span>
                    </div>

                    {video.description && (
                      <p className="text-sm text-white/70 line-clamp-2">
                        {video.description}
                      </p>
                    )}
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
