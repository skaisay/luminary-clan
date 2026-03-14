import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Home, Video, Upload, Heart, User, LogOut, Menu, Search, Settings, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import type { ClanMember } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import highlightsLogo from "@assets/highlights-logo.jpg";
import LoadingScreen from "./LoadingScreen";
import DiscordAuthModal from "./DiscordAuthModal";

const colorMap = {
  color1: "#0F2A1D",
  color2: "#375534",
  color3: "#689071",
  color4: "#AEC3B0",
  color5: "#E3EED4",
};

const menuItems = [
  { icon: Home, label: "Главная", path: "/video-platform" },
  { icon: Video, label: "Мои видео", path: "/video-platform/my-videos" },
  { icon: Heart, label: "Понравилось", path: "/video-platform/liked" },
];

const mobileNavItems = [
  { icon: Home, label: "Главная", path: "/video-platform" },
  { icon: Video, label: "Видео", path: "/video-platform/my-videos" },
  { icon: Upload, label: "Загрузить", path: "/video-platform/upload" },
  { icon: Heart, label: "Лайки", path: "/video-platform/liked" },
  { icon: User, label: "Профиль", path: "/video-platform/profile" },
];

export function VideoPlatformLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check if user is video platform admin
  const { data: adminData } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/video-platform/check-admin"],
    enabled: isAuthenticated && !!user,
  });
  const isVideoAdmin = adminData?.isAdmin || false;

  const [selectedBg, setSelectedBg] = useState(() => {
    return localStorage.getItem("videoPlatformBackground") || "color1";
  });

  useEffect(() => {
    const handleBackgroundChange = () => {
      const newBg = localStorage.getItem("videoPlatformBackground") || "color1";
      setSelectedBg(newBg);
    };

    window.addEventListener("backgroundChange", handleBackgroundChange);
    return () => window.removeEventListener("backgroundChange", handleBackgroundChange);
  }, []);
  
  const backgroundColor = useMemo(() => {
    return colorMap[selectedBg as keyof typeof colorMap] || colorMap.color1;
  }, [selectedBg]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/video-platform/search?q=${encodeURIComponent(searchQuery)}`);
      setMobileSearchOpen(false);
    }
  };

  const handleLoadingComplete = useCallback(() => {
    setShowLoadingScreen(false);
  }, []);

  if (showLoadingScreen) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <div 
      className="min-h-screen transition-colors duration-300" 
      style={{ 
        backgroundColor: backgroundColor,
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Mobile Search Overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl md:hidden">
          <div className="flex items-center h-16 px-4 gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSearchOpen(false)}
              className="rounded-full text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
            <form onSubmit={handleSearch} className="flex-1">
              <Input
                type="text"
                placeholder="Поиск видео..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full rounded-full bg-white/20 border-white/30 text-white placeholder:text-white/70 h-10"
                data-testid="input-mobile-search"
              />
            </form>
          </div>
        </div>
      )}

      {/* Top Header - Compact on mobile */}
      <header className="fixed top-0 left-0 right-0 h-14 md:h-16 backdrop-blur-xl bg-black/80 md:bg-white/10 border-b border-white/10 z-50">
        <div className="flex items-center justify-between h-full px-3 md:px-4 gap-2 md:gap-4">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex rounded-full hover:bg-white/20 text-white"
              data-testid="button-toggle-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <Link href="/video-platform">
              <div className="flex items-center gap-2 cursor-pointer">
                <img 
                  src={highlightsLogo} 
                  alt="Highlights" 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover"
                />
                <span className="text-lg md:text-xl font-bold text-white hidden sm:block">
                  Highlights
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Search - Desktop only */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl">
            <div className="relative flex items-center w-full">
              <Input
                type="text"
                placeholder="Поиск видео..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full bg-white/20 backdrop-blur-md border-white/30 text-white placeholder:text-white/70 pl-4 pr-12 h-10 focus:bg-white/30 transition-colors"
                data-testid="input-search"
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 rounded-full h-10 w-10 hover:bg-white/20 text-white"
                data-testid="button-search"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </form>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSearchOpen(true)}
              className="md:hidden rounded-full text-white hover:bg-white/20"
              data-testid="button-mobile-search"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Desktop upload button */}
            <Link href="/video-platform/upload">
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex rounded-full hover:bg-white/20 text-white"
                data-testid="button-upload-header"
              >
                <Upload className="h-5 w-5" />
              </Button>
            </Link>

            {/* Admin button - only for super admin (kairozun) or assigned admins */}
            {isAuthenticated && user && (user.discordId === "1254059406744621068" || isVideoAdmin) && (
              <Link href="/video-platform/admin">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-white/20 text-white"
                  data-testid="button-admin"
                >
                  <Shield className="h-5 w-5" />
                </Button>
              </Link>
            )}

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full h-8 w-8 md:h-10 md:w-10 p-0 hover:bg-white/20" data-testid="button-user-menu">
                    <Avatar className="h-7 w-7 md:h-9 md:w-9 ring-2 ring-white/30">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs md:text-sm">
                        {user.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs">
                          {user.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.username}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/video-platform/profile")} data-testid="menu-profile">
                    <User className="h-4 w-4 mr-2" />
                    Мой профиль
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/video-platform/settings")} data-testid="menu-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Настройки
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} data-testid="menu-logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => setShowAuthModal(true)}
                size="sm"
                className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white text-xs md:text-sm px-3 md:px-4"
                data-testid="button-login"
              >
                <User className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Войти</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside
        className={`hidden md:block fixed top-20 left-2 h-[calc(100vh-6rem)] backdrop-blur-xl bg-white/10 border border-white/20 transition-all duration-300 z-40 overflow-y-auto shadow-lg rounded-3xl ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        <nav className="p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`flex items-center py-3 rounded-2xl cursor-pointer transition-all ${
                    sidebarOpen ? "gap-3 px-4" : "justify-center"
                  } ${
                    isActive
                      ? "bg-white/30 text-white shadow-lg"
                      : "hover:bg-white/20 text-white/90"
                  }`}
                  data-testid={`nav-${item.path}`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
                </div>
              </Link>
            );
          })}

          {isAuthenticated && (
            <>
              <div className="border-t border-white/20 my-2" />
              <Link href="/video-platform/upload">
                <div
                  className={`flex items-center py-3 rounded-2xl cursor-pointer hover:bg-white/20 transition-all text-white/90 ${
                    sidebarOpen ? "gap-3 px-4" : "justify-center"
                  }`}
                  data-testid="nav-upload"
                >
                  <Upload className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">Загрузить видео</span>}
                </div>
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content - Full width on mobile with proper spacing and scrolling */}
      <main
        className={`pt-14 md:pt-16 pb-16 md:pb-0 transition-all duration-300 min-h-screen overflow-y-auto ${
          sidebarOpen ? "md:ml-68" : "md:ml-20"
        }`}
        style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      {/* Mobile Menu - Hidden/Shown on mobile */}
      <aside
        className={`fixed left-0 top-14 h-[calc(100vh-3.5rem-env(safe-area-inset-bottom,0px))] w-64 backdrop-blur-xl bg-black/95 border-r border-white/10 transition-all duration-300 z-40 overflow-y-auto md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <div
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 py-3 px-4 rounded-2xl cursor-pointer transition-all ${
                    isActive
                      ? "bg-white/30 text-white shadow-lg"
                      : "hover:bg-white/20 text-white/90"
                  }`}
                  data-testid={`mobile-nav-${item.path}`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                </div>
              </Link>
            );
          })}

          {isAuthenticated && (
            <>
              <div className="border-t border-white/20 my-3" />
              <Link href="/video-platform/upload">
                <div
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 py-3 px-4 rounded-2xl cursor-pointer hover:bg-white/20 transition-all text-white/90"
                  data-testid="mobile-nav-upload"
                >
                  <Upload className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">Загрузить видео</span>
                </div>
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation - YouTube style with safe area */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14 px-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || 
              (item.path === "/video-platform" && location === "/video-platform") ||
              (item.path !== "/video-platform" && location.startsWith(item.path));
            
            return (
              <Link key={item.path} href={item.path}>
                <div 
                  className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
                    isActive ? "text-white" : "text-white/60"
                  }`}
                  data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-white" : ""}`} />
                  <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Discord Auth Modal */}
      <DiscordAuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
}
