import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function CoinBalance() {
  const [discordId, setDiscordId] = useState<string>("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem("discord_id");
    if (savedId) {
      setDiscordId(savedId);
    } else {
      setShowInput(true);
    }
  }, []);

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/shop/balance", discordId],
    enabled: !!discordId,
    refetchInterval: 30000,
  });

  const handleSaveDiscordId = (id: string) => {
    setDiscordId(id);
    localStorage.setItem("discord_id", id);
    setShowInput(false);
  };

  if (showInput || !discordId) {
    return (
      <Popover open={showInput} onOpenChange={setShowInput}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="glass glass-border hover-elevate w-10 h-10"
            data-testid="button-set-discord-id"
          >
            <Coins className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="glass glass-border w-80">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Введите Discord ID или Username</h4>
            <p className="text-sm text-muted-foreground">
              Введите ваш Discord ID или username для отображения баланса LumiCoin
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="123456789 или username#1234"
                className="flex-1 px-3 py-2 rounded-md glass glass-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value) {
                    handleSaveDiscordId(e.currentTarget.value);
                  }
                }}
                data-testid="input-discord-id-popup"
              />
              <Button
                size="sm"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  if (input?.value) {
                    handleSaveDiscordId(input.value);
                  }
                }}
                data-testid="button-save-discord-id"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="glass glass-border hover-elevate relative h-10 px-3 min-w-[4rem]"
          data-testid="button-coin-balance"
        >
          <Coins className="h-4 w-4 text-primary mr-1" strokeWidth={1.5} />
          <span className="text-sm font-bold text-primary" data-testid="text-coin-balance">
            {balanceData?.balance ? (balanceData.balance > 9999 ? '9.9k+' : balanceData.balance.toLocaleString()) : 0}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="glass glass-border w-64">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">Ваш баланс LumiCoin</h4>
            <div className="flex items-center gap-2 text-2xl font-bold text-primary">
              <Coins className="h-6 w-6" strokeWidth={1.5} />
              {balanceData?.balance ?? 0}
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• За сообщение: +1 LC</p>
            <p>• За минуту в голосовом: +10 LC</p>
            <p>• За реакцию: +1 LC</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setDiscordId("");
              localStorage.removeItem("discord_id");
              setShowInput(true);
            }}
            data-testid="button-change-discord-id"
          >
            Сменить Discord ID/Username
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
