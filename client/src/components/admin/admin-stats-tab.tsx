import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import type { ClanStats } from "@shared/schema";

const statsSchema = z.object({
  totalMembers: z.number().min(0),
  totalWins: z.number().min(0),
  totalLosses: z.number().min(0),
  averageRank: z.number().min(0),
  monthlyActivity: z.number().min(0),
});

type StatsFormData = z.infer<typeof statsSchema>;

export default function AdminStatsTab() {
  const { toast } = useToast();

  const { data: stats, isLoading } = useQuery<ClanStats>({
    queryKey: ["/api/clan/stats"],
  });

  const form = useForm<StatsFormData>({
    resolver: zodResolver(statsSchema),
    values: stats ? {
      totalMembers: stats.totalMembers || 0,
      totalWins: stats.totalWins || 0,
      totalLosses: stats.totalLosses || 0,
      averageRank: stats.averageRank || 0,
      monthlyActivity: stats.monthlyActivity || 0,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StatsFormData) => {
      const res = await apiRequest("PUT", "/api/admin/stats", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clan/stats"] });
      toast({
        title: "Статистика обновлена",
        description: "Статистика клана успешно изменена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить статистику",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StatsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-2xl neon-text-cyan">Редактирование Статистики</CardTitle>
        <CardDescription>
          Обновление общей статистики клана
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="totalMembers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Всего участников</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-total-members"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="averageRank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Средний рейтинг</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-average-rank"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalWins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Всего побед</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-total-wins"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalLosses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Всего поражений</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-total-losses"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyActivity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Месячная активность</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-monthly-activity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={updateMutation.isPending}
              data-testid="button-save-stats"
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
