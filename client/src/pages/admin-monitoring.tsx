import { useQuery } from "@tanstack/react-query";
import { Activity, Server, Bot, Database, Cpu, HardDrive, Zap, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

type SystemStatus = {
  server: {
    status: "online" | "offline" | "degraded";
    uptime: number;
    memory: { used: number; total: number };
    cpu: number;
  };
  bot: {
    status: "online" | "offline";
    username: string;
    ping: number;
    guilds: number;
    voiceConnections: number;
  };
  database: {
    status: "online" | "offline";
    responseTime: number;
    connections: number;
  };
  stats: {
    totalMembers: number;
    onlineMembers: number;
    totalRequests: number;
    totalNews: number;
  };
};

export default function AdminMonitoring() {
  const { t } = useLanguage();

  const { data: status, isLoading, error } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/monitoring"],
    refetchInterval: 5000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "text-green-500";
      case "offline":
        return "text-red-500";
      case "degraded":
        return "text-yellow-500";
      default:
        return "text-gray-500";
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "outline" => {
    switch (status) {
      case "online":
        return "default";
      case "offline":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="glass glass-border border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Unable to fetch monitoring data. Please check the server connection.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-8 ml-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center gap-3">
          <Activity className="h-12 w-12" />
          System Monitoring
        </h1>
        <p className="text-muted-foreground text-lg">
          Real-time system status and performance metrics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className={`h-6 w-6 ${getStatusColor(status?.server.status || "offline")}`} />
              Server Status
              {isLoading ? (
                <Skeleton className="h-6 w-20 ml-auto" />
              ) : (
                <Badge
                  variant={getStatusBadgeVariant(status?.server.status || "offline")}
                  className="ml-auto"
                >
                  {status?.server.status?.toUpperCase()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Uptime</span>
                  </div>
                  <span className="font-bold">{formatUptime(status?.server.uptime || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-accent" />
                    <span className="text-muted-foreground">Memory</span>
                  </div>
                  <span className="font-bold">
                    {formatMemory(status?.server.memory.used || 0)} / {formatMemory(status?.server.memory.total || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-chart-3" />
                    <span className="text-muted-foreground">CPU Usage</span>
                  </div>
                  <span className="font-bold">{status?.server.cpu.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className={`h-6 w-6 ${getStatusColor(status?.bot.status || "offline")}`} />
              Discord Bot
              {isLoading ? (
                <Skeleton className="h-6 w-20 ml-auto" />
              ) : (
                <Badge
                  variant={getStatusBadgeVariant(status?.bot.status || "offline")}
                  className="ml-auto"
                >
                  {status?.bot.status?.toUpperCase()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Username</span>
                  </div>
                  <span className="font-bold">{status?.bot.username || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-accent" />
                    <span className="text-muted-foreground">Ping</span>
                  </div>
                  <span className="font-bold">{status?.bot.ping}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-chart-3" />
                    <span className="text-muted-foreground">Guilds</span>
                  </div>
                  <span className="font-bold">{status?.bot.guilds}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-chart-4" />
                    <span className="text-muted-foreground">Voice Connections</span>
                  </div>
                  <span className="font-bold">{status?.bot.voiceConnections}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className={`h-6 w-6 ${getStatusColor(status?.database.status || "offline")}`} />
              Database
              {isLoading ? (
                <Skeleton className="h-6 w-20 ml-auto" />
              ) : (
                <Badge
                  variant={getStatusBadgeVariant(status?.database.status || "offline")}
                  className="ml-auto"
                >
                  {status?.database.status?.toUpperCase()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Response Time</span>
                  </div>
                  <span className="font-bold">{status?.database.responseTime}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-accent" />
                    <span className="text-muted-foreground">Active Connections</span>
                  </div>
                  <span className="font-bold">{status?.database.connections}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Application Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Total Members</span>
                  </div>
                  <span className="font-bold">{status?.stats.totalMembers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    <span className="text-muted-foreground">Online Members</span>
                  </div>
                  <span className="font-bold">{status?.stats.onlineMembers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-accent" />
                    <span className="text-muted-foreground">Total Requests</span>
                  </div>
                  <span className="font-bold">{status?.stats.totalRequests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-chart-3" />
                    <span className="text-muted-foreground">Total News</span>
                  </div>
                  <span className="font-bold">{status?.stats.totalNews}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              Live Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-refreshing every 5 seconds</span>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
