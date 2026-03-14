import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, ToggleLeft, ToggleRight, Save, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PageAvailability } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPagesTab() {
  const { toast } = useToast();
  const [selectedPage, setSelectedPage] = useState<PageAvailability | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedPage, setEditedPage] = useState<Partial<PageAvailability>>({});

  const { data: pages, isLoading, error } = useQuery<PageAvailability[]>({
    queryKey: ["/api/admin/page-availability"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/page-availability/${id}`, {
        isEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/page-availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/page-availability"] });
      toast({
        title: "Успешно!",
        description: "Статус страницы обновлён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить статус",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PageAvailability> }) => {
      return await apiRequest("PATCH", `/api/admin/page-availability/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/page-availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/page-availability"] });
      toast({
        title: "Успешно!",
        description: "Сообщения обслуживания обновлены",
      });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить сообщения",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (page: PageAvailability) => {
    toggleMutation.mutate({
      id: page.id,
      isEnabled: !page.isEnabled,
    });
  };

  const handleEditMessages = (page: PageAvailability) => {
    setSelectedPage(page);
    setEditedPage({
      maintenanceTitleRu: page.maintenanceTitleRu,
      maintenanceTitleEn: page.maintenanceTitleEn,
      maintenanceMessageRu: page.maintenanceMessageRu,
      maintenanceMessageEn: page.maintenanceMessageEn,
    });
    setEditDialogOpen(true);
  };

  const handleSaveMessages = () => {
    if (!selectedPage) return;
    updateMutation.mutate({
      id: selectedPage.id,
      updates: editedPage,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="glass-card">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Ошибка загрузки данных
          </CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Не удалось загрузить список страниц"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/page-availability"] })}
            variant="outline"
            className="gap-2"
            data-testid="button-retry"
          >
            Попробовать снова
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Управление доступностью страниц
          </CardTitle>
          <CardDescription>
            Нет доступных страниц для управления
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Управление доступностью страниц
              </CardTitle>
              <CardDescription>
                Включайте и отключайте страницы приложения
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pages && pages.map((page) => (
              <Card
                key={page.id}
                className={`glass-card hover-elevate ${
                  !page.isEnabled ? "border-orange-500/40" : "border-primary/10"
                }`}
                data-testid={`card-page-${page.pageId}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-lg">{page.pageName}</span>
                        {page.isEnabled ? (
                          <Badge variant="default" className="gap-1 bg-green-500">
                            <ToggleRight className="h-3 w-3" />
                            Активна
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <ToggleLeft className="h-3 w-3" />
                            Заблокирована
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ID страницы: <code className="text-xs bg-muted px-1 rounded">{page.pageId}</code>
                      </div>
                      {!page.isEnabled && (
                        <div className="flex gap-2 items-start text-sm">
                          <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">Сообщение RU: </span>
                            <span className="text-foreground">{page.maintenanceMessageRu || "Не задано"}</span>
                          </div>
                        </div>
                      )}
                      {page.updatedBy && (
                        <div className="text-xs text-muted-foreground">
                          Изменено: {page.updatedBy} • {new Date(page.updatedAt).toLocaleString('ru-RU')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditMessages(page)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        data-testid={`button-edit-${page.pageId}`}
                      >
                        <Save className="h-4 w-4" />
                        Сообщения
                      </Button>
                      <Switch
                        checked={page.isEnabled}
                        onCheckedChange={() => handleToggle(page)}
                        disabled={toggleMutation.isPending}
                        data-testid={`switch-${page.pageId}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-messages">
          <DialogHeader>
            <DialogTitle>Редактировать сообщения обслуживания</DialogTitle>
            <DialogDescription>
              Настройте сообщения для {selectedPage?.pageName}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="ru" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ru">Русский</TabsTrigger>
              <TabsTrigger value="en">English</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ru" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titleRu">Заголовок (Русский)</Label>
                <Input
                  id="titleRu"
                  value={editedPage.maintenanceTitleRu || ""}
                  onChange={(e) =>
                    setEditedPage({ ...editedPage, maintenanceTitleRu: e.target.value })
                  }
                  placeholder="Технические работы"
                  data-testid="input-title-ru"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="messageRu">Сообщение (Русский)</Label>
                <Textarea
                  id="messageRu"
                  value={editedPage.maintenanceMessageRu || ""}
                  onChange={(e) =>
                    setEditedPage({ ...editedPage, maintenanceMessageRu: e.target.value })
                  }
                  placeholder="Страница временно недоступна. Ведутся технические работы."
                  rows={4}
                  data-testid="textarea-message-ru"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="en" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titleEn">Title (English)</Label>
                <Input
                  id="titleEn"
                  value={editedPage.maintenanceTitleEn || ""}
                  onChange={(e) =>
                    setEditedPage({ ...editedPage, maintenanceTitleEn: e.target.value })
                  }
                  placeholder="Under Maintenance"
                  data-testid="input-title-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="messageEn">Message (English)</Label>
                <Textarea
                  id="messageEn"
                  value={editedPage.maintenanceMessageEn || ""}
                  onChange={(e) =>
                    setEditedPage({ ...editedPage, maintenanceMessageEn: e.target.value })
                  }
                  placeholder="Page temporarily unavailable. Under maintenance."
                  rows={4}
                  data-testid="textarea-message-en"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              data-testid="button-cancel"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSaveMessages}
              disabled={updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
