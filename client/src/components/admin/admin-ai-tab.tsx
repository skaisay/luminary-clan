import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Sparkles } from "lucide-react";
import type { ClanSettings } from "@shared/schema";

const aiSchema = z.object({
  aiSystemPrompt: z.string().min(10, "Системный промпт должен быть минимум 10 символов"),
});

type AiFormData = z.infer<typeof aiSchema>;

export default function AdminAiTab() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<ClanSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const form = useForm<AiFormData>({
    resolver: zodResolver(aiSchema),
    values: settings ? {
      aiSystemPrompt: settings.aiSystemPrompt || "",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AiFormData) => {
      const res = await apiRequest("PUT", "/api/admin/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "AI конфигурация обновлена",
        description: "Системный промпт AI-советника успешно изменен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить конфигурацию",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AiFormData) => {
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
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl neon-text-cyan">AI Советник - Конфигурация</CardTitle>
        </div>
        <CardDescription>
          Настройка поведения и личности AI-советника клана
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="aiSystemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Системный промпт AI</FormLabel>
                  <FormDescription>
                    Этот текст определяет роль, личность и поведение AI-советника. 
                    Опишите, как AI должен взаимодействовать с игроками и какую помощь предоставлять.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={12}
                      placeholder="Ты - AI советник игрового клана. Помогай игрокам..."
                      className="font-mono text-sm"
                      data-testid="textarea-ai-prompt"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="p-4 rounded-md bg-primary/10 border border-primary/20">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Примеры инструкций для промпта:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Определите роль AI (советник, тренер, аналитик)</li>
                <li>Укажите стиль общения (дружелюбный, профессиональный, мотивирующий)</li>
                <li>Опишите основные функции (анализ статистики, советы по стратегии)</li>
                <li>Задайте границы (что AI может и не может делать)</li>
                <li>Добавьте персональность и уникальность клана</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={updateMutation.isPending}
              data-testid="button-save-ai"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Сохранение..." : "Сохранить конфигурацию"}
            </Button>
          </form>
        </Form>

        <div className="mt-8 p-6 rounded-md glass-card border-accent/20">
          <h3 className="text-lg font-bold mb-3 text-accent">Текущая конфигурация OpenAI</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Модель:</strong> gpt-4o (через Replit AI Integrations)</p>
            <p><strong>API Key:</strong> Управляется Replit (безопасно)</p>
            <p><strong>Стоимость:</strong> Списывается с баланса Replit кредитов</p>
            <p className="text-muted-foreground">
              AI использует данные клана для персонализированных ответов
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
