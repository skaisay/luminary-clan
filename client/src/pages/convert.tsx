import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Coins, ArrowRight, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";

type RobuxSettings = {
  exchangeRate: number;
  minAmount: number;
  maxAmount: number;
  isEnabled: boolean;
};

type ConversionRequest = {
  id: string;
  discordId: string;
  username: string;
  robloxUsername: string;
  lumiCoinAmount: number;
  robuxAmount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
};

export default function ConvertPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [discordId, setDiscordId] = useState("");
  const [username, setUsername] = useState("");
  const [robloxUsername, setRobloxUsername] = useState("");
  const [lumiCoinAmount, setLumiCoinAmount] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery<RobuxSettings>({
    queryKey: ["/api/robux/settings"],
  });

  const { data: requests, isLoading: requestsLoading } = useQuery<ConversionRequest[]>({
    queryKey: [`/api/robux/requests/${discordId}`],
    enabled: !!discordId && discordId.length > 0,
  });

  const convertMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/robux/convert", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: `✅ ${t('convert.requestSent')}`,
        description: t('convert.requestSentDesc'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/robux/requests/${discordId}`] });
      setLumiCoinAmount("");
      setRobloxUsername("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: `❌ ${t('convert.errorTitle')}`,
        description: error.message || t('convert.errorSending'),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!discordId || !username || !robloxUsername || !lumiCoinAmount) {
      toast({
        variant: "destructive",
        title: t('convert.fillAllFields'),
        description: t('convert.fillAllFieldsDesc'),
      });
      return;
    }

    const amount = parseInt(lumiCoinAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: t('convert.invalidAmount'),
        description: t('convert.invalidAmountDesc'),
      });
      return;
    }

    convertMutation.mutate({
      discordId,
      username,
      robloxUsername,
      lumiCoinAmount: amount,
    });
  };

  const calculateRobux = (lc: string) => {
    const amount = parseInt(lc);
    if (!settings || isNaN(amount)) return 0;
    return Math.floor(amount / settings.exchangeRate);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3 mr-1" />
            {t('convert.pending')}
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30" data-testid={`badge-status-approved`}>
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('convert.approved')}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30" data-testid={`badge-status-completed`}>
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('convert.completed')}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30" data-testid={`badge-status-rejected`}>
            <XCircle className="h-3 w-3 mr-1" />
            {t('convert.rejected')}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center justify-center gap-3">
          <Coins className="h-10 w-10 text-primary" strokeWidth={1.5} />
          {t('convert.title')}
        </h1>
        <p className="text-muted-foreground text-lg mb-4">
          {t('convert.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Форма конвертации */}
        <div className="space-y-6">
          <Card className="glass glass-border neon-glow-cyan">
            <CardHeader>
              <CardTitle className="neon-text-cyan flex items-center gap-2">
                <Coins className="h-5 w-5" />
                {t('convert.submit')}
              </CardTitle>
              <CardDescription>
                {t('convert.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !settings?.isEnabled ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">{t('convert.systemDisabled')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="discordId">{t('convert.discordIdLabel')} *</Label>
                    <Input
                      id="discordId"
                      value={discordId}
                      onChange={(e) => setDiscordId(e.target.value)}
                      placeholder={t('convert.discordIdPlaceholder')}
                      data-testid="input-discord-id"
                    />
                  </div>

                  <div>
                    <Label htmlFor="username">{t('convert.usernameLabel')} *</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('convert.usernamePlaceholder')}
                      data-testid="input-username"
                    />
                  </div>

                  <div>
                    <Label htmlFor="robloxUsername">{t('convert.robloxUsernameLabel')} *</Label>
                    <Input
                      id="robloxUsername"
                      value={robloxUsername}
                      onChange={(e) => setRobloxUsername(e.target.value)}
                      placeholder={t('convert.robloxUsernamePlaceholder')}
                      data-testid="input-roblox-username"
                    />
                  </div>

                  <div>
                    <Label htmlFor="amount">{t('convert.lumiCoinAmountLabel')} *</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={lumiCoinAmount}
                      onChange={(e) => setLumiCoinAmount(e.target.value)}
                      placeholder={t('convert.lumiCoinAmountPlaceholder')}
                      min={settings.minAmount}
                      max={settings.maxAmount}
                      data-testid="input-lumicoin-amount"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('convert.minAmount')}: {settings.minAmount} LC | {t('convert.maxAmount')}: {settings.maxAmount} LC
                    </p>
                  </div>

                  {lumiCoinAmount && (
                    <div className="glass glass-border rounded-lg p-4">
                      <div className="flex items-center justify-between text-lg">
                        <span className="text-cyan-400 font-semibold">{lumiCoinAmount} LC</span>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        <span className="text-primary font-bold">{calculateRobux(lumiCoinAmount)} {t('convert.robux')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {t('convert.exchangeRate')}: {settings.exchangeRate} LC = 1 Robux
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full neon-glow-cyan"
                    disabled={convertMutation.isPending}
                    data-testid="button-submit-conversion"
                  >
                    {convertMutation.isPending ? t('convert.submitting') : t('convert.submit')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Информация о курсе */}
          {settings && settings.isEnabled && (
            <Card className="glass glass-border">
              <CardHeader>
                <CardTitle className="text-lg">{t('convert.exchangeRate')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('convert.exchangeRate')}:</span>
                  <span className="font-semibold">{settings.exchangeRate} LC = 1 Robux</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('convert.minAmount')}:</span>
                  <span className="font-semibold">{settings.minAmount} LC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('convert.maxAmount')}:</span>
                  <span className="font-semibold">{settings.maxAmount} LC</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* История запросов */}
        <div>
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('convert.yourRequests')}
              </CardTitle>
              <CardDescription>
                {discordId ? t('convert.yourRequests') : t('convert.discordIdPlaceholder')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!discordId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>{t('convert.discordIdPlaceholder')}</p>
                </div>
              ) : requestsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : requests && requests.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {requests.map((request) => (
                    <Card key={request.id} className="glass glass-border" data-testid={`request-${request.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">{request.robloxUsername}</div>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString("ru-RU", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('convert.amount')}:</span>
                          <span className="font-semibold text-cyan-400">{request.lumiCoinAmount} LC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('convert.robux')}:</span>
                          <span className="font-semibold text-primary">{request.robuxAmount} R$</span>
                        </div>
                        {request.adminNote && (
                          <div className="mt-2 p-2 glass glass-border rounded text-xs">
                            <span className="text-muted-foreground">{t('convert.adminNote')}:</span>
                            <p className="mt-1">{request.adminNote}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('convert.noRequests')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
