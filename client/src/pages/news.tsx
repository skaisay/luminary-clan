import { useQuery, useMutation } from "@tanstack/react-query";
import { Newspaper, Plus, Calendar, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertNewsSchema, type News } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NewsPage() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { data: news, isLoading } = useQuery<News[]>({
    queryKey: ["/api/news"],
  });

  const form = useForm({
    resolver: zodResolver(insertNewsSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "General",
      authorName: "",
      imageUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/news", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({
        title: "Успешно!",
        description: "Новость опубликована",
      });
      setOpen(false);
      form.reset();
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide">
          {t('news.title')}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('news.description')}
        </p>
      </div>

      <div className="flex justify-center mb-6">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="neon-glow-cyan" data-testid="button-create-news">
              <Plus className="h-5 w-5 mr-2" />
              Создать Новость
            </Button>
          </DialogTrigger>
          <DialogContent className="glass glass-border">
            <DialogHeader>
              <DialogTitle>Новая Новость</DialogTitle>
              <DialogDescription>
                Создайте объявление для участников клана
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Заголовок</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Введите заголовок..." data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Содержание</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Введите текст новости..." rows={5} data-testid="input-content" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Категория</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Общее, Событие, Турнир..." data-testid="input-category" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Автор</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ваше имя" data-testid="input-author" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full neon-glow-cyan" disabled={createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending ? "Публикация..." : "Опубликовать"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {news?.map((article) => (
            <Card key={article.id} className="glass glass-border hover-elevate transition-all" data-testid={`card-news-${article.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <Badge className="neon-glow-purple" variant="outline">
                    {article.category}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(article.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <CardTitle className="text-2xl">{article.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4 line-clamp-3">
                  {article.content}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t border-border/50">
                  <User className="h-4 w-4" />
                  <span>{article.authorName}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
