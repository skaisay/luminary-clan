import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, Users, Video, Trash2, Edit, UserPlus, Search, Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Video as VideoType, VideoPlatformAdmin, ClanMember } from "@shared/schema";

const SUPER_ADMIN_ID = "1254059406744621068";

export default function VideoPlatformAdmin() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [editVideoOpen, setEditVideoOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoType | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Check admin access
  const { data: adminCheck, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean; isSuperAdmin: boolean }>({
    queryKey: ["/api/video-platform/check-admin"],
    enabled: isAuthenticated,
  });

  // Get all videos
  const { data: videos = [], isLoading: loadingVideos } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
  });

  // Get all admins
  const { data: admins = [], isLoading: loadingAdmins } = useQuery<VideoPlatformAdmin[]>({
    queryKey: ["/api/video-platform/admins"],
    enabled: adminCheck?.isAdmin || adminCheck?.isSuperAdmin,
  });

  // Get all members for adding admin
  const { data: members = [] } = useQuery<ClanMember[]>({
    queryKey: ["/api/members"],
    enabled: adminCheck?.isSuperAdmin,
  });

  // Delete video mutation
  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      console.log(`🗑️ Отправка запроса на удаление видео: ${videoId}`);
      const response = await apiRequest("DELETE", `/api/videos/${videoId}`);
      console.log(`✅ Видео удалено:`, response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
      console.error(`❌ Ошибка удаления видео:`, error);
      alert(`Ошибка удаления: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  // Edit video mutation
  const editVideoMutation = useMutation({
    mutationFn: async ({ videoId, title, description }: { videoId: string; title: string; description: string }) => {
      return apiRequest("PATCH", `/api/videos/${videoId}`, { title, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setEditVideoOpen(false);
      setEditingVideo(null);
    },
  });

  // Add admin mutation
  const addAdminMutation = useMutation({
    mutationFn: async (discordId: string) => {
      return apiRequest("POST", "/api/video-platform/admins", { discordId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-platform/admins"] });
      setAddAdminOpen(false);
      setSelectedMember("");
    },
  });

  // Remove admin mutation
  const removeAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      return apiRequest("DELETE", `/api/video-platform/admins/${adminId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-platform/admins"] });
    },
  });

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <Skeleton className="w-full max-w-4xl h-96 bg-white/10" />
      </div>
    );
  }

  // Access control
  const isSuperAdmin = user?.discordId === SUPER_ADMIN_ID;
  const hasAccess = adminCheck?.isAdmin || adminCheck?.isSuperAdmin || isSuperAdmin;

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <Card className="max-w-md w-full backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardContent className="text-center py-12">
            <Shield className="h-16 w-16 mx-auto text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Доступ запрещён
            </h3>
            <p className="text-white/70 mb-6">
              У вас нет прав администратора видео платформы
            </p>
            <Button
              onClick={() => navigate("/video-platform")}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              data-testid="button-back"
            >
              Вернуться назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.uploadedByUsername.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditVideo = (video: VideoType) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || "");
    setEditVideoOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl text-white">Админ панель</CardTitle>
              <CardDescription className="text-white/70">
                Управление видео платформой
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="videos" className="space-y-4">
        <TabsList className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-1">
          <TabsTrigger 
            value="videos" 
            className="rounded-xl data-[state=active]:bg-white/20 text-white"
            data-testid="tab-videos"
          >
            <Video className="h-4 w-4 mr-2" />
            Видео
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger 
              value="admins" 
              className="rounded-xl data-[state=active]:bg-white/20 text-white"
              data-testid="tab-admins"
            >
              <Users className="h-4 w-4 mr-2" />
              Админы
            </TabsTrigger>
          )}
        </TabsList>

        {/* Videos Tab */}
        <TabsContent value="videos" className="space-y-4">
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                <CardTitle className="text-white">Все видео ({videos.length})</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    placeholder="Поиск видео..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    data-testid="input-search-videos"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingVideos ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full bg-white/10 rounded-xl" />
                  ))}
                </div>
              ) : filteredVideos.length === 0 ? (
                <p className="text-white/50 text-center py-8">Видео не найдено</p>
              ) : (
                <div className="space-y-3">
                  {filteredVideos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                      data-testid={`video-item-${video.id}`}
                    >
                      {/* Thumbnail */}
                      <div className="w-24 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                        {video.thumbnailPath ? (
                          <img
                            src={`/api/videos/${video.id}/thumbnail`}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="h-6 w-6 text-white/30" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{video.title}</h3>
                        <p className="text-white/50 text-sm">{video.uploadedByUsername}</p>
                        <p className="text-white/40 text-xs">{video.views} просмотров</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditVideo(video)}
                          className="rounded-full text-white hover:bg-white/20"
                          data-testid={`button-edit-${video.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Удалить это видео?")) {
                              deleteVideoMutation.mutate(video.id);
                            }
                          }}
                          disabled={deleteVideoMutation.isPending}
                          className="rounded-full text-red-400 hover:bg-red-500/20"
                          data-testid={`button-delete-${video.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admins Tab - Super Admin Only */}
        {isSuperAdmin && (
          <TabsContent value="admins" className="space-y-4">
            <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Администраторы</CardTitle>
                  <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        data-testid="button-add-admin"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Добавить
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="backdrop-blur-xl bg-gray-900/95 border-white/20 rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-white">Добавить администратора</DialogTitle>
                        <DialogDescription className="text-white/70">
                          Выберите участника клана для назначения админом
                        </DialogDescription>
                      </DialogHeader>
                      <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white rounded-xl">
                          <SelectValue placeholder="Выберите участника" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/20">
                          {members
                            .filter(m => m.discordId && !admins.some(a => a.discordId === m.discordId))
                            .map((member) => (
                              <SelectItem 
                                key={member.id} 
                                value={member.discordId || ""} 
                                className="text-white"
                              >
                                {member.username}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <DialogFooter>
                        <Button
                          onClick={() => selectedMember && addAdminMutation.mutate(selectedMember)}
                          disabled={!selectedMember || addAdminMutation.isPending}
                          className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                          data-testid="button-confirm-add-admin"
                        >
                          Добавить
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {/* Super Admin - always first */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
                    <Avatar className="h-12 w-12 ring-2 ring-emerald-500">
                      <AvatarImage src={user?.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
                        K
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">kairozun</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Супер-админ
                        </Badge>
                      </div>
                      <p className="text-white/50 text-sm">Владелец платформы</p>
                    </div>
                  </div>

                  {/* Other admins */}
                  {loadingAdmins ? (
                    <Skeleton className="h-20 w-full bg-white/10 rounded-xl" />
                  ) : (
                    admins.map((admin) => (
                      <div
                        key={admin.id}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5"
                        data-testid={`admin-item-${admin.id}`}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={admin.avatar || undefined} />
                          <AvatarFallback className="bg-white/20 text-white">
                            {admin.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <span className="text-white font-medium">{admin.username}</span>
                          <p className="text-white/50 text-sm">
                            Добавлен: {admin.addedByUsername}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Удалить ${admin.username} из админов?`)) {
                              removeAdminMutation.mutate(admin.id);
                            }
                          }}
                          disabled={removeAdminMutation.isPending}
                          className="rounded-full text-red-400 hover:bg-red-500/20"
                          data-testid={`button-remove-admin-${admin.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Video Dialog */}
      <Dialog open={editVideoOpen} onOpenChange={setEditVideoOpen}>
        <DialogContent className="backdrop-blur-xl bg-gray-900/95 border-white/20 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">Редактировать видео</DialogTitle>
            <DialogDescription className="text-white/70">
              Измените название и описание видео
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm">Название</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-white/10 border-white/20 text-white rounded-xl mt-1"
                data-testid="input-edit-title"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm">Описание</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-white/10 border-white/20 text-white rounded-xl mt-1"
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (editingVideo) {
                  editVideoMutation.mutate({
                    videoId: editingVideo.id,
                    title: editTitle,
                    description: editDescription,
                  });
                }
              }}
              disabled={editVideoMutation.isPending}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              data-testid="button-save-edit"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
