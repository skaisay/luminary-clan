import { useQuery, useMutation } from "@tanstack/react-query";
import { Ban, UserX, Trash2, Plus, Shield, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insertSiteBanSchema, type SiteBan, type ClanMember } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { z } from "zod";

// Функция для расчета времени истечения бана
const calculateBanExpiry = (duration: string): Date | null => {
  if (duration === "permanent") return null;
  
  const now = new Date();
  const [value, unit] = duration.split("-");
  const numValue = parseInt(value);
  
  let milliseconds = 0;
  switch (unit) {
    case "s": milliseconds = numValue * 1000; break;
    case "m": milliseconds = numValue * 60 * 1000; break;
    case "h": milliseconds = numValue * 60 * 60 * 1000; break;
    case "d": milliseconds = numValue * 24 * 60 * 60 * 1000; break;
    default: return null;
  }
  
  return new Date(now.getTime() + milliseconds);
};

export default function AdminSiteBans() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ClanMember | null>(null);
  const { toast } = useToast();
  
  const { data: bans, isLoading } = useQuery<SiteBan[]>({
    queryKey: ["/api/admin/site-bans"],
  });

  // Загрузка списка участников
  const { data: members } = useQuery<ClanMember[]>({
    queryKey: ["/api/members"],
  });

  // Создаем схему формы с трансформацией даты
  const formSchema = z.object({
    reason: z.string().min(1, "Причина обязательна"),
    duration: z.string(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: "",
      duration: "permanent",
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ reason, duration }: { reason: string; duration: string }) => {
      if (!selectedMember) throw new Error("Выберите пользователя");
      if (!selectedMember.discordId) throw new Error("У пользователя нет Discord ID");
      
      const expiresAt = calculateBanExpiry(duration);
      const banData = {
        discordId: selectedMember.discordId,
        username: selectedMember.username,
        reason,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        bannedBy: user?.id || "unknown",
        bannedByUsername: user?.username || "Admin",
      };
      
      return await apiRequest("POST", "/api/admin/site-bans", banData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/site-bans"] });
      toast({
        title: t('common.success'),
        description: "Бан успешно создан",
      });
      setOpen(false);
      setSelectedMember(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "Не удалось создать бан",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/site-bans/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/site-bans"] });
      toast({
        title: t('common.success'),
        description: "Бан успешно удалён",
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "Не удалось удалить бан",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: { reason: string; duration: string }) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены, что хотите удалить этот бан?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <div className="mb-8 ml-16">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-wide flex items-center gap-3">
            <Ban className="h-12 w-12" />
            {t('admin.siteBans.title', 'Баны на сайте')}
          </h1>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button 
                className="neon-glow-cyan" 
                data-testid="button-create-ban"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('admin.siteBans.createBan', 'Создать бан')}
              </Button>
            </DialogTrigger>
            <DialogContent className="glass glass-border max-w-md">
              <DialogHeader>
                <DialogTitle>{t('admin.siteBans.createBan', 'Создать бан')}</DialogTitle>
                <DialogDescription>
                  {t('admin.siteBans.createDescription', 'Заблокируйте пользователя на сайте')}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Выбор пользователя */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t('admin.siteBans.selectUser', 'Выберите пользователя')}
                    </label>
                    <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={userSearchOpen}
                          className="w-full justify-between"
                          data-testid="button-select-user"
                        >
                          {selectedMember ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={selectedMember.avatar || undefined} />
                                <AvatarFallback>{selectedMember.username[0]}</AvatarFallback>
                              </Avatar>
                              <span>{selectedMember.username}</span>
                            </div>
                          ) : (
                            "Выберите участника..."
                          )}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Поиск участника..." />
                          <CommandList>
                            <CommandEmpty>Участники не найдены</CommandEmpty>
                            <CommandGroup>
                              {members?.filter(m => m.discordId).map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={member.username}
                                  onSelect={() => {
                                    setSelectedMember(member);
                                    setUserSearchOpen(false);
                                  }}
                                  data-testid={`option-user-${member.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={member.avatar || undefined} />
                                      <AvatarFallback>{member.username[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium">{member.username}</div>
                                      <div className="text-xs text-muted-foreground">ID: {member.discordId}</div>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedMember && (
                      <div className="text-xs text-muted-foreground">
                        Discord ID: {selectedMember.discordId}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.siteBans.reason', 'Причина')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t('admin.siteBans.reasonPlaceholder', 'Укажите причину бана...')}
                            {...field} 
                            data-testid="input-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.siteBans.duration', 'Длительность')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-duration">
                              <SelectValue placeholder={t('admin.siteBans.selectDuration', 'Выберите длительность')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="30-s">30 секунд</SelectItem>
                            <SelectItem value="1-m">1 минута</SelectItem>
                            <SelectItem value="5-m">5 минут</SelectItem>
                            <SelectItem value="30-m">30 минут</SelectItem>
                            <SelectItem value="1-h">1 час</SelectItem>
                            <SelectItem value="1-d">1 день</SelectItem>
                            <SelectItem value="3-d">3 дня</SelectItem>
                            <SelectItem value="7-d">7 дней</SelectItem>
                            <SelectItem value="14-d">14 дней</SelectItem>
                            <SelectItem value="30-d">30 дней</SelectItem>
                            <SelectItem value="permanent">Перманентно</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full neon-glow-purple"
                    disabled={createMutation.isPending || !selectedMember}
                    data-testid="button-submit-ban"
                  >
                    {createMutation.isPending ? t('common.loading', 'Загрузка...') : t('admin.siteBans.create', 'Создать')}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        <p className="text-muted-foreground mt-4">
          {t('admin.siteBans.description', 'Управляйте банами пользователей на сайте')}
        </p>
      </div>

      {/* Список банов */}
      <div className="ml-16 space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="glass glass-border">
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : bans && bans.length > 0 ? (
          bans.map((ban) => (
            <Card key={ban.id} className="glass glass-border hover-elevate" data-testid={`card-ban-${ban.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <UserX className="h-6 w-6 text-destructive" />
                    <div>
                      <CardTitle className="text-lg">{ban.username}</CardTitle>
                      <CardDescription className="text-xs">
                        Discord ID: {ban.discordId}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {ban.isActive ? (
                      <Badge variant="destructive">
                        {t('admin.siteBans.active', 'Активен')}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t('admin.siteBans.inactive', 'Неактивен')}
                      </Badge>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(ban.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${ban.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {t('admin.siteBans.reason', 'Причина')}:
                    </span>
                    <p className="text-sm mt-1">{ban.reason}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {t('admin.siteBans.bannedBy', 'Забанил')}: {ban.bannedByUsername}
                    </span>
                    <span>•</span>
                    <span>
                      {t('admin.siteBans.createdAt', 'Создан')}: {format(new Date(ban.createdAt), 'dd.MM.yyyy HH:mm')}
                    </span>
                    {ban.expiresAt && (
                      <>
                        <span>•</span>
                        <span>
                          {t('admin.siteBans.expiresAt', 'Истекает')}: {format(new Date(ban.expiresAt), 'dd.MM.yyyy HH:mm')}
                        </span>
                      </>
                    )}
                    {!ban.expiresAt && (
                      <>
                        <span>•</span>
                        <Badge variant="destructive" className="text-xs">
                          {t('admin.siteBans.permanent', 'Перманентный')}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="glass glass-border">
            <CardContent className="p-12 text-center">
              <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('admin.siteBans.noBans', 'Нет активных банов')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
