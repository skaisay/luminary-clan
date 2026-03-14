import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { User, Video as VideoIcon, Eye, Calendar, Edit, Upload as UploadIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Video as VideoType, ClanMember } from "@shared/schema";

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

interface ProfileProps {
  params?: { id?: string };
}

export default function Profile() {
  const params = useParams<{ id?: string }>();
  const viewingUserId = params?.id;
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const isOwnProfile = !viewingUserId || viewingUserId === user?.discordId;

  const { data: videos, isLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
    enabled: isAuthenticated,
  });

  const { data: member } = useQuery<ClanMember>({
    queryKey: ["/api/members", viewingUserId || user?.discordId],
    enabled: !!viewingUserId || (isAuthenticated && !!user?.discordId),
  });

  // Если просматриваем другого пользователя - не требуется авторизация
  const profileUserId = viewingUserId || (isAuthenticated ? user?.discordId : null);
  
  if (!profileUserId && !isOwnProfile) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <Card className="max-w-md w-full backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardContent className="text-center py-12">
            <User className="h-16 w-16 mx-auto text-white/70 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Требуется авторизация
            </h3>
            <p className="text-white/70 mb-6">
              Войдите в систему для просмотра профиля
            </p>
            <Button
              onClick={() => navigate("/video-platform")}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
              data-testid="button-login"
            >
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayUserId = viewingUserId || user?.discordId;
  const userVideos = videos?.filter(v => v.uploadedBy === displayUserId) || [];
  const totalViews = userVideos.reduce((sum, v) => sum + (v.views || 0), 0);

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile) return;
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
        localStorage.setItem(`profileBanner_${displayUserId}`, reader.result as string);
        setIsEditingBanner(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const savedBanner = displayUserId ? localStorage.getItem(`profileBanner_${displayUserId}`) : null;

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl overflow-hidden">
          <div className="relative h-32 md:h-40 bg-gradient-to-r from-emerald-500 to-cyan-500 overflow-hidden">
            {(bannerPreview || savedBanner) && (
              <img 
                src={bannerPreview || savedBanner || undefined} 
                alt="Profile Banner" 
                className="w-full h-full object-cover"
              />
            )}
            {isOwnProfile && (
              <Button
                onClick={() => setIsEditingBanner(true)}
                className="absolute top-2 right-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30"
                size="sm"
                data-testid="button-edit-banner"
              >
                <Edit className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
            )}
            {isEditingBanner && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <UploadIcon className="h-12 w-12" />
                    <span className="text-sm font-medium">Загрузить изображение</span>
                    <span className="text-xs text-white/70">Макс. 5 МБ</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                  />
                </label>
                <Button
                  onClick={() => setIsEditingBanner(false)}
                  className="absolute top-2 right-2 rounded-full"
                  size="sm"
                  variant="ghost"
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
          <CardContent className="relative px-3 md:px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 md:gap-4 -mt-12 md:-mt-16">
              <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-white/20 shadow-xl ring-4 ring-white/10 flex-shrink-0">
                <AvatarImage src={isOwnProfile ? user?.avatar : member?.avatar || undefined} />
                <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-2xl md:text-4xl">
                  {(isOwnProfile ? user?.username : member?.username)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 break-words">
                  {isOwnProfile ? user?.username : member?.username}
                </h1>
                <p className="text-white/70 mb-3 text-sm md:text-base break-all">
                  Discord ID: {displayUserId}
                </p>

                {/* Stats */}
                <div className="flex flex-wrap gap-4 md:gap-6">
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-white">{userVideos.length}</div>
                    <div className="text-xs md:text-sm text-white/70">Видео</div>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-white">{formatViews(totalViews)}</div>
                    <div className="text-xs md:text-sm text-white/70">Просмотров</div>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-white">
                      {formatDate(member?.joinedAt?.toString() || new Date().toISOString())}
                    </div>
                    <div className="text-xs md:text-sm text-white/70">Дата регистрации</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Footer - Bio Section */}
        {isOwnProfile && (
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-3">О профиле</h3>
              <p className="text-white/70">
                Ваш профиль на видео платформе. Просмотрите свои видео в разделе "Мои видео".
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
