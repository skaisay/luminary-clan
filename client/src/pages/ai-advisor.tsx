import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiChatMessage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AIAdvisor() {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages, isLoading } = useQuery<AiChatMessage[]>({
    queryKey: ["/api/ai/messages"],
  });

  const chatMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", "/api/ai/chat", { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/messages"] });
      setMessage("");
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (message.trim()) {
      chatMutation.mutate(message);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl relative">
      <div className="mb-8 ml-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 neon-text-cyan tracking-wide flex items-center gap-3">
          <Bot className="h-12 w-12 animate-pulse-glow" />
          AI Советник Клана
        </h1>
        <p className="text-muted-foreground text-lg">
          Умный помощник для анализа статистики и советов
        </p>
      </div>

      <Card className="glass glass-border mb-6 neon-glow-cyan">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            <span>Статус AI</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">Готов к общению</span>
          </div>
        </CardContent>
      </Card>

      <Card className="glass glass-border h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Чат с AI Советником</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <>
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.role}-${msg.id}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-xl ${
                        msg.role === "user"
                          ? "glass glass-border ml-auto"
                          : "glass glass-border neon-glow-cyan"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {msg.role === "assistant" && <Bot className="h-5 w-5 text-primary" />}
                        <span className="font-semibold text-sm">
                          {msg.role === "user" ? "Вы" : "AI Советник"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(msg.createdAt).toLocaleTimeString('ru-RU')}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Спросите совет у AI..."
              className="glass glass-border"
              disabled={chatMutation.isPending}
              data-testid="input-chat"
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || chatMutation.isPending}
              className="neon-glow-cyan"
              data-testid="button-send"
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
