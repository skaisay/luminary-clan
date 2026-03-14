import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Edit } from "lucide-react";
import type { Channel } from "@shared/schema";

const channelSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  handle: z.string()
    .min(3, "Минимум 3 символа")
    .max(30, "Максимум 30 символов")
    .regex(/^[a-zA-Z0-9_]+$/, "Только буквы, цифры и _"),
  description: z.string().max(500).optional(),
  bannerUrl: z.string().url().optional().or(z.literal("")),
});

type ChannelForm = z.infer<typeof channelSchema>;

export default function ChannelManagement() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: channel, isLoading } = useQuery<Channel | null>({
    queryKey: ["/api/my-channel"],
  });

  const form = useForm<ChannelForm>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      name: "",
      handle: "",
      description: "",
      bannerUrl: "",
    },
  });

  // Update form values when channel loads
  useEffect(() => {
    if (channel) {
      form.reset({
        name: channel.name,
        handle: channel.handle,
        description: channel.description || "",
        bannerUrl: channel.bannerUrl || "",
      });
    }
  }, [channel]);

  const createMutation = useMutation({
    mutationFn: async (data: ChannelForm) => {
      return await apiRequest("/api/channels", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-channel"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ChannelForm) => {
      if (!channel) throw new Error("Channel not found");
      return await apiRequest(`/api/channels/${channel.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-channel"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
    },
  });

  const onSubmit = (data: ChannelForm) => {
    if (channel) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-channel" />
      </div>
    );
  }

  const hasChannel = !!channel;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="bg-[rgba(255,255,255,0.05)] backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl text-white">
            {hasChannel ? "Управление каналом" : "Создать канал"}
          </CardTitle>
          <CardDescription className="text-gray-300">
            {hasChannel 
              ? "Редактируйте информацию о вашем канале"
              : "Создайте свой канал для загрузки видео"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasChannel && !isEditing ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400">Название</h3>
                <p className="text-white text-lg" data-testid="text-channel-name">{channel.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400">Handle</h3>
                <p className="text-white" data-testid="text-channel-handle">@{channel.handle}</p>
              </div>
              {channel.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Описание</h3>
                  <p className="text-white" data-testid="text-channel-description">{channel.description}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-400">Статистика</h3>
                <div className="flex gap-6 mt-2">
                  <div>
                    <p className="text-2xl font-bold text-white" data-testid="text-subscriber-count">{channel.subscriberCount}</p>
                    <p className="text-sm text-gray-400">подписчиков</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white" data-testid="text-video-count">{channel.videoCount}</p>
                    <p className="text-sm text-gray-400">видео</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white" data-testid="text-total-views">{channel.totalViews}</p>
                    <p className="text-sm text-gray-400">просмотров</p>
                  </div>
                </div>
              </div>
              <Button onClick={() => setIsEditing(true)} data-testid="button-edit-channel">
                <Edit className="mr-2 h-4 w-4" />
                Редактировать
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Название канала</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          className="bg-white/10 border-white/20 text-white"
                          placeholder="Мой канал"
                          data-testid="input-channel-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="handle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Handle (уникальный идентификатор)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="text-white">@</span>
                          <Input 
                            {...field}
                            className="bg-white/10 border-white/20 text-white"
                            placeholder="mychannel"
                            disabled={hasChannel}
                            data-testid="input-channel-handle"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                      {hasChannel && (
                        <p className="text-xs text-gray-400">Handle нельзя изменить после создания</p>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Описание</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          className="bg-white/10 border-white/20 text-white"
                          placeholder="Расскажите о вашем канале..."
                          rows={4}
                          data-testid="input-channel-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bannerUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">URL баннера (опционально)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          className="bg-white/10 border-white/20 text-white"
                          placeholder="https://example.com/banner.jpg"
                          data-testid="input-channel-banner"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3">
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-channel"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {hasChannel ? (
                      <>
                        <Edit className="mr-2 h-4 w-4" />
                        Сохранить изменения
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Создать канал
                      </>
                    )}
                  </Button>
                  {hasChannel && isEditing && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                      data-testid="button-cancel-edit"
                    >
                      Отменить
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
