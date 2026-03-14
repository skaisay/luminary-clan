import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import type { SiteBan } from "@shared/schema";

interface BanGateProps {
  children: React.ReactNode;
}

export function BanGate({ children }: BanGateProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const { data: banCheck, isLoading } = useQuery<{ banned: boolean; ban: SiteBan | null }>({
    queryKey: ["/api/check-ban", user?.discordId],
    enabled: !!user?.discordId,
    refetchInterval: 60000, // Перепроверять каждую минуту
  });

  // Показываем контент пока грузится проверка бана
  if (isLoading || !user?.discordId) {
    return <>{children}</>;
  }

  // Если пользователь забанен, показываем экран бана
  if (banCheck?.banned && banCheck?.ban) {
    const ban = banCheck.ban;
    const expiresAt = ban.expiresAt ? new Date(ban.expiresAt) : null;
    const isPermanent = !expiresAt;
    const isExpired = expiresAt && expiresAt < new Date();

    // Если бан истёк, показываем обычный контент
    if (isExpired) {
      return <>{children}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-900/20 via-background to-red-800/20">
        <Card className="glass glass-border max-w-2xl w-full border-destructive/50">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-destructive/10 border-2 border-destructive">
                <AlertTriangle className="h-16 w-16 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-3xl text-destructive">
              Доступ Заблокирован
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-lg text-muted-foreground">
                Ваш аккаунт был заблокирован администратором сайта
              </p>
              
              {ban.reason && (
                <div className="glass glass-border rounded-lg p-4 border-destructive/20">
                  <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                    Причина блокировки:
                  </h3>
                  <p className="text-sm leading-relaxed">{ban.reason}</p>
                </div>
              )}

              <div className="glass glass-border rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Тип блокировки:</span>
                    <span className="font-semibold">
                      {isPermanent ? "Постоянная" : "Временная"}
                    </span>
                  </div>
                  
                  {!isPermanent && expiresAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Истекает:</span>
                      <span className="font-semibold">
                        {expiresAt.toLocaleDateString("ru-RU", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {ban.bannedBy && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Администратор:</span>
                      <span className="font-semibold">{ban.bannedBy}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Дата блокировки:</span>
                    <span className="font-semibold">
                      {new Date(ban.createdAt).toLocaleDateString("ru-RU", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground mt-6">
                <p>
                  Если вы считаете, что это ошибка, свяжитесь с администрацией сервера.
                </p>
              </div>

              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="gap-2"
                  data-testid="button-back-from-ban"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Вернуться назад
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Пользователь не забанен, показываем обычный контент
  return <>{children}</>;
}
