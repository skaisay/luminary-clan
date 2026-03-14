import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Coins, Shield } from "lucide-react";

const earningSettingsSchema = z.object({
  messageRewardRate: z.number().min(0).max(1000),
  voiceRewardRate: z.number().min(0).max(1000),
  reactionRewardRate: z.number().min(0).max(1000),
  antiSpamEnabled: z.boolean(),
  antiSpamMessageWindow: z.number().min(1).max(60),
  antiSpamMessageThreshold: z.number().min(1).max(20),
  antiSpamPenaltyRate: z.number().min(0).max(1),
});

type EarningSettingsFormData = z.infer<typeof earningSettingsSchema>;

export default function AdminEarningSettings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<EarningSettingsFormData>({
    queryKey: ["/api/admin/earning-settings"],
  });

  const form = useForm<EarningSettingsFormData>({
    resolver: zodResolver(earningSettingsSchema),
    values: settings ? {
      messageRewardRate: settings.messageRewardRate,
      voiceRewardRate: settings.voiceRewardRate,
      reactionRewardRate: settings.reactionRewardRate,
      antiSpamEnabled: settings.antiSpamEnabled,
      antiSpamMessageWindow: settings.antiSpamMessageWindow,
      antiSpamMessageThreshold: settings.antiSpamMessageThreshold,
      antiSpamPenaltyRate: settings.antiSpamPenaltyRate,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EarningSettingsFormData) => {
      const res = await apiRequest("PATCH", "/api/admin/earning-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/earning-settings"] });
      toast({
        title: "Настройки сохранены",
        description: "Настройки начисления очков успешно обновлены",
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

  const onSubmit = (data: EarningSettingsFormData) => {
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
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-2xl neon-text-cyan flex items-center gap-2">
          <Coins className="w-6 h-6" />
          Настройки начисления LumiCoin
        </CardTitle>
        <CardDescription>
          Управление ставками начисления очков за активность и анти-спам системой
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Ставки начисления
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="messageRewardRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Очки за сообщение</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-message-rate"
                        />
                      </FormControl>
                      <FormDescription>
                        LumiCoins за каждое сообщение в Discord
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voiceRewardRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Очки за минуту в войсе</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-voice-rate"
                        />
                      </FormControl>
                      <FormDescription>
                        LumiCoins за минуту в голосовом канале
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reactionRewardRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Очки за реакцию</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-reaction-rate"
                        />
                      </FormControl>
                      <FormDescription>
                        LumiCoins за каждую реакцию
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Анти-спам система
              </h3>

              <FormField
                control={form.control}
                name="antiSpamEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Включить анти-спам защиту
                      </FormLabel>
                      <FormDescription>
                        Снижает награды за быстрые повторные сообщения
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-antispam"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("antiSpamEnabled") && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <FormField
                    control={form.control}
                    name="antiSpamMessageWindow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Окно проверки (секунды)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-spam-window"
                          />
                        </FormControl>
                        <FormDescription>
                          Время для отслеживания быстрых сообщений
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="antiSpamMessageThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Порог сообщений</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-spam-threshold"
                          />
                        </FormControl>
                        <FormDescription>
                          Количество сообщений для активации анти-спама
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="antiSpamPenaltyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Множитель штрафа</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            data-testid="input-spam-penalty"
                          />
                        </FormControl>
                        <FormDescription>
                          0.1 = 10% от обычной награды при спаме
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={updateMutation.isPending}
              data-testid="button-save-earning-settings"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
