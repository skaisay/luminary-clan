import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import {
  Upload, Download, FileIcon, Image, Film, Music, FileText, Archive,
  Send, Check, X, Trash2, LogIn, ArrowRight, RefreshCw, Search,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

type OnlineUser = { discordId: string; username: string; avatar: string };
type TransferIn = {
  id: string; fromUsername: string; fromAvatar: string; fromDiscordId: string;
  originalName: string; size: number; mimeType: string; createdAt: number; downloaded: boolean;
};
type TransferOut = {
  id: string; toUsername: string; toDiscordId: string;
  originalName: string; size: number; mimeType: string; createdAt: number; downloaded: boolean;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "Только что";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
  return new Date(ts).toLocaleDateString('ru-RU');
}

function getFileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="w-5 h-5 text-pink-400" />;
  if (mime.startsWith('video/')) return <Film className="w-5 h-5 text-blue-400" />;
  if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-green-400" />;
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('7z'))
    return <Archive className="w-5 h-5 text-yellow-400" />;
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text'))
    return <FileText className="w-5 h-5 text-orange-400" />;
  return <FileIcon className="w-5 h-5 text-gray-400" />;
}

// Transfer animation overlay
function TransferAnimation({ fromUser, toUser, fileName, onDone }: {
  fromUser: { username: string; avatar: string };
  toUser: { username: string; avatar: string };
  fileName: string;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setTimeout(onDone, 600); return 100; }
        return p + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.7)' }}>
      <div className="relative w-full max-w-lg mx-4">
        {/* Glass card */}
        <div className="rounded-3xl p-8 text-center"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>

          {/* Two avatars with arrow */}
          <div className="flex items-center justify-center gap-6 mb-8">
            {/* Sender */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-purple-500/50 shadow-lg shadow-purple-500/20">
                  <img src={fromUser.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-black flex items-center justify-center">
                  <Send className="w-3 h-3 text-white" />
                </div>
              </div>
              <span className="text-sm font-medium text-purple-300 max-w-[100px] truncate">{fromUser.username}</span>
            </div>

            {/* Animated arrow with flying particles */}
            <div className="relative w-24 flex items-center justify-center">
              {/* Progress arc */}
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #a855f7, #ec4899, #3b82f6)',
                    }}
                  />
                </div>
              </div>
              {/* Flying dot */}
              <div
                className="absolute w-4 h-4 rounded-full"
                style={{
                  left: `${progress * 0.85}%`,
                  background: 'radial-gradient(circle, #fff 0%, #a855f7 70%)',
                  boxShadow: '0 0 20px #a855f7, 0 0 40px #a855f760',
                  transition: 'left 100ms linear',
                }}
              />
              {/* Arrow head */}
              <ArrowRight className="absolute right-0 w-5 h-5 text-white/40" />
            </div>

            {/* Receiver */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className={`w-20 h-20 rounded-full overflow-hidden border-2 shadow-lg transition-all duration-500 ${
                  progress >= 100 ? 'border-green-500/80 shadow-green-500/20' : 'border-blue-500/50 shadow-blue-500/20'
                }`}>
                  <img src={toUser.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                {progress >= 100 && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-black flex items-center justify-center animate-bounce">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-blue-300 max-w-[100px] truncate">{toUser.username}</span>
            </div>
          </div>

          {/* File name + progress text */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-white/70">
              <FileIcon className="w-4 h-4" />
              <span className="text-sm truncate max-w-[250px]">{fileName}</span>
            </div>
            <div className="text-2xl font-bold" style={{
              background: 'linear-gradient(90deg, #a855f7, #ec4899, #3b82f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {progress >= 100 ? '✓ Отправлено!' : `${progress}%`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FileTransferPage() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [transferAnim, setTransferAnim] = useState<{
    fromUser: { username: string; avatar: string };
    toUser: { username: string; avatar: string };
    fileName: string;
  } | null>(null);
  const [tab, setTab] = useState<'send' | 'inbox' | 'sent'>('send');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: onlineUsers } = useQuery<{ count: number; users: OnlineUser[] }>({
    queryKey: ["/api/presence/online"],
    refetchInterval: 10000,
  });

  const { data: inbox, isLoading: inboxLoading } = useQuery<TransferIn[]>({
    queryKey: ["/api/transfers/inbox"],
    enabled: isAuthenticated && tab === 'inbox',
    refetchInterval: 5000,
  });

  const { data: sent, isLoading: sentLoading } = useQuery<TransferOut[]>({
    queryKey: ["/api/transfers/sent"],
    enabled: isAuthenticated && tab === 'sent',
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !selectedUser) throw new Error("Выберите файл и получателя");
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('toDiscordId', selectedUser.discordId);
      const res = await fetch('/api/transfers/send', { method: 'POST', body: form, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    },
    onMutate: () => {
      if (selectedUser && user) {
        setTransferAnim({
          fromUser: { username: user.username || '', avatar: user.avatar || '' },
          toUser: { username: selectedUser.username, avatar: selectedUser.avatar },
          fileName: selectedFile?.name || '',
        });
      }
    },
    onSuccess: () => {
      setTimeout(() => {
        toast({ title: t('fileTransfer.sent', 'Файл отправлен! ✨') });
        setSelectedFile(null);
        queryClient.invalidateQueries({ queryKey: ["/api/transfers/sent"] });
      }, 2500);
    },
    onError: (e: any) => {
      setTransferAnim(null);
      toast({ title: t('fileTransfer.error', 'Ошибка'), description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/transfers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transfers/sent"] });
      toast({ title: t('fileTransfer.deleted', 'Удалено') });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const filteredUsers = onlineUsers?.users?.filter(u =>
    u.discordId !== user?.discordId &&
    (searchQuery === '' || u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Send className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-2xl font-bold mb-2">{t('fileTransfer.title', 'Передача файлов')}</h2>
        <p className="text-muted-foreground mb-6">{t('fileTransfer.loginPrompt', 'Войдите через Discord для передачи файлов')}</p>
        <Button onClick={() => setLocation("/login")} size="lg">
          <LogIn className="w-5 h-5 mr-2" /> {t('fileTransfer.login', 'Войти')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Transfer animation overlay */}
      {transferAnim && (
        <TransferAnimation
          fromUser={transferAnim.fromUser}
          toUser={transferAnim.toUser}
          fileName={transferAnim.fileName}
          onDone={() => setTransferAnim(null)}
        />
      )}

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
          <Send className="w-8 h-8" />
          {t('fileTransfer.title', 'Передача файлов')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('fileTransfer.subtitle', 'Мгновенно отправляй файлы другим участникам клана')}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex justify-center gap-2 mb-6">
        {(['send', 'inbox', 'sent'] as const).map(tabKey => (
          <Button
            key={tabKey}
            variant={tab === tabKey ? "default" : "outline"}
            onClick={() => setTab(tabKey)}
            className={tab === tabKey ? 'bg-gradient-to-r from-purple-600 to-pink-600' : ''}
          >
            {tabKey === 'send' && <><Upload className="w-4 h-4 mr-2" /> {t('fileTransfer.tabSend', 'Отправить')}</>}
            {tabKey === 'inbox' && <><Download className="w-4 h-4 mr-2" /> {t('fileTransfer.tabInbox', 'Входящие')}{inbox && inbox.length > 0 && <Badge variant="destructive" className="ml-2 text-xs">{inbox.length}</Badge>}</>}
            {tabKey === 'sent' && <><Send className="w-4 h-4 mr-2" /> {t('fileTransfer.tabSent', 'Отправленные')}</>}
          </Button>
        ))}
      </div>

      {/* === SEND TAB === */}
      {tab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: User picker */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                {t('fileTransfer.chooseRecipient', 'Выберите получателя')}
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('fileTransfer.searchUser', 'Поиск...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto space-y-1.5 scrollbar-thin">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {t('fileTransfer.noUsers', 'Нет пользователей онлайн')}
                </p>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.discordId}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      selectedUser?.discordId === u.discordId
                        ? 'bg-purple-500/20 border border-purple-500/40 shadow-lg shadow-purple-500/10'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={u.avatar} />
                      <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium truncate">{u.username}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-green-400">{t('fileTransfer.online', 'Онлайн')}</span>
                      </div>
                    </div>
                    {selectedUser?.discordId === u.discordId && (
                      <Check className="w-5 h-5 text-purple-400" />
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Right: File upload */}
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="w-5 h-5" />
                  {t('fileTransfer.chooseFile', 'Выберите файл')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                    isDragging
                      ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
                      : selectedFile
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}
                  />

                  {selectedFile ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                        {getFileIcon(selectedFile.type)}
                      </div>
                      <div>
                        <p className="font-medium truncate max-w-[300px] mx-auto">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">{formatSize(selectedFile.size)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                        <X className="w-4 h-4 mr-1" /> {t('fileTransfer.removeFile', 'Убрать')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{t('fileTransfer.dropHere', 'Перетащите файл сюда')}</p>
                        <p className="text-sm text-muted-foreground">{t('fileTransfer.orClick', 'или нажмите для выбора')}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('fileTransfer.maxSize', 'До 500 MB • Любой формат')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Send button */}
            {selectedFile && selectedUser && (
              <Card className="glass-card border-purple-500/30 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback>{user?.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <ArrowRight className="w-4 h-4 text-purple-400" />
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={selectedUser.avatar} />
                      <AvatarFallback>{selectedUser.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground flex-1 truncate">
                      {selectedFile.name} ({formatSize(selectedFile.size)})
                    </span>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    size="lg"
                    disabled={sendMutation.isPending}
                    onClick={() => sendMutation.mutate()}
                  >
                    {sendMutation.isPending ? (
                      <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> {t('fileTransfer.sending', 'Отправка...')}</>
                    ) : (
                      <><Send className="w-5 h-5 mr-2" /> {t('fileTransfer.sendFile', 'Отправить файл')}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* === INBOX TAB === */}
      {tab === 'inbox' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              {t('fileTransfer.incomingFiles', 'Входящие файлы')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inboxLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)
            ) : !inbox || inbox.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t('fileTransfer.noIncoming', 'Нет входящих файлов')}
              </p>
            ) : (
              inbox.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={item.fromAvatar} />
                    <AvatarFallback>{item.fromUsername[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.fromUsername}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t('fileTransfer.toYou', 'вам')}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {getFileIcon(item.mimeType)}
                      <span className="text-sm truncate max-w-[200px]">{item.originalName}</span>
                      <span className="text-xs text-muted-foreground">({formatSize(item.size)})</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-cyan-600"
                      onClick={() => {
                        window.open(`/api/transfers/download/${item.id}`, '_blank');
                        queryClient.invalidateQueries({ queryKey: ["/api/transfers/inbox"] });
                      }}
                    >
                      <Download className="w-4 h-4 mr-1" /> {t('fileTransfer.download', 'Скачать')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* === SENT TAB === */}
      {tab === 'sent' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              {t('fileTransfer.sentFiles', 'Отправленные файлы')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sentLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)
            ) : !sent || sent.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t('fileTransfer.noSent', 'Нет отправленных файлов')}
              </p>
            ) : (
              sent.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    {getFileIcon(item.mimeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t('fileTransfer.to', 'Кому')}:</span>
                      <span className="font-medium">{item.toUsername}</span>
                      {item.downloaded && <Badge variant="secondary" className="text-xs">{t('fileTransfer.received', 'Получено')}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm truncate max-w-[200px]">{item.originalName}</span>
                      <span className="text-xs text-muted-foreground">({formatSize(item.size)})</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(item.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Users(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
