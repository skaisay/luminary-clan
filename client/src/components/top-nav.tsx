import { useState, useEffect, useRef } from "react";
import { Home, Trophy, Newspaper, Users, Info, BarChart3, ShoppingBag, Package, Coins, Menu, LogOut, LogIn, User as UserIcon, Gamepad2, Music2, Award, ScrollText, ArrowLeftRight, Zap, Gift, Swords, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { DiscordFlowerButton } from "@/components/discord-flower-button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const menuItemsConfig = [
  {
    key: "nav.dashboard",
    url: "/",
    icon: Home,
  },
  {
    key: "nav.leaderboard",
    url: "/leaderboard",
    icon: Trophy,
  },
  {
    key: "nav.members",
    url: "/members",
    icon: Users,
  },
  {
    key: "nav.about",
    url: "/about",
    icon: Info,
  },
  {
    key: "nav.shop",
    url: "/shop",
    icon: ShoppingBag,
  },
  {
    key: "nav.decorations",
    url: "/decorations",
    icon: Sparkles,
  },
  {
    key: "nav.convert",
    url: "/convert",
    icon: Coins,
  },

  {
    key: "nav.roblox",
    url: "/roblox-tracker",
    icon: Gamepad2,
  },
  {
    key: "nav.music",
    url: "/music",
    icon: Music2,
  },
  {
    key: "nav.achievements",
    url: "/achievements",
    icon: Award,
  },
  {
    key: "nav.quests",
    url: "/quests",
    icon: ScrollText,
  },
  {
    key: "nav.trading",
    url: "/trading",
    icon: ArrowLeftRight,
  },
  {
    key: "nav.boosters",
    url: "/boosters",
    icon: Zap,
  },
  {
    key: "nav.dailyRewards",
    url: "/daily-rewards",
    icon: Gift,
  },
  {
    key: "nav.profile",
    url: "/profile",
    icon: UserIcon,
  },
  {
    key: "nav.miniGames",
    url: "/mini-games",
    icon: Gamepad2,
  },
];

export function TopNav() {
  const [location, navigate] = useLocation();
  const [leaderboardClicks, setLeaderboardClicks] = useState(0);
  const [newsClicks, setNewsClicks] = useState(0);
  const [secretSequenceActive, setSecretSequenceActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { t } = useLanguage();
  const { isAuthenticated, isGuest, user, logout } = useAuth();
  
  // Detect PWA standalone mode
  const [isPWA, setIsPWA] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    setIsPWA(mq.matches || (navigator as any).standalone === true);
    const handler = (e: MediaQueryListEvent) => setIsPWA(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  
  // На мобильных используем более высокий threshold чтобы навигация не исчезала слишком быстро
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  
  const scrollDirection = useScrollDirection({ 
    threshold: isMobile ? 80 : 5,
    hysteresis: isMobile ? 100 : 15
  });

  useEffect(() => {
    // На мобильных навигация всегда видима
    if (isMobile) {
      setIsVisible(true);
      return;
    }
    
    if (scrollDirection === "down") {
      setIsVisible(false);
    } else if (scrollDirection === "up") {
      setIsVisible(true);
    }
  }, [scrollDirection, isMobile]);

  useEffect(() => {
    if (leaderboardClicks >= 5 && !secretSequenceActive) {
      setSecretSequenceActive(true);
    }
  }, [leaderboardClicks, secretSequenceActive]);

  useEffect(() => {
    if (secretSequenceActive && newsClicks >= 2) {
      navigate("/admin/login");
      setLeaderboardClicks(0);
      setNewsClicks(0);
      setSecretSequenceActive(false);
    }
  }, [secretSequenceActive, newsClicks, navigate]);

  const handleLeaderboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLeaderboardClicks(prev => prev + 1);
    setNewsClicks(0);
    if (!secretSequenceActive) {
      navigate("/leaderboard");
      setMobileMenuOpen(false);
    }
  };

  const handleNewsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (secretSequenceActive) {
      setNewsClicks(prev => prev + 1);
    } else {
      setLeaderboardClicks(0);
      setNewsClicks(0);
      navigate("/news");
      setMobileMenuOpen(false);
    }
  };

  const handleOtherClick = () => {
    setLeaderboardClicks(0);
    setNewsClicks(0);
    setSecretSequenceActive(false);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* PWA title bar drag region (only active in window-controls-overlay mode) */}
      <div className="pwa-titlebar-drag" />
      
      {/* Floating Top Navigation Island */}
      <nav 
        className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-7xl transition-transform duration-300 ease-in-out"
        style={{
          top: '1rem',
          transform: `translate(-50%, ${isVisible ? '0' : '-120%'})`,
        }}
      >
        <div className="glass-nav px-3 py-3 rounded-2xl overflow-visible">
          <div className="flex items-center justify-between gap-3">
            {/* Left side - Desktop Navigation with Scrolling */}
            <div className="hidden lg:flex items-center flex-1 min-w-0">
              {/* Scrollable container - with fade-out gradient mask */}
              <div 
                className="flex items-center gap-2 overflow-x-auto scrollbar-hide scroll-smooth py-1"
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  overflowY: 'hidden',
                  WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 80px), transparent 100%)',
                  maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 80px), transparent 100%)'
                }}
              >
              {menuItemsConfig.map((item) => {
                const isActive = location === item.url;
                const isLeaderboard = item.key === "nav.leaderboard";
                const isNews = item.key === "nav.news";
                const Icon = item.icon;
                const title = t(item.key);
                
                const handleClick = (e: React.MouseEvent) => {
                  if (isLeaderboard) {
                    handleLeaderboardClick(e);
                  } else if (isNews) {
                    handleNewsClick(e);
                  } else {
                    handleOtherClick();
                  }
                };
                
                const button = (
                  <button
                    className={`glass-nav-btn-compact ${isActive ? 'active' : ''}`}
                    data-testid={`link-${item.key.split('.')[1]}`}
                    onClick={handleClick}
                    title={title}
                  >
                    <Icon className="w-4 h-4 nav-btn-icon-compact" strokeWidth={1.5} />
                    <span className="nav-label-compact">{title.slice(0, 6)}....</span>
                    
                    {/* Gradient wave animation on hover */}
                    <div className="nav-btn-wave-compact" />
                  </button>
                );
                
                if (isLeaderboard || isNews) {
                  return <div key={item.key}>{button}</div>;
                }
                
                return (
                  <Link key={item.key} href={item.url}>
                    {button}
                  </Link>
                );
              })}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="glass-nav-btn"
                  data-testid="button-mobile-menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 glass overflow-y-auto">
                <div className="flex flex-col gap-2 mt-8 pb-20">
                  {/* User Info in Mobile Menu */}
                  {isAuthenticated && user ? (
                    <div className="glass glass-border rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png` : undefined} 
                            alt={user.username} 
                          />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {user.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">{user.username}</span>
                          <span className="text-xs text-muted-foreground">{user.lumiCoins || 0} LC</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
                        >
                          <UserIcon className="mr-2 h-4 w-4" />
                          Профиль
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => { logout(); setMobileMenuOpen(false); }}
                          data-testid="mobile-button-logout"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          {t('login.logout')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      className="mb-4 neon-glow-cyan"
                      onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                      data-testid="mobile-button-login"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      {t('login.title')}
                    </Button>
                  )}
                  
                  {/* Language Toggle in Mobile Menu */}
                  <div className="flex justify-center mb-4">
                    <LanguageToggle />
                  </div>
                  
                  {menuItemsConfig.map((item) => {
                    const isActive = location === item.url;
                    const isLeaderboard = item.key === "nav.leaderboard";
                    const isNews = item.key === "nav.news";
                    const Icon = item.icon;
                    const title = t(item.key);
                    
                    const handleClick = (e: React.MouseEvent) => {
                      if (isLeaderboard) {
                        handleLeaderboardClick(e);
                      } else if (isNews) {
                        handleNewsClick(e);
                      } else {
                        handleOtherClick();
                      }
                    };
                    
                    const button = (
                      <button
                        className={`glass-nav-btn-mobile ${isActive ? 'active' : ''}`}
                        data-testid={`mobile-link-${item.key.split('.')[1]}`}
                        onClick={handleClick}
                      >
                        <Icon className="w-5 h-5" strokeWidth={1.5} />
                        <span>{title}</span>
                      </button>
                    );
                    
                    if (isLeaderboard || isNews) {
                      return <div key={item.key}>{button}</div>;
                    }
                    
                    return (
                      <Link key={item.key} href={item.url}>
                        {button}
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>

            {/* Right side - Actions */}
            <div className="flex items-center gap-3">
              
              {/* User Menu */}
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="glass-nav-btn relative"
                      data-testid="button-user-menu"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage 
                          src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png` : undefined} 
                          alt={user.username} 
                        />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass glass-border w-56 !max-h-[60vh]">
                    <DropdownMenuLabel className="flex flex-col">
                      <span className="text-sm font-medium">{user.username}</span>
                      <span className="text-xs text-muted-foreground">{user.lumiCoins || 0} LC</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate('/profile')}
                      className="cursor-pointer"
                      data-testid="button-profile"
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Мой профиль</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => logout()}
                      className="cursor-pointer"
                      data-testid="button-logout"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t('login.logout')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="glass-nav-btn"
                      onClick={() => navigate('/login')}
                      data-testid="button-login"
                    >
                      <LogIn className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('login.title')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <DiscordFlowerButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Floating Menu Button - Separate Round Button Left (Hidden on mobile) */}
      <div 
        className="fixed z-50 transition-transform duration-300 ease-in-out items-center hidden lg:flex"
        style={{
          top: 'calc(1rem + 1.35rem)',
          left: '1rem',
          transform: `translateX(${isVisible ? '0' : '-200%'})`,
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="glass-nav-btn"
              data-testid="button-additional-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="glass w-56">
            <DropdownMenuLabel>{t('nav.menu')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {menuItemsConfig.map((item) => {
              const Icon = item.icon;
              const title = t(item.key);
              const isActive = location === item.url;
              
              const handleMenuClick = () => {
                if (item.key === "nav.leaderboard") {
                  handleLeaderboardClick({ preventDefault: () => {} } as React.MouseEvent);
                } else if (item.key === "nav.news") {
                  handleNewsClick({ preventDefault: () => {} } as React.MouseEvent);
                } else {
                  handleOtherClick();
                  navigate(item.url);
                }
              };
              
              return (
                <DropdownMenuItem 
                  key={item.key}
                  onClick={handleMenuClick}
                  className={isActive ? 'bg-primary/10' : ''}
                  data-testid={`menu-${item.key.split('.')[1]}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{title}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Floating Language Toggle - Separate Round Button (Hidden on mobile) */}
      <div 
        className="fixed z-50 transition-transform duration-300 ease-in-out items-center hidden lg:flex"
        style={{
          top: 'calc(1rem + 1.35rem)',
          right: '1rem',
          transform: `translateX(${isVisible ? '0' : '200%'})`,
        }}
      >
        <LanguageToggle />
      </div>

      {/* Spacer to prevent content from going under fixed nav */}
      <div className="h-20" />
    </>
  );
}
