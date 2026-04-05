import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Settings, Users, Newspaper, BarChart3, Activity, LogOut, Loader2, Hash, Store, Coins, FileText, Ban, Sparkles, Globe, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClanSettings, ClanMember, News, ClanStats } from "@shared/schema";

import AdminSettingsTab from "@/components/admin/admin-settings-tab";
import AdminMembersTab from "@/components/admin/admin-members-tab";
import AdminNewsTab from "@/components/admin/admin-news-tab";
import AdminStatsTab from "@/components/admin/admin-stats-tab";
import AdminMonitoringTab from "@/pages/admin-monitoring";
import AdminDiscordTab from "@/components/admin/admin-discord-tab";

import { AdminShopTab } from "@/components/admin/admin-shop-tab";
import AdminConvertTab from "@/components/admin/admin-convert-tab";
import AdminPagesTab from "@/components/admin/admin-pages-tab";
import AdminCoinMonitoring from "@/pages/admin-coin-monitoring";
import AdminSiteBans from "@/pages/admin-site-bans";
import AdminDecorationsTab from "@/components/admin/admin-decorations-tab";
import AdminServersTab from "@/components/admin/admin-servers-tab";
import AdminModeration from "@/pages/admin-moderation";

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: authData, isLoading: authLoading } = useQuery<{
    authenticated: boolean;
    admin?: { id: number; username: string };
  }>({
    queryKey: ["/api/admin/check"],
  });

  useEffect(() => {
    if (!authLoading && !authData?.authenticated) {
      navigate("/admin/login");
    }
  }, [authData, authLoading, navigate]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/logout", {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Выход выполнен",
        description: "До скорой встречи!",
      });
      navigate("/admin/login");
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!authData?.authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold neon-text-cyan mb-2 flex items-center gap-3">
              <Shield className="w-10 h-10" />
              Админ Панель
            </h1>
            <p className="text-muted-foreground text-lg">
              Добро пожаловать, {authData.admin?.username}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выход
          </Button>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="flex flex-wrap w-full gap-2 glass-card h-auto p-2" data-testid="tabs-admin">
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Настройки</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2" data-testid="tab-members">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Участники</span>
            </TabsTrigger>
            <TabsTrigger value="discord" className="gap-2" data-testid="tab-discord">
              <Hash className="w-4 h-4" />
              <span className="hidden sm:inline">Discord</span>
            </TabsTrigger>
            <TabsTrigger value="news" className="gap-2" data-testid="tab-news">
              <Newspaper className="w-4 h-4" />
              <span className="hidden sm:inline">Новости</span>
            </TabsTrigger>
            <TabsTrigger value="shop" className="gap-2" data-testid="tab-shop">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Магазин</span>
            </TabsTrigger>
            <TabsTrigger value="convert" className="gap-2" data-testid="tab-convert">
              <Coins className="w-4 h-4" />
              <span className="hidden sm:inline">Конвертация</span>
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-2" data-testid="tab-pages">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Страницы</span>
            </TabsTrigger>

            <TabsTrigger value="stats" className="gap-2" data-testid="tab-stats">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Статистика</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2" data-testid="tab-monitoring">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Мониторинг</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2" data-testid="tab-transactions">
              <Coins className="w-4 h-4" />
              <span className="hidden sm:inline">Транзакции</span>
            </TabsTrigger>
            <TabsTrigger value="moderation" className="gap-2" data-testid="tab-moderation">
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">Модерация</span>
            </TabsTrigger>
            <TabsTrigger value="bans" className="gap-2" data-testid="tab-bans">
              <Ban className="w-4 h-4" />
              <span className="hidden sm:inline">Баны</span>
            </TabsTrigger>
            <TabsTrigger value="decorations" className="gap-2" data-testid="tab-decorations">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Декорации</span>
            </TabsTrigger>
            <TabsTrigger value="servers" className="gap-2" data-testid="tab-servers">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Серверы</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <AdminSettingsTab />
          </TabsContent>

          <TabsContent value="members">
            <AdminMembersTab />
          </TabsContent>

          <TabsContent value="discord">
            <AdminDiscordTab />
          </TabsContent>

          <TabsContent value="news">
            <AdminNewsTab />
          </TabsContent>

          <TabsContent value="shop">
            <AdminShopTab />
          </TabsContent>

          <TabsContent value="convert">
            <AdminConvertTab />
          </TabsContent>

          <TabsContent value="pages">
            <AdminPagesTab />
          </TabsContent>



          <TabsContent value="stats">
            <AdminStatsTab />
          </TabsContent>

          <TabsContent value="monitoring">
            <AdminMonitoringTab />
          </TabsContent>

          <TabsContent value="transactions">
            <AdminCoinMonitoring />
          </TabsContent>

          <TabsContent value="moderation">
            <AdminModeration />
          </TabsContent>

          <TabsContent value="bans">
            <AdminSiteBans />
          </TabsContent>

          <TabsContent value="decorations">
            <AdminDecorationsTab />
          </TabsContent>

          <TabsContent value="servers">
            <AdminServersTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
