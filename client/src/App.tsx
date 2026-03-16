import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TopNav } from "@/components/top-nav";
import { SeasonalDecoration } from "@/components/seasonal-decoration";
import { BanGate } from "@/components/BanGate";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import type { ClanSettings } from "@shared/schema";
import Dashboard from "@/pages/dashboard";
import Leaderboard from "@/pages/leaderboard";
import Members from "@/pages/members";
import NewsPage from "@/pages/news";
import RequestsPage from "@/pages/requests";
import ForumPage from "@/pages/forum";
import Statistics from "@/pages/statistics";
import About from "@/pages/about";
import Shop from "@/pages/shop";
import Inventory from "@/pages/inventory";
import ConvertPage from "@/pages/convert";
import LoginPage from "@/pages/login";
import AdminLogin from "@/pages/admin-login";
import AdminPanel from "@/pages/admin-panel";
import AdminMonitoring from "@/pages/admin-monitoring";
import AdminCoinMonitoring from "@/pages/admin-coin-monitoring";
import AdminSiteBans from "@/pages/admin-site-bans";
import { VideoPlatformLayout } from "@/components/video-platform/VideoPlatformLayout";
import VideoPlatformHome from "@/pages/video-platform/VideoPlatformHome";
import VideoUpload from "@/pages/video-platform/VideoUpload";
import VideoWatch from "@/pages/video-platform/VideoWatch";
import VideoPlatformAdmin from "@/pages/video-platform/Admin";
import Profile from "@/pages/video-platform/Profile";
import MyVideos from "@/pages/video-platform/MyVideos";
import Search from "@/pages/video-platform/Search";
import Settings from "@/pages/video-platform/Settings";
import Liked from "@/pages/video-platform/Liked";
import ChannelManagement from "@/pages/video-platform/ChannelManagement";
import RobloxTracker from "@/pages/roblox-tracker";
import MusicPage from "@/pages/music";
import AchievementsPage from "@/pages/achievements";
import QuestsPage from "@/pages/quests";
import TradingPage from "@/pages/trading";
import BoostersPage from "@/pages/boosters";
import DailyRewardsPage from "@/pages/daily-rewards";
import ProfilePage from "@/pages/profile";
import MiniGamesPage from "@/pages/mini-games";
import DecorationShop from "@/pages/decoration-shop";
import ClanWarsPage from "@/pages/clan-wars";
import NotFound from "@/pages/not-found";
import { AiAssistant } from "@/components/AiAssistant";
import { useSSE } from "@/hooks/useSSE";

function MainRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <MaintenanceGate pageId="dashboard"><Dashboard /></MaintenanceGate>} />
      <Route path="/statistics" component={() => <MaintenanceGate pageId="statistics"><Statistics /></MaintenanceGate>} />
      <Route path="/leaderboard" component={() => <MaintenanceGate pageId="leaderboard"><Leaderboard /></MaintenanceGate>} />
      <Route path="/members" component={() => <MaintenanceGate pageId="members"><Members /></MaintenanceGate>} />
      <Route path="/news" component={() => <MaintenanceGate pageId="news"><NewsPage /></MaintenanceGate>} />
      <Route path="/shop" component={() => <MaintenanceGate pageId="shop"><Shop /></MaintenanceGate>} />
      <Route path="/decorations" component={() => <DecorationShop />} />
      <Route path="/inventory" component={() => <MaintenanceGate pageId="inventory"><Inventory /></MaintenanceGate>} />
      <Route path="/convert" component={() => <MaintenanceGate pageId="convert"><ConvertPage /></MaintenanceGate>} />
      <Route path="/requests" component={() => <MaintenanceGate pageId="requests"><RequestsPage /></MaintenanceGate>} />
      <Route path="/forum" component={() => <MaintenanceGate pageId="forum"><ForumPage /></MaintenanceGate>} />
      <Route path="/about" component={() => <MaintenanceGate pageId="about"><About /></MaintenanceGate>} />
      <Route path="/roblox-tracker" component={() => <RobloxTracker />} />
      <Route path="/music" component={() => <MusicPage />} />
      <Route path="/achievements" component={() => <MaintenanceGate pageId="achievements"><AchievementsPage /></MaintenanceGate>} />
      <Route path="/quests" component={() => <MaintenanceGate pageId="quests"><QuestsPage /></MaintenanceGate>} />
      <Route path="/trading" component={() => <MaintenanceGate pageId="trading"><TradingPage /></MaintenanceGate>} />
      <Route path="/boosters" component={() => <MaintenanceGate pageId="boosters"><BoostersPage /></MaintenanceGate>} />
      <Route path="/daily-rewards" component={() => <MaintenanceGate pageId="daily-rewards"><DailyRewardsPage /></MaintenanceGate>} />
      <Route path="/profile/:discordId?" component={() => <MaintenanceGate pageId="profile"><ProfilePage /></MaintenanceGate>} />
      <Route path="/mini-games" component={() => <MaintenanceGate pageId="mini-games"><MiniGamesPage /></MaintenanceGate>} />
      <Route path="/clan-wars" component={() => <MaintenanceGate pageId="clan-wars"><ClanWarsPage /></MaintenanceGate>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/monitoring" component={AdminMonitoring} />
      <Route path="/admin/coin-monitoring" component={AdminCoinMonitoring} />
      <Route path="/admin/site-bans" component={AdminSiteBans} />
      <Route path="/admin" component={AdminPanel} />
      <Route component={AdminLogin} />
    </Switch>
  );
}

function VideoPlatformRouter() {
  return (
    <VideoPlatformLayout>
      <Switch>
        <Route path="/video-platform" component={VideoPlatformHome} />
        <Route path="/video-platform/upload" component={VideoUpload} />
        <Route path="/video-platform/channel" component={ChannelManagement} />
        <Route path="/video-platform/watch/:id" component={VideoWatch} />
        <Route path="/video-platform/profile" component={Profile} />
        <Route path="/video-platform/user/:id" component={Profile} />
        <Route path="/video-platform/my-videos" component={MyVideos} />
        <Route path="/video-platform/liked" component={Liked} />
        <Route path="/video-platform/settings" component={Settings} />
        <Route path="/video-platform/search" component={Search} />
        <Route path="/video-platform/admin" component={VideoPlatformAdmin} />
        {/* Короткий URL для видео */}
        <Route path="/v/:id" component={VideoWatch} />
        <Route component={() => <VideoPlatformHome />} />
      </Switch>
    </VideoPlatformLayout>
  );
}

function MainLayout() {
  useSSE(); // Real-time balance & decoration updates via SSE
  return (
    <>
      <TopNav />
      <main className="w-full min-h-screen">
        <MainRouter />
      </main>
      <ScrollToTop />
    </>
  );
}

function SplashWrapper({ onComplete }: { onComplete: () => void }) {
  const { data: settings, isLoading } = useQuery<ClanSettings>({
    queryKey: ["/api/clan/settings"],
  });

  // Показываем черный экран пока загружаются настройки
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-pulse text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <SplashScreen 
      onComplete={onComplete} 
      clanName={settings?.clanName || "LUMINARY"}
      splashImageUrl={settings?.splashImageUrl || undefined}
      cacheVersion={settings?.updatedAt ? new Date(settings.updatedAt).toISOString() : undefined}
    />
  );
}

export default function App() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");
  const isVideoPlatformRoute = location.startsWith("/video-platform") || location.startsWith("/v/");
  const [showSplash, setShowSplash] = useState(true);
  
  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash && !isAdminRoute && !isVideoPlatformRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark">
          <SplashWrapper onComplete={handleSplashComplete} />
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <SeasonalDecoration />
              {isAdminRoute ? (
                <>
                  <AdminRouter />
                  <ScrollToTop />
                  <Toaster />
                </>
              ) : isVideoPlatformRoute ? (
                <>
                  <VideoPlatformRouter />
                  <Toaster />
                </>
              ) : (
                <BanGate>
                  <MainLayout />
                </BanGate>
              )}
              <AiAssistant />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
