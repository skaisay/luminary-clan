import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { News } from "@shared/schema";

export default function AdminNewsTab() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<News>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: news, isLoading } = useQuery<News[]>({
    queryKey: ["/api/news"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<News> }) => {
      const res = await apiRequest("PUT", `/api/admin/news/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news/latest"] });
      toast({ title: "Новость обновлена" });
      setEditingId(null);
      setEditData({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/news/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news/latest"] });
      toast({ title: "Новость удалена" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<News>) => {
      const res = await apiRequest("POST", "/api/admin/news", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news/latest"] });
      toast({ title: "Новость добавлена" });
      setIsAddDialogOpen(false);
    },
  });

  const handleEdit = (newsItem: News) => {
    setEditingId(newsItem.id);
    setEditData(newsItem);
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, data: editData });
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены что хотите удалить эту новость?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl neon-text-cyan">Управление Новостями</CardTitle>
            <CardDescription>
              Редактирование, добавление и удаление новостей клана
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-news">
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-2xl">
              <DialogHeader>
                <DialogTitle>Добавить новость</DialogTitle>
                <DialogDescription>Создайте новое объявление для клана</DialogDescription>
              </DialogHeader>
              <AddNewsForm onSubmit={(data) => addMutation.mutate(data)} isPending={addMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {news?.map((newsItem) => (
            <Card key={newsItem.id} className="glass-card border-primary/20" data-testid={`card-news-${newsItem.id}`}>
              <CardContent className="pt-6">
                {editingId === newsItem.id ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Заголовок</Label>
                      <Input
                        value={editData.title || ""}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Категория</Label>
                      <Input
                        value={editData.category || ""}
                        onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Содержание</Label>
                      <Textarea
                        value={editData.content || ""}
                        onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                        rows={5}
                      />
                    </div>
                    <div>
                      <Label>Автор</Label>
                      <Input
                        value={editData.authorName || ""}
                        onChange={(e) => setEditData({ ...editData, authorName: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleSave(newsItem.id)} data-testid={`button-save-news-${newsItem.id}`}>
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить
                      </Button>
                      <Button variant="outline" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4 mr-2" />
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-primary">{newsItem.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {newsItem.category} • {newsItem.authorName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(newsItem)} data-testid={`button-edit-news-${newsItem.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(newsItem.id)} data-testid={`button-delete-news-${newsItem.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-foreground/80">{newsItem.content}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AddNewsForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [formData, setFormData] = useState({
    title: "",
    category: "Общее",
    content: "",
    authorName: "Администрация",
    imageUrl: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Заголовок *</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          data-testid="input-news-title"
        />
      </div>
      <div>
        <Label>Категория</Label>
        <Input
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          data-testid="input-news-category"
        />
      </div>
      <div>
        <Label>Содержание *</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={6}
          required
          data-testid="textarea-news-content"
        />
      </div>
      <div>
        <Label>Автор</Label>
        <Input
          value={formData.authorName}
          onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
          data-testid="input-news-author"
        />
      </div>
      <div>
        <Label>URL изображения (опционально)</Label>
        <Input
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-news">
        {isPending ? "Добавление..." : "Добавить новость"}
      </Button>
    </form>
  );
}
