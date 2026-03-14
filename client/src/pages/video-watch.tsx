import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Video, ThumbsUp, Eye, Clock, Send, Trash2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { Video as VideoType, VideoComment } from "@shared/schema";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ru-RU', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

interface VideoData extends VideoType {
  likeCount: number;
  comments: VideoComment[];
  hasLiked: boolean;
}

export default function VideoWatch() {
  const [, params] = useRoute("/videos/:id");
  const videoId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const { data: video, isLoading } = useQuery<VideoData>({
    queryKey: ["/api/videos", videoId],
    enabled: !!videoId,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/videos/${videoId}/like`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось поставить лайк",
        variant: "destructive",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest(`/api/videos/${videoId}/comments`, "POST", { content });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId] });
      toast({
        title: "Успешно",
        description: "Комментарий добавлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить комментарий",
        variant: "destructive",
      });
    },
  });

  const handleComment = () => {
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <Card className="glass glass-border relative max-w-md">
          <CardContent className="text-center py-12">
            <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Видео не найдено</h3>
            <Link href="/videos">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к видео
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/videos">
          <Button variant="ghost" className="glass glass-border gap-2 mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Назад к видео
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass glass-border">
              <CardContent className="p-6">
                <video
                  controls
                  className="w-full aspect-video bg-black rounded-lg"
                  data-testid="video-player"
                  src={`/api/videos/${video.id}/stream`}
                >
                  Ваш браузер не поддерживает видео тег.
                </video>
              </CardContent>
            </Card>

            <Card className="glass glass-border">
              <CardContent className="p-6 space-y-4">
                <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-video-title">
                  {video.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    {video.uploadedByAvatar ? (
                      <img
                        src={video.uploadedByAvatar}
                        alt={video.uploadedByUsername}
                        className="h-10 w-10 rounded-full"
                        data-testid="img-author-avatar"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        {video.uploadedByUsername.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold" data-testid="text-author-name">
                        {video.uploadedByUsername}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {formatDate(video.createdAt.toString())}
                      </p>
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <span data-testid="text-views">{video.views || 0}</span>
                    </div>
                    <Button
                      onClick={() => user && likeMutation.mutate()}
                      variant={video.hasLiked ? "default" : "outline"}
                      className="gap-2"
                      disabled={!user || likeMutation.isPending}
                      data-testid="button-like"
                    >
                      <ThumbsUp className={`h-4 w-4 ${video.hasLiked ? "fill-current" : ""}`} />
                      <span data-testid="text-likes">{video.likeCount || 0}</span>
                    </Button>
                  </div>
                </div>

                {video.description && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
                      {video.description}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-border text-sm text-muted-foreground">
                  Размер файла: {formatFileSize(video.fileSize)}
                </div>
              </CardContent>
            </Card>

            <Card className="glass glass-border">
              <CardHeader>
                <CardTitle>
                  Комментарии ({video.comments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <div className="flex gap-4">
                    <Textarea
                      placeholder="Добавить комментарий..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1"
                      data-testid="input-comment"
                    />
                    <Button
                      onClick={handleComment}
                      disabled={!commentText.trim() || commentMutation.isPending}
                      data-testid="button-send-comment"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Войдите через Discord, чтобы оставлять комментарии
                  </p>
                )}

                <div className="space-y-4">
                  {video.comments && video.comments.length > 0 ? (
                    video.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 p-4 rounded-lg bg-muted/50" data-testid={`comment-${comment.id}`}>
                        {comment.avatar ? (
                          <img
                            src={comment.avatar}
                            alt={comment.username}
                            className="h-8 w-8 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            {comment.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{comment.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(comment.createdAt.toString())}
                            </p>
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Комментариев пока нет. Будьте первым!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="glass glass-border">
              <CardHeader>
                <CardTitle>Статистика</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Просмотры</span>
                  <span className="font-semibold">{video.views || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Лайки</span>
                  <span className="font-semibold">{video.likeCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Комментарии</span>
                  <span className="font-semibold">{video.comments?.length || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
