import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Video, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function VideoUpload() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploadProgress(Math.round(percentComplete));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (parseError) {
              console.error("JSON parse error:", parseError, "Response:", xhr.responseText);
              reject(new Error("Не удалось обработать ответ сервера"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || xhr.statusText || "Upload failed"));
            } catch {
              reject(new Error(xhr.statusText || "Upload failed"));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

        xhr.open("POST", "/api/videos/upload");
        xhr.send(formData);
      });
    },
    onSuccess: (data: any) => {
      // Invalidate queries чтобы обновить список видео
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      
      toast({
        title: "Успешно",
        description: "Видео загружено!",
      });
      
      // Перенаправляем на страницу просмотра видео
      navigate(`/video-platform/watch/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить видео",
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast({
        title: "Ошибка",
        description: "Выберите файл видео",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название видео",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description);

    uploadMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file type
      if (!selectedFile.type.startsWith("video/")) {
        toast({
          title: "Ошибка",
          description: "Пожалуйста, выберите видео файл",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <Card className="glass glass-border relative max-w-md">
          <CardContent className="text-center py-12">
            <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Требуется авторизация</h3>
            <p className="text-muted-foreground mb-4">
              Войдите через Discord, чтобы загружать видео
            </p>
            <Button onClick={() => navigate("/login")}>
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Button
          variant="ghost"
          className="glass glass-border gap-2"
          onClick={() => navigate("/videos")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к видео
        </Button>

        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-6 w-6 text-primary" />
              Загрузить видео
            </CardTitle>
            <CardDescription>
              Поделитесь своими видео с участниками клана
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="video-file">Файл видео *</Label>
                <Input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={uploadMutation.isPending}
                  data-testid="input-file"
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Выбран файл: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} МБ)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Название *</Label>
                <Input
                  id="title"
                  placeholder="Введите название видео..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploadMutation.isPending}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Введите описание видео..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={uploadMutation.isPending}
                  rows={4}
                  data-testid="input-description"
                />
              </div>

              {uploadMutation.isPending && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Загрузка...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} data-testid="progress-upload" />
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={uploadMutation.isPending || !file || !title.trim()}
                  className="flex-1"
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Загрузить видео
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/videos")}
                  disabled={uploadMutation.isPending}
                  data-testid="button-cancel"
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle>Требования к видео</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Поддерживаемые форматы: MP4, WebM, AVI, MOV, MKV</p>
            <p>• Максимальный размер: 5 ГБ</p>
            <p>• Рекомендуемое разрешение: 1080p или выше</p>
            <p>• После загрузки видео будет доступно всем участникам клана</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
