import { Shield, Target, Users, Trophy, Star, Heart, Handshake, Sparkles, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { ClanSettings } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";
import clanEmblem from "@assets/generated_images/Gaming_clan_emblem_logo_499b43c5.png";

export default function About() {
  const { t } = useLanguage();
  const { data: settings, isLoading: settingsLoading } = useQuery<ClanSettings>({
    queryKey: ["/api/clan/settings"],
  });
  const rules = [
    t('about.rule1'),
    t('about.rule2'),
    t('about.rule3'),
    t('about.rule4'),
    t('about.rule5'),
    t('about.rule6'),
    t('about.rule7'),
    t('about.rule8'),
  ];

  const achievements = [
    { icon: Trophy, title: t('about.achievement1Title'), description: t('about.achievement1Desc') },
    { icon: Star, title: t('about.achievement2Title'), description: t('about.achievement2Desc') },
    { icon: Target, title: t('about.achievement3Title'), description: t('about.achievement3Desc') },
    { icon: Award, title: t('about.achievement4Title'), description: t('about.achievement4Desc') },
  ];

  const values = [
    { 
      icon: Heart, 
      title: t('about.honesty'), 
      description: t('about.honestyDesc'),
      gradient: "from-red-500/10 to-pink-500/10"
    },
    { 
      icon: Handshake, 
      title: t('about.unity'), 
      description: t('about.unityDesc'),
      gradient: "from-blue-500/10 to-cyan-500/10"
    },
    { 
      icon: Sparkles, 
      title: t('about.mastery'), 
      description: t('about.masteryDesc'),
      gradient: "from-yellow-500/10 to-orange-500/10"
    },
    { 
      icon: Award, 
      title: t('about.victory'), 
      description: t('about.victoryDesc'),
      gradient: "from-purple-500/10 to-violet-500/10"
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
            <img
              src={settings?.logoUrl || clanEmblem}
              alt="Clan Emblem"
              className="relative w-32 h-32 rounded-2xl object-cover border-2 border-primary/30"
            />
          </div>
        </div>
        {settingsLoading ? (
          <Skeleton className="h-16 w-96 mx-auto mb-4" />
        ) : (
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-primary tracking-wide" data-testid="text-about-clan-name">
            {t('about.title')} {settings?.clanName || "CLAN COMMAND"}
          </h1>
        )}
        {settingsLoading ? (
          <Skeleton className="h-16 w-full max-w-3xl mx-auto" />
        ) : (
          <p className="text-muted-foreground text-xl max-w-3xl mx-auto" data-testid="text-about-clan-description">
            {settings?.description || "Элитный игровой клан, основанный в 2020 году. Мы объединяем талантливых игроков, стремящихся к совершенству и победам на самом высоком уровне."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {values.map((value) => (
          <Card key={value.title} className="glass glass-border hover-elevate text-center group overflow-hidden relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${value.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <CardContent className="pt-8 pb-6 relative">
              <div className="mb-4 inline-flex p-4 rounded-2xl bg-background/50 backdrop-blur-sm">
                <value.icon className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass glass-border mb-12 hover-elevate">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            {t('about.rules')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg glass glass-border hover-elevate group"
                data-testid={`rule-${index}`}
              >
                <div className="flex items-center justify-center min-w-[32px] h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm backdrop-blur-sm group-hover:bg-primary/20 transition-colors">
                  {index + 1}
                </div>
                <p className="text-sm pt-1 leading-relaxed">{rule}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
