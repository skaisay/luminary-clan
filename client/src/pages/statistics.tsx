import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ClanMember, MonthlyStats } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

export default function Statistics() {
  const { t } = useLanguage();
  const { data: members } = useQuery<ClanMember[]>({
    queryKey: ["/api/members"],
  });

  const { data: monthlyStatsData } = useQuery<MonthlyStats[]>({
    queryKey: ["/api/monthly-stats"],
  });

  const topPerformers = members
    ?.sort((a, b) => (b.lumiCoins ?? 0) - (a.lumiCoins ?? 0))
    .slice(0, 5)
    .map(m => ({
      name: m.username.length > 10 ? m.username.substring(0, 10) + '...' : m.username,
      score: m.lumiCoins ?? 0,
    })) || [];

  const monthlyData = monthlyStatsData
    ?.slice()
    .reverse()
    .map(stat => ({
      month: monthNames[stat.month - 1],
      activity: stat.activity,
    })) || [];

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 neon-text-cyan tracking-wide">
          {t('statistics.title')}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('statistics.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="glass glass-border overflow-hidden group hover-elevate">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2.5 rounded-xl bg-accent/10 backdrop-blur-sm">
                <Activity className="h-6 w-6 text-accent" />
              </div>
              <span>Активность по Месяцам</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlyData}>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="month" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 15, 0.95)",
                    border: "1px solid rgba(168, 85, 247, 0.2)",
                    borderRadius: "12px",
                    backdropFilter: "blur(10px)",
                    padding: "12px",
                  }}
                  cursor={{ fill: "rgba(168, 85, 247, 0.05)" }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="circle"
                />
                <Bar 
                  dataKey="activity" 
                  fill="url(#activityGradient)" 
                  name="Активность"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass glass-border overflow-hidden group hover-elevate">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2.5 rounded-xl bg-primary/10 backdrop-blur-sm">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <span>Топ 5 по LumiCoin</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topPerformers} layout="vertical">
                <defs>
                  <linearGradient id="performerGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  type="number" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={12}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 15, 0.95)",
                    border: "1px solid rgba(0, 240, 255, 0.2)",
                    borderRadius: "12px",
                    backdropFilter: "blur(10px)",
                    padding: "12px",
                  }}
                  cursor={{ fill: "rgba(0, 240, 255, 0.05)" }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="circle"
                />
                <Bar 
                  dataKey="score" 
                  fill="url(#performerGradient)" 
                  name="LumiCoin"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
