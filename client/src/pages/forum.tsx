import { useQuery, useMutation } from "@tanstack/react-query";
import { MessagesSquare, Plus, MessageCircle, Eye, Pin, Lock, Send } from "lucide-react";
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
import { insertForumTopicSchema, insertForumReplySchema, type ForumTopic, type ForumReply } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

const getDiscordAvatarUrl = (discordId: string | null) => {
  if (!discordId) return null;
  const defaultAvatar = parseInt(discordId) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
};

function TopicCard({ topic }: { topic: ForumTopic }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: replies } = useQuery<ForumReply[]>({
    queryKey: ["/api/forum/topics", topic.id, "replies"],
    enabled: open,
  });

  const replyForm = useForm({
    resolver: zodResolver(insertForumReplySchema),
    defaultValues: {
      authorUsername: "",
      authorDiscordId: "",
      content: "",
      topicId: topic.id,
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/forum/topics/${topic.id}/replies`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics", topic.id, "replies"] });
      toast({
        title: "Успешно!",
        description: "Ответ опубликован",
      });
      replyForm.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="glass glass-border neon-glow-purple hover-elevate cursor-pointer" data-testid={`card-topic-${topic.id}`}>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10 mt-1">
                <AvatarImage src={getDiscordAvatarUrl(topic.authorDiscordId) || undefined} />
                <AvatarFallback>
                  <MessageCircle className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {topic.isPinned && (
                    <Pin className="h-4 w-4 text-primary" data-testid={`icon-pinned-${topic.id}`} />
                  )}
                  {topic.isLocked && (
                    <Lock className="h-4 w-4 text-muted-foreground" data-testid={`icon-locked-${topic.id}`} />
                  )}
                  <CardTitle className="text-xl" data-testid={`text-topic-title-${topic.id}`}>{topic.title}</CardTitle>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    {topic.authorUsername}
                  </span>
                  {topic.authorDiscordId && (
                    <span className="text-xs">ID: {topic.authorDiscordId}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {topic.views}
                  </span>
                  <span>
                    {new Date(topic.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-topic-content-${topic.id}`}>
              {topic.content}
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="glass glass-border max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="neon-text-cyan flex items-center gap-2">
                {topic.isPinned && <Pin className="h-5 w-5" />}
                {topic.title}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={getDiscordAvatarUrl(topic.authorDiscordId) || undefined} />
                  <AvatarFallback>
                    <MessageCircle className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span>{topic.authorUsername}</span>
                {topic.authorDiscordId && (
                  <>
                    <span>•</span>
                    <span className="text-xs">ID: {topic.authorDiscordId}</span>
                  </>
                )}
                <span>•</span>
                <span>{new Date(topic.createdAt).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="glass glass-border rounded-lg p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{topic.content}</p>
          </div>

          {replies && replies.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Ответы ({replies.length})</h3>
              {replies.map((reply) => (
                <div key={reply.id} className="glass glass-border rounded-lg p-4" data-testid={`reply-${reply.id}`}>
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={getDiscordAvatarUrl(reply.authorDiscordId) || undefined} />
                      <AvatarFallback>
                        <MessageCircle className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{reply.authorUsername}</span>
                    {reply.authorDiscordId && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground text-xs">ID: {reply.authorDiscordId}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(reply.createdAt).toLocaleDateString("ru-RU", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                </div>
              ))}
            </div>
          )}

          {!topic.isLocked && (
            <Form {...replyForm}>
              <form onSubmit={replyForm.handleSubmit((data) => replyMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={replyForm.control}
                  name="authorUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ваше Имя</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Введите ваше имя..." data-testid="input-reply-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={replyForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ответ</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Напишите ответ..." 
                          className="min-h-24"
                          data-testid="textarea-reply-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full neon-glow-cyan"
                  disabled={replyMutation.isPending}
                  data-testid="button-submit-reply"
                >
                  {replyMutation.isPending ? "Отправка..." : "Ответить"}
                </Button>
              </form>
            </Form>
          )}

          {topic.isLocked && (
            <div className="glass glass-border rounded-lg p-4 text-center">
              <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Тема закрыта для комментариев</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ForumPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const { data: topics, isLoading } = useQuery<ForumTopic[]>({
    queryKey: ["/api/forum/topics"],
  });

  const createForm = useForm({
    resolver: zodResolver(insertForumTopicSchema),
    defaultValues: {
      title: "",
      authorUsername: "",
      authorDiscordId: "",
      content: "",
      isPinned: false,
      isLocked: false,
      views: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/forum/topics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      toast({
        title: "Успешно!",
        description: "Тема создана",
      });
      setCreateOpen(false);
      createForm.reset();
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl relative">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center justify-center gap-3">
          <MessagesSquare className="h-10 w-10 text-primary" strokeWidth={1.5} />
          {t('forum.title')}
        </h1>
        <p className="text-muted-foreground text-lg mb-4">
          {t('forum.description')}
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="neon-glow-cyan" data-testid="button-create-topic">
              <Plus className="h-5 w-5 mr-2" />
              Создать Тему
            </Button>
          </DialogTrigger>
          <DialogContent className="glass glass-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="neon-text-cyan">Новая Тема</DialogTitle>
              <DialogDescription>
                Создайте новое обсуждение на форуме
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Заголовок</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Введите заголовок темы..." data-testid="input-topic-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="authorUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ваше Имя</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Введите ваше имя..." data-testid="input-topic-author" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сообщение</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Опишите тему обсуждения..." 
                          className="min-h-32"
                          data-testid="textarea-topic-content"
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
                  data-testid="button-submit-topic"
                >
                  {createMutation.isPending ? "Создание..." : "Создать Тему"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="glass glass-border">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : topics && topics.length > 0 ? (
          topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))
        ) : (
          <Card className="glass glass-border">
            <CardContent className="py-12">
              <div className="text-center">
                <MessagesSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-bold mb-2">Нет Обсуждений</h3>
                <p className="text-muted-foreground mb-4">
                  Будьте первым, кто создаст тему на форуме
                </p>
                <Button onClick={() => setCreateOpen(true)} className="neon-glow-cyan">
                  <Plus className="h-5 w-5 mr-2" />
                  Создать Тему
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
