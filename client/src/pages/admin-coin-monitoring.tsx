import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins, Filter, RefreshCw, TrendingUp, TrendingDown, Users, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";

type CoinTransaction = {
  id: string;
  memberId: string;
  discordId: string;
  username: string;
  amount: number;
  type: "earn" | "spend";
  description: string;
  createdAt: string;
};

type TransactionsResponse = {
  transactions: CoinTransaction[];
  total: number;
};

export default function AdminCoinMonitoring() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [discordIdFilter, setDiscordIdFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading, refetch } = useQuery<TransactionsResponse>({
    queryKey: ["/api/admin/coin-transactions", typeFilter, limit, page * limit],
    queryFn: async () => {
      let url = `/api/admin/coin-transactions/${typeFilter}/${limit}/${page * limit}`;
      if (discordIdFilter) {
        url += `?discordId=${encodeURIComponent(discordIdFilter)}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return await res.json();
    },
    refetchInterval: 30000, // Обновление каждые 30 секунд
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getTypeIcon = (type: string) => {
    return type === "earn" ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const getTypeBadge = (type: string) => {
    return type === "earn" ? (
      <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/50">
        {t('coin_monitoring.earned')}
      </Badge>
    ) : (
      <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/50">
        {t('coin_monitoring.spent')}
      </Badge>
    );
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  // Статистика
  const stats = data?.transactions.reduce(
    (acc, tx) => {
      if (tx.type === "earn") {
        acc.totalEarned += tx.amount;
        acc.earnCount++;
      } else {
        acc.totalSpent += tx.amount;
        acc.spendCount++;
      }
      return acc;
    },
    { totalEarned: 0, totalSpent: 0, earnCount: 0, spendCount: 0 }
  ) || { totalEarned: 0, totalSpent: 0, earnCount: 0, spendCount: 0 };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Кнопка "Назад" */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="gap-2"
          data-testid="button-back-to-admin"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back') || 'Back to Admin Panel'}
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary tracking-wide flex items-center gap-3">
          <Coins className="h-12 w-12" />
          {t('coin_monitoring.title') || 'LumiCoin Monitoring'}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('coin_monitoring.subtitle') || 'Track all LumiCoin transactions in real-time'}
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="glass glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              {t('coin_monitoring.total_earned') || 'Total Earned'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {isLoading ? <Skeleton className="h-8 w-24" /> : `+${stats.totalEarned.toFixed(2)} LC`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.earnCount} {t('coin_monitoring.transactions') || 'transactions'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              {t('coin_monitoring.total_spent') || 'Total Spent'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {isLoading ? <Skeleton className="h-8 w-24" /> : `-${stats.totalSpent.toFixed(2)} LC`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.spendCount} {t('coin_monitoring.transactions') || 'transactions'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              {t('coin_monitoring.net_change') || 'Net Change'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalEarned - stats.totalSpent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {isLoading ? <Skeleton className="h-8 w-24" /> : `${stats.totalEarned - stats.totalSpent >= 0 ? '+' : ''}${(stats.totalEarned - stats.totalSpent).toFixed(2)} LC`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('coin_monitoring.current_page') || 'On current page'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              {t('coin_monitoring.total_records') || 'Total Records'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-24" /> : data?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('coin_monitoring.all_transactions') || 'All transactions'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Фильтры */}
      <Card className="glass glass-border mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('coin_monitoring.filters') || 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-2 block">
                {t('coin_monitoring.transaction_type') || 'Transaction Type'}
              </label>
              <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(0); }}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('coin_monitoring.all') || 'All'}</SelectItem>
                  <SelectItem value="earn">{t('coin_monitoring.earned') || 'Earned'}</SelectItem>
                  <SelectItem value="spend">{t('coin_monitoring.spent') || 'Spent'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-2 block">
                {t('coin_monitoring.discord_id') || 'Discord ID'}
              </label>
              <Input
                placeholder={t('coin_monitoring.enter_discord_id') || 'Enter Discord ID...'}
                value={discordIdFilter}
                onChange={(e) => { setDiscordIdFilter(e.target.value); setPage(0); }}
                data-testid="input-discord-id-filter"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('coin_monitoring.refresh') || 'Refresh'}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>{t('coin_monitoring.auto_refresh') || 'Auto-refreshing every 30 seconds'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Таблица транзакций */}
      <Card className="glass glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            {t('coin_monitoring.recent_transactions') || 'Recent Transactions'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('coin_monitoring.no_transactions') || 'No transactions found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coin_monitoring.date') || 'Date'}</TableHead>
                      <TableHead>{t('coin_monitoring.username') || 'Username'}</TableHead>
                      <TableHead>{t('coin_monitoring.discord_id') || 'Discord ID'}</TableHead>
                      <TableHead>{t('coin_monitoring.type') || 'Type'}</TableHead>
                      <TableHead>{t('coin_monitoring.amount') || 'Amount'}</TableHead>
                      <TableHead>{t('coin_monitoring.description') || 'Description'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.transactions.map((tx) => (
                      <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">{tx.username}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {tx.discordId}
                        </TableCell>
                        <TableCell>{getTypeBadge(tx.type)}</TableCell>
                        <TableCell className="font-bold">
                          <div className="flex items-center gap-1">
                            {getTypeIcon(tx.type)}
                            <span className={tx.type === "earn" ? "text-green-500" : "text-red-500"}>
                              {tx.type === "earn" ? '+' : '-'}{Math.abs(tx.amount).toFixed(2)} LC
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate" title={tx.description}>
                          {tx.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  {t('coin_monitoring.showing') || 'Showing'} {page * limit + 1} - {Math.min((page + 1) * limit, data?.total || 0)} {t('coin_monitoring.of') || 'of'} {data?.total || 0}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    {t('coin_monitoring.previous') || 'Previous'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    {t('coin_monitoring.next') || 'Next'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
