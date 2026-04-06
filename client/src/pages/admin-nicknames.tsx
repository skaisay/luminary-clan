import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, UserCog, Undo2, ArrowLeft, RefreshCw, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

interface DiscordMember {
  id: string;
  username: string;
  avatar: string;
  roles: string[];
}

interface BulkRenameStatus {
  isActive: boolean;
  savedCount: number;
  lastRenameTime: string | null;
}

export default function AdminNicknames() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [search, setSearch] = useState("");

  // Auth check
  useEffect(() => {
    fetch("/api/admin/check", { credentials: "include" })
      .then(r => { setIsAuthed(r.ok); if (!r.ok) navigate("/admin/login"); })
      .catch(() => { setIsAuthed(false); navigate("/admin/login"); });
  }, [navigate]);

  // Fetch members
  const { data: members, isLoading: membersLoading } = useQuery<DiscordMember[]>({
    queryKey: ["/api/admin/discord/members"],
    enabled: isAuthed === true,
  });

  // Fetch rename status
  const { data: renameStatus } = useQuery<BulkRenameStatus>({
    queryKey: ["/api/admin/discord/bulk-rename-status"],
    enabled: isAuthed === true,
    refetchInterval: 5000,
  });

  // Filtered members
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!search) return members;
    const s = search.toLowerCase();
    return members.filter(m => m.username.toLowerCase().includes(s));
  }, [members, search]);

  // Select all toggle
  useEffect(() => {
    if (selectAll && members) {
      setSelectedIds(new Set(members.map(m => m.id)));
    } else if (!selectAll) {
      setSelectedIds(new Set());
    }
  }, [selectAll, members]);

  // Toggle single member
  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setSelectAll(false); }
      else next.add(id);
      return next;
    });
  };

  // Bulk rename mutation
  const renameMutation = useMutation({
    mutationFn: async () => {
      const body: any = { newName };
      if (!selectAll && selectedIds.size > 0 && members && selectedIds.size < members.length) {
        body.memberIds = Array.from(selectedIds);
      }
      const res = await apiRequest("POST", "/api/admin/discord/bulk-rename", body);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/bulk-rename-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/members"] });
      toast({
        title: "✅ Имена изменены",
        description: `Успешно: ${data.success}, Ошибок: ${data.failed} из ${data.total}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/discord/restore-nicknames", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/bulk-rename-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/members"] });
      toast({
        title: "✅ Имена восстановлены",
        description: `Успешно: ${data.success}, Ошибок: ${data.failed} из ${data.total}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  if (isAuthed === null) {
    return <div className="flex items-center justify-center min-h-screen"><Skeleton className="h-8 w-48" /></div>;
  }

  const canRename = newName.trim().length > 0 && newName.length <= 32 && (selectAll || selectedIds.size > 0);
  const isProcessing = renameMutation.isPending || restoreMutation.isPending;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCog className="h-6 w-6" /> Массовая смена ников
            </h1>
            <p className="text-muted-foreground text-sm">Изменить имя всем или выбранным участникам на сервере</p>
          </div>
        </div>

        {/* Restore banner */}
        {renameStatus?.isActive && (
          <Alert className="border-yellow-500 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Сохранены оригинальные имена <Badge variant="secondary">{renameStatus.savedCount} чел.</Badge>
                {renameStatus.lastRenameTime && (
                  <span className="text-xs text-muted-foreground ml-2">
                    от {new Date(renameStatus.lastRenameTime).toLocaleString('ru-RU')}
                  </span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreMutation.mutate()}
                disabled={isProcessing}
                className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950 ml-4"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                {restoreMutation.isPending ? "Восстанавливаем..." : "Восстановить все"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Rename form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Новое имя</CardTitle>
            <CardDescription>Введите имя, которое будет установлено выбранным участникам</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Введите новое имя (макс. 32 символа)..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                maxLength={32}
                className="flex-1"
              />
              <Button
                onClick={() => renameMutation.mutate()}
                disabled={!canRename || isProcessing}
                className="min-w-[160px]"
              >
                <UserCog className="w-4 h-4 mr-1" />
                {renameMutation.isPending
                  ? "Меняем..."
                  : selectAll
                    ? `Переименовать всех`
                    : `Переименовать (${selectedIds.size})`
                }
              </Button>
            </div>
            {newName.length > 0 && newName.length <= 32 && (
              <p className="text-xs text-muted-foreground">{newName.length}/32 символов</p>
            )}
            {newName.length > 32 && (
              <p className="text-xs text-destructive">Максимум 32 символа!</p>
            )}
          </CardContent>
        </Card>

        {/* Members list */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Участники сервера
                  {members && <Badge variant="secondary">{members.length}</Badge>}
                </CardTitle>
                <CardDescription>Выберите участников или нажмите "Выбрать всех"</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/members"] })}
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Обновить
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={(checked) => setSelectAll(!!checked)}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Выбрать всех
                </label>
              </div>
              {selectedIds.size > 0 && !selectAll && (
                <Badge variant="outline">Выбрано: {selectedIds.size}</Badge>
              )}
              <div className="flex-1">
                <Input
                  placeholder="Поиск по имени..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 text-sm max-w-xs ml-auto"
                />
              </div>
            </div>

            {/* Members */}
            {membersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !members || members.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Нет участников</p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedIds.has(member.id) ? 'bg-primary/10 border-primary/30' : 'bg-card hover:bg-muted/50'
                    }`}
                    onClick={() => toggleMember(member.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(member.id)}
                      onCheckedChange={() => toggleMember(member.id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>{member.username.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.username}</p>
                      <div className="flex gap-1 flex-wrap">
                        {member.roles.slice(0, 3).map((r, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">{r}</Badge>
                        ))}
                        {member.roles.length > 3 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">+{member.roles.length - 3}</Badge>
                        )}
                      </div>
                    </div>
                    {selectedIds.has(member.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
