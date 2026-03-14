import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquarePlus, Send, Clock, CheckCircle, XCircle, User2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insertRequestSchema, type Request } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function RequestsPage() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { data: requests, isLoading } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
  });

  const form = useForm({
    resolver: zodResolver(insertRequestSchema),
    defaultValues: {
      username: "",
      discordId: "",
      requestType: undefined,
      content: "",
      status: "pending",
      adminResponse: null,
      respondedBy: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Успешно!",
        description: "Ваш запрос отправлен администраторам",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить запрос",
        variant: "destructive",
      });
    },
  });

  const getDiscordAvatarUrl = (discordId: string | null) => {
    if (!discordId) return null;
    const defaultAvatar = parseInt(discordId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3" />
            Ожидает
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="gap-1 bg-green-500" data-testid={`badge-status-approved`}>
            <CheckCircle className="h-3 w-3" />
            Одобрено
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1" data-testid={`badge-status-rejected`}>
            <XCircle className="h-3 w-3" />
            Отклонено
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl relative">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center justify-center gap-3">
          <MessageSquarePlus className="h-10 w-10 text-primary" strokeWidth={1.5} />
          {t('requests.title')}
        </h1>
        <p className="text-muted-foreground text-lg mb-4">
          {t('requests.description')}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="neon-glow-cyan" data-testid="button-create-request">
              <Send className="h-5 w-5 mr-2" />
              Создать Запрос
            </Button>
          </DialogTrigger>
          <DialogContent className="glass glass-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="neon-text-cyan">Новый Запрос</DialogTitle>
              <DialogDescription>
                Отправьте заявку администраторам клана
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ваше Имя</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Введите ваше имя..." data-testid="input-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discordId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discord ID (необязательно)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="Ваш Discord ID..." data-testid="input-discord-id" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requestType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип Запроса</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-request-type">
                            <SelectValue placeholder="Выберите тип запроса" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Модератор">Модератор</SelectItem>
                          <SelectItem value="Помощник">Помощник</SelectItem>
                          <SelectItem value="Админ">Админ</SelectItem>
                          <SelectItem value="Вопрос">Вопрос</SelectItem>
                          <SelectItem value="Другое">Другое</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сообщение</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Опишите ваш запрос..." 
                          className="min-h-32"
                          data-testid="textarea-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full neon-glow-cyan"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-request"
                >
                  {createMutation.isPending ? "Отправка..." : "Отправить Запрос"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass glass-border">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : requests && requests.length > 0 ? (
          requests.map((request) => (
            <Card key={request.id} className="glass glass-border neon-glow-purple" data-testid={`card-request-${request.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getDiscordAvatarUrl(request.discordId) || undefined} />
                      <AvatarFallback>
                        <User2 className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-xl">{request.username}</CardTitle>
                        <Badge variant="secondary" data-testid={`badge-type-${request.id}`}>{request.requestType}</Badge>
                      </div>
                      {request.discordId && (
                        <p className="text-xs text-muted-foreground">
                          Discord ID: {request.discordId}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString("ru-RU", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Запрос:</h4>
                  <p className="text-sm leading-relaxed" data-testid={`text-content-${request.id}`}>{request.content}</p>
                </div>
                
                {request.adminResponse && (
                  <div className="glass rounded-lg p-4 border border-primary/20">
                    <h4 className="font-semibold mb-2 text-sm neon-text-cyan flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Ответ Администратора:
                    </h4>
                    <p className="text-sm leading-relaxed mb-2" data-testid={`text-response-${request.id}`}>{request.adminResponse}</p>
                    {request.respondedBy && (
                      <p className="text-xs text-muted-foreground">— {request.respondedBy}</p>
                    )}
                    {request.respondedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(request.respondedAt).toLocaleDateString("ru-RU", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="glass glass-border">
            <CardContent className="py-12">
              <div className="text-center">
                <MessageSquarePlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-bold mb-2">Нет Запросов</h3>
                <p className="text-muted-foreground mb-4">
                  Создайте свой первый запрос администраторам
                </p>
                <Button onClick={() => setOpen(true)} className="neon-glow-cyan">
                  <Send className="h-5 w-5 mr-2" />
                  Создать Запрос
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
