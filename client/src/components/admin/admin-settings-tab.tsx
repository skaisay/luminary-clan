import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import type { ClanSettings } from "@shared/schema";
import AdminEarningSettings from "./admin-earning-settings";

const settingsSchema = z.object({
  clanName: z.string().min(1, "Введите название клана"),
  clanTag: z.string().optional(),
  description: z.string().min(1, "Введите описание клана"),
  heroImageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  splashImageUrl: z.string().optional(),
  discordServerId: z.string().optional(),
  discordBotToken: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  seasonalTheme: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function AdminSettingsTab() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<ClanSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      clanName: "",
      clanTag: "",
      description: "",
      heroImageUrl: "",
      logoUrl: "",
      splashImageUrl: "",
      discordServerId: "",
      discordBotToken: "",
      primaryColor: "#06b6d4",
      accentColor: "#a855f7",
      seasonalTheme: "none",
    },
    values: settings ? {
      clanName: settings.clanName,
      clanTag: settings.clanTag || "",
      description: settings.description,
      heroImageUrl: settings.heroImageUrl || "",
      logoUrl: settings.logoUrl || "",
      splashImageUrl: settings.splashImageUrl || "",
      discordServerId: settings.discordServerId || "",
      discordBotToken: settings.discordBotToken || "",
      primaryColor: settings.primaryColor || "#06b6d4",
      accentColor: settings.accentColor || "#a855f7",
      seasonalTheme: settings.seasonalTheme || "none",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const res = await apiRequest("PUT", "/api/admin/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan/settings"] });
      toast({
        title: "Настройки сохранены",
        description: "Настройки клана успешно обновлены",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-2xl neon-text-cyan">Настройки Клана</CardTitle>
          <CardDescription>
            Управление основными настройками и информацией о клане
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="clanName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название клана</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="CLAN COMMAND" data-testid="input-clan-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clanTag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тег клана</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="[CC]" data-testid="input-clan-tag" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание клана</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Элитный игровой клан..."
                      rows={4}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="heroImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Hero изображения</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." data-testid="input-hero-image" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL логотипа</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." data-testid="input-logo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="splashImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL изображения на экране входа (Splash Screen)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://i.postimg.cc/..." data-testid="input-splash-image" />
                  </FormControl>
                  <FormDescription>
                    Изображение, которое показывается при первом входе на сайт
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="discordServerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord Server ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123456789..." data-testid="input-discord-server" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discordBotToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord Bot Token</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="MTxxxxxxxx.xxxxxx.xxxxxxxxxxxx"
                        data-testid="input-discord-token"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      🔑 Токен бота из <a href="https://discord.com/developers/applications" target="_blank" rel="noopener" className="text-primary underline">Developer Portal</a> → Bot → Reset Token.
                      При сохранении бот автоматически перезапустится с новым токеном.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Основной цвет</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input {...field} placeholder="#06b6d4" data-testid="input-primary-color" />
                        <input
                          type="color"
                          value={field.value || "#06b6d4"}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="h-9 w-16 rounded-md border cursor-pointer"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accentColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Акцентный цвет</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input {...field} placeholder="#a855f7" data-testid="input-accent-color" />
                        <input
                          type="color"
                          value={field.value || "#a855f7"}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="h-9 w-16 rounded-md border cursor-pointer"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="seasonalTheme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сезонная тема / Праздничные украшения</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-seasonal-theme">
                        <SelectValue placeholder="Выберите тему" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">🚫 Без украшений</SelectItem>
                      <SelectItem value="halloween">🎃 Хэллоуин</SelectItem>
                      <SelectItem value="christmas">🎄 Рождество</SelectItem>
                      <SelectItem value="newyear">❄️ Новый год</SelectItem>
                      <SelectItem value="valentine">💕 День Святого Валентина</SelectItem>
                      <SelectItem value="easter">🐰 Пасха</SelectItem>
                      <SelectItem value="summer">☀️ Лето</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Добавляет анимированные праздничные украшения на все страницы
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>

    <AdminEarningSettings />
    </div>
  );
}
