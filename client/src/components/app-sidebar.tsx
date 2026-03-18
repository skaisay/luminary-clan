import { useState, useEffect } from "react";
import { Home, Trophy, Newspaper, Users, Info, Music, BarChart3, ShoppingBag, Package, Coins, Gamepad2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { ClanSettings } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscordFlowerButton } from "@/components/discord-flower-button";
import { CoinBalance } from "@/components/coin-balance";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import clanEmblem from "@assets/generated_images/Gaming_clan_emblem_logo_499b43c5.png";

const menuItemsConfig = [
  {
    key: "nav.dashboard",
    url: "/",
    icon: Home,
  },
  {
    key: "nav.statistics",
    url: "/statistics",
    icon: BarChart3,
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
    key: "nav.inventory",
    url: "/inventory",
    icon: Package,
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
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const [leaderboardClicks, setLeaderboardClicks] = useState(0);
  const [newsClicks, setNewsClicks] = useState(0);
  const [secretSequenceActive, setSecretSequenceActive] = useState(false);
  const { t } = useLanguage();

  const { data: settings, isLoading: settingsLoading } = useQuery<ClanSettings>({
    queryKey: ["/api/clan/settings"],
  });

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
    }
  };

  const handleOtherClick = () => {
    setLeaderboardClicks(0);
    setNewsClicks(0);
    setSecretSequenceActive(false);
  };

  const dotHues = [
    '220', // Главная - синий
    '270', // Статистика - фиолетовый
    '50',  // Рейтинг - жёлтый
    '140', // Участники - зелёный
    '0',   // Новости - красный
    '188', // О Клане - cyan
    '30',  // Магазин - оранжевый
    '245', // Инвентарь - индиго
    '45',  // Конвертация - amber
    '175', // Запросы - teal
    '280', // Форум - violet
  ];

  return (
    <Sidebar className="glass bg-background/95 relative" style={{ contain: 'paint layout' }}>
      <div className="absolute top-2 right-[-5rem] z-50">
        <DiscordFlowerButton />
      </div>
      <SidebarHeader className="p-1 pb-1 pt-2">
        <div className="flex flex-col items-center">
          <CoinBalance />
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="flex flex-col gap-2 py-2">
              {menuItemsConfig.map((item, index) => {
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
                
                const dotHue = dotHues[index] || '142';
                
                const button = (
                  <div 
                    className="nav-btn-wrapper w-full" 
                    style={{ '--dot-hue': dotHue } as React.CSSProperties}
                  >
                    <div
                      className="nav-btn"
                      data-testid={`link-${item.key.split('.')[1]}`}
                      title={title}
                    >
                      <Icon className="nav-btn-icon" strokeWidth={1.5} />
                      <span className="nav-btn-text">
                        {title}
                      </span>
                      
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="nav-btn-wave">
                        <defs>
                          <linearGradient y2="50%" x2="100%" y1="50%" x1="0%" id={`gradient-${index}`}>
                            <stop stopColor="hsla(var(--dot-hue, 142), 80%, 70%, 0.8)" offset="5%"></stop>
                            <stop stopColor="hsla(var(--dot-hue, 142), 70%, 60%, 0.9)" offset="95%"></stop>
                          </linearGradient>
                        </defs>
                        <path 
                          transform="rotate(-180 720 160)" 
                          fillOpacity="1" 
                          fill={`url(#gradient-${index})`} 
                          strokeWidth="0" 
                          stroke="none" 
                          d="M0,160L48,170.7C96,181,192,203,288,192C384,181,480,139,576,133.3C672,128,768,160,864,165.3C960,171,1056,149,1152,133.3C1248,117,1344,107,1392,101.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                        ></path>
                      </svg>
                    </div>
                  </div>
                );
                
                if (isLeaderboard || isNews) {
                  return (
                    <div key={item.key} onClick={handleClick}>
                      {button}
                    </div>
                  );
                }
                
                return (
                  <Link key={item.key} href={item.url} onClick={handleClick}>
                    {button}
                  </Link>
                );
              })}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 pb-4">
        <div className="flex justify-center">
          <LanguageToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
