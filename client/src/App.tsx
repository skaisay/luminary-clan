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
import NicknameColorsPage from "@/pages/nickname-colors";
import FileTransferPage from "@/pages/file-transfer";
import ClanWarsPage from "@/pages/clan-wars";
import NotFound from "@/pages/not-found";
import { AiAssistant } from "@/components/AiAssistant";
import { useSSE } from "@/hooks/useSSE";
import { usePresenceHeartbeat } from "@/hooks/usePresence";

function MainRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/"><MaintenanceGate pageId="dashboard"><Dashboard /></MaintenanceGate></Route>
      <Route path="/leaderboard"><MaintenanceGate pageId="leaderboard"><Leaderboard /></MaintenanceGate></Route>
      <Route path="/members"><MaintenanceGate pageId="members"><Members /></MaintenanceGate></Route>
      <Route path="/news"><MaintenanceGate pageId="news"><NewsPage /></MaintenanceGate></Route>
      <Route path="/shop"><MaintenanceGate pageId="shop"><Shop /></MaintenanceGate></Route>
      <Route path="/decorations"><DecorationShop /></Route>
      <Route path="/nickname-colors"><NicknameColorsPage /></Route>
      <Route path="/convert"><MaintenanceGate pageId="convert"><ConvertPage /></MaintenanceGate></Route>

      <Route path="/about"><MaintenanceGate pageId="about"><About /></MaintenanceGate></Route>
      <Route path="/roblox-tracker"><RobloxTracker /></Route>
      <Route path="/music"><MusicPage /></Route>
      <Route path="/achievements"><MaintenanceGate pageId="achievements"><AchievementsPage /></MaintenanceGate></Route>
      <Route path="/quests"><MaintenanceGate pageId="quests"><QuestsPage /></MaintenanceGate></Route>
      <Route path="/trading"><MaintenanceGate pageId="trading"><TradingPage /></MaintenanceGate></Route>
      <Route path="/boosters"><MaintenanceGate pageId="boosters"><BoostersPage /></MaintenanceGate></Route>
      <Route path="/daily-rewards"><MaintenanceGate pageId="daily-rewards"><DailyRewardsPage /></MaintenanceGate></Route>
      <Route path="/profile/:discordId?"><MaintenanceGate pageId="profile"><ProfilePage /></MaintenanceGate></Route>
      <Route path="/mini-games"><MaintenanceGate pageId="mini-games"><MiniGamesPage /></MaintenanceGate></Route>
      <Route path="/file-transfer"><FileTransferPage /></Route>
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
        <Route><VideoPlatformHome /></Route>
      </Switch>
    </VideoPlatformLayout>
  );
}

import { ArrowLeft } from "lucide-react";

function BackButton() {
  const [location] = useLocation();
  // Don't show on home page
  if (location === "/" || location === "") return null;
  return (
    <button
      onClick={() => window.history.back()}
      className="fixed left-4 top-20 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors duration-150 shadow-lg"
      title="Назад"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

function MainLayout() {
  useSSE(); // Real-time balance & decoration updates via SSE
  usePresenceHeartbeat(); // Track website visitors
  return (
    <>
      <TopNav />
      <BackButton />
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
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
