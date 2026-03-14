import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Film, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import DiscordAuthModal from "@/components/video-platform/DiscordAuthModal";

export default function VideoUpload() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const xhr = new XMLHttpRequest();
      
      return new Promise<any>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadProgress(Math.round(progress));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error(`Invalid response from server: ${xhr.responseText}`));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || `Upload failed: ${xhr.statusText}`));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
            }
          }
        });

        xhr.addEventListener("error", (e) => {
          console.error("XHR error event:", e);
          reject(new Error("Upload failed: Network error"));
        });
        
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open("POST", "/api/videos/upload");
        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      setUploadProgress(0);
      setTitle("");
      setDescription("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.refetchQueries({ queryKey: ["/api/videos"] });
      queryClient.refetchQueries({ queryKey: ["/api/my-channel"] });
      setTimeout(() => {
        navigate(`/video-platform/watch/${data.id}`);
      }, 1000);
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      console.error("Upload failed:", error);
      alert(`Ошибка загрузки: ${error.message}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated || !user) {
      navigate("/login");
      return;
    }

    if (!file) {
      return;
    }

    if (!title.trim()) {
      return;
    }

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description);

    uploadMutation.mutate(formData);
  };

  if (!isAuthenticated || !user) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] md:min-h-[calc(100vh-4rem)] p-4 md:p-6">
          <Card className="max-w-md w-full backdrop-blur-xl bg-white/10 border-white/20 rounded-2xl md:rounded-3xl">
            <CardContent className="text-center py-10 md:py-12 px-4 md:px-6">
              <Upload className="h-12 w-12 md:h-16 md:w-16 mx-auto text-white mb-4" />
              <h3 className="text-base md:text-lg font-semibold text-white mb-2">
                Требуется авторизация
              </h3>
              <p className="text-white/70 mb-6 text-sm">
                Войдите через Discord для загрузки видео
              </p>
              <Button
                onClick={() => setShowAuthModal(true)}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
                data-testid="button-login"
              >
                Войти через Discord
              </Button>
            </CardContent>
          </Card>
        </div>
        <DiscordAuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      </>
    );
  }

  return (
    <div className="p-3 md:p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-2xl md:rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-white/20 px-4 py-4 md:px-6 md:py-6">
            <div className="flex items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 backdrop-blur-md border border-white/20">
                <Film className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg md:text-2xl text-white">Загрузить видео</CardTitle>
                <p className="text-xs md:text-sm text-white/70 mt-0.5 md:mt-1">
                  Поделитесь своим видео
                </p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 md:p-6">
            {uploadProgress > 0 && uploadProgress < 100 ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center py-8 md:py-12">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 backdrop-blur-xl flex items-center justify-center mb-4 md:mb-6 border border-white/20">
                    <Upload className="h-8 w-8 md:h-10 md:w-10 text-white animate-pulse" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                    Загрузка видео...
                  </h3>
                  <p className="text-xs md:text-sm text-white/70 mb-4 md:mb-6 text-center">
                    Пожалуйста, не закрывайте страницу
                  </p>
                  <div className="w-full max-w-md">
                    <Progress value={uploadProgress} className="h-2 mb-2" />
                    <p className="text-center text-sm font-medium text-emerald-300">
                      {uploadProgress}%
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                {/* File Upload */}
                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="video" className="text-sm md:text-base font-semibold text-white">Видеофайл</Label>
                  <div className="border-2 border-dashed border-white/30 rounded-2xl md:rounded-3xl p-6 md:p-8 text-center hover:border-emerald-400/50 transition-colors backdrop-blur-sm bg-white/5">
                    <Input
                      id="video"
                      type="file"
                      accept="video/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      data-testid="input-file"
                    />
                    <label htmlFor="video" className="cursor-pointer">
                      {file ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-emerald-400 mb-3" />
                          <p className="text-sm font-medium text-white mb-1 break-all px-2">
                            {file.name}
                          </p>
                          <p className="text-xs text-white/70">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setFile(null);
                            }}
                            className="mt-2 rounded-full text-white hover:bg-white/20 text-xs"
                          >
                            Выбрать другой
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="h-10 w-10 md:h-12 md:w-12 text-white/70 mb-3" />
                          <p className="text-sm font-medium text-white mb-1">
                            Нажмите для выбора
                          </p>
                          <p className="text-xs text-white/70">
                            или перетащите файл
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="title" className="text-sm md:text-base font-semibold text-white">Название</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Введите название видео"
                    className="rounded-xl md:rounded-2xl h-11 md:h-12 text-sm md:text-base bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:bg-white/20"
                    data-testid="input-title"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="description" className="text-sm md:text-base font-semibold text-white">
                    Описание <span className="text-white/50 font-normal">(опционально)</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Расскажите о видео..."
                    className="rounded-xl md:rounded-2xl resize-none min-h-24 md:min-h-32 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:bg-white/20 text-sm md:text-base"
                    data-testid="input-description"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 md:gap-3 pt-2 md:pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/video-platform")}
                    className="rounded-full border-white/30 bg-white/10 hover:bg-white/20 text-white w-full sm:w-auto"
                    data-testid="button-cancel"
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploadMutation.isPending || !file || !title.trim()}
                    className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-6 md:px-8 w-full sm:w-auto"
                    data-testid="button-upload"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Загрузить
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
