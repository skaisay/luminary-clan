import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Play, Eye, Clock } from "lucide-react";
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
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  if (days < 365) return `${Math.floor(days / 30)} мес. назад`;
  return `${Math.floor(days / 365)} г. назад`;
}

export default function VideoPlatformHome() {
  const { data: videos, isLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
  });

  return (
    <div className="px-0 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        {isLoading ? (
          <>
            {/* Mobile skeleton */}
            <div className="md:hidden space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video w-full bg-white/10" />
                  <div className="flex gap-3 px-3">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0 bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full bg-white/10" />
                      <Skeleton className="h-3 w-2/3 bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop skeleton */}
            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
          </>
        ) : !videos || videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center mb-6">
              <Play className="h-10 w-10 md:h-12 md:w-12 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl font-semibold text-white mb-2 text-center">
              Видео еще нет
            </h3>
            <p className="text-white/70 text-center max-w-md text-sm md:text-base">
              Будьте первым, кто загрузит видео на платформу!
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Layout - YouTube style vertical cards */}
            <div className="md:hidden space-y-4">
              {videos.map((video) => (
                <Link key={video.id} href={`/video-platform/watch/${video.id}`}>
                  <div className="cursor-pointer group" data-testid={`card-video-${video.id}`}>
                    {/* Full-width Thumbnail */}
                    <div className="relative aspect-video bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 overflow-hidden">
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
                      
                      {/* Views badge */}
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white font-medium flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatViews(video.views || 0)}
                      </div>
                    </div>

                    {/* Video Info - Mobile optimized */}
                    <div className="flex gap-3 p-3">
                      {/* Channel Avatar */}
                      {video.uploadedByAvatar ? (
                        <img
                          src={video.uploadedByAvatar}
                          alt={video.uploadedByUsername}
                          className="h-10 w-10 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {video.uploadedByUsername.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Title and metadata */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-white line-clamp-2 mb-1">
                          {video.title}
                        </h3>
                        
                        <div className="flex items-center gap-1 text-xs text-white/60 flex-wrap">
                          <span className="text-white/70">{video.uploadedByUsername}</span>
                          <span>•</span>
                          <span>{formatViews(video.views || 0)} просм.</span>
                          <span>•</span>
                          <span>{formatDate(video.createdAt.toString())}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Layout - Grid cards */}
            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {videos.map((video) => (
                <Link key={video.id} href={`/video-platform/watch/${video.id}`}>
                  <div className="cursor-pointer group" data-testid={`card-video-desktop-${video.id}`}>
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
          </>
        )}
      </div>
    </div>
  );
}
