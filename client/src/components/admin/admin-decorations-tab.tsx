import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Plus, Trash2, Edit2, Gift, Crown, Star, Palette, Frame, Wand2, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProfileDecoration {
  id: string;
  name: string;
  description: string;
  type: string;
  emoji: string | null;
  imageUrl: string | null;
  cssEffect: string | null;
  color: string | null;
  rarity: string;
  price: number;
  category: string;
  isAvailable: boolean;
  maxOwners: number;
  currentOwners: number;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  badge: "🏅 Значок",
  avatar_frame: "🖼️ Рамка аватара",
  profile_effect: "✨ Эффект профиля",
  banner: "🎨 Баннер",
  name_color: "🌈 Цвет ника",
  name_emoji: "💎 Эмодзи ника",
};

const rarityColors: Record<string, string> = {
  common: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  uncommon: "bg-green-500/20 text-green-300 border-green-500/30",
  rare: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  legendary: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const rarityLabels: Record<string, string> = {
  common: "Обычная",
  uncommon: "Необычная",
  rare: "Редкая",
  epic: "Эпическая",
  legendary: "Легендарная",
};

const categoryLabels: Record<string, string> = {
  general: "Основные",
  seasonal: "Сезонные",
  limited: "Лимитированные",
  exclusive: "Эксклюзивные",
};

// Предустановленные декорации-эмодзи для быстрого добавления
const presetDecorations = [
  { emoji: "⚡", name: "Молния", type: "name_emoji" },
  { emoji: "🔥", name: "Пламя", type: "name_emoji" },
  { emoji: "💎", name: "Алмаз", type: "name_emoji" },
  { emoji: "👑", name: "Корона", type: "name_emoji" },
  { emoji: "🌟", name: "Суперзвезда", type: "name_emoji" },
  { emoji: "🎭", name: "Маска", type: "name_emoji" },
  { emoji: "🦋", name: "Бабочка", type: "name_emoji" },
  { emoji: "🌸", name: "Сакура", type: "name_emoji" },
  { emoji: "❄️", name: "Снежинка", type: "name_emoji" },
  { emoji: "🔮", name: "Кристалл", type: "name_emoji" },
  { emoji: "🎪", name: "Цирк", type: "name_emoji" },
  { emoji: "🦊", name: "Лисёнок", type: "name_emoji" },
  { emoji: "🐉", name: "Дракон", type: "name_emoji" },
  { emoji: "🌙", name: "Лунный", type: "name_emoji" },
  { emoji: "☀️", name: "Солнечный", type: "name_emoji" },
  { emoji: "🎸", name: "Рок-звезда", type: "name_emoji" },
  { emoji: "🏆", name: "Чемпион", type: "name_emoji" },
  { emoji: "💜", name: "Пурпурное сердце", type: "name_emoji" },
  { emoji: "🌀", name: "Спираль", type: "name_emoji" },
  { emoji: "✦", name: "Блеск", type: "name_emoji" },
];

const defaultForm = {
  name: "",
  description: "",
  type: "badge",
  emoji: "",
  imageUrl: "",
  cssEffect: "",
  color: "#a855f7",
  rarity: "common",
  price: 100,
  category: "general",
  isAvailable: true,
  maxOwners: -1,
};

export default function AdminDecorationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDecorationId, setAssignDecorationId] = useState<string>("");
  const [assignDiscordId, setAssignDiscordId] = useState("");
  const [form, setForm] = useState(defaultForm);

  const { data: decorations = [], isLoading } = useQuery<ProfileDecoration[]>({
    queryKey: ["/api/admin/decorations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof defaultForm) => {
      const res = await apiRequest("POST", "/api/admin/decorations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/decorations"] });
      setCreateOpen(false);
      setForm(defaultForm);
      toast({ title: "Декорация создана", description: "Новая декорация добавлена в каталог" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof defaultForm> }) => {
      const res = await apiRequest("PATCH", `/api/admin/decorations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/decorations"] });
      setEditId(null);
      setForm(defaultForm);
      toast({ title: "Декорация обновлена" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/decorations/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/decorations"] });
      toast({ title: "Декорация удалена" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { decorationId: string; discordId: string }) => {
      const res = await apiRequest("POST", "/api/admin/decorations/assign", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/decorations"] });
      setAssignOpen(false);
      setAssignDiscordId("");
      toast({ title: "Декорация выдана участнику" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка выдачи", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    createMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (editId) updateMutation.mutate({ id: editId, data: form });
  };

  const startEdit = (decoration: ProfileDecoration) => {
    setEditId(decoration.id);
    setForm({
      name: decoration.name,
      description: decoration.description,
      type: decoration.type,
      emoji: decoration.emoji || "",
      imageUrl: decoration.imageUrl || "",
      cssEffect: decoration.cssEffect || "",
      color: decoration.color || "#a855f7",
      rarity: decoration.rarity,
      price: decoration.price,
      category: decoration.category,
      isAvailable: decoration.isAvailable,
      maxOwners: decoration.maxOwners,
    });
    setCreateOpen(true);
  };

  const addPreset = (preset: typeof presetDecorations[0]) => {
    setForm({
      ...defaultForm,
      name: preset.name,
      description: `Декорация ${preset.emoji} для отображения рядом с ником`,
      type: preset.type,
      emoji: preset.emoji,
      rarity: "common",
      price: 50,
    });
    setCreateOpen(true);
  };

  const toggleAvailability = (decoration: ProfileDecoration) => {
    updateMutation.mutate({ id: decoration.id, data: { isAvailable: !decoration.isAvailable } });
  };

  const DecorationForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Название</Label>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Молния"
          />
        </div>
        <div className="space-y-2">
          <Label>Тип</Label>
          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Описание</Label>
        <Textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Крутая декорация для профиля"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Эмодзи / Символ</Label>
          <Input
            value={form.emoji}
            onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
            placeholder="⚡"
          />
        </div>
        <div className="space-y-2">
          <Label>Цвет</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="w-12 h-10 p-1"
            />
            <Input
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              placeholder="#a855f7"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Цена (LC)</Label>
          <Input
            type="number"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Редкость</Label>
          <Select value={form.rarity} onValueChange={v => setForm(f => ({ ...f, rarity: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(rarityLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Категория</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Макс. владельцев (-1 = ∞)</Label>
          <Input
            type="number"
            value={form.maxOwners}
            onChange={e => setForm(f => ({ ...f, maxOwners: parseInt(e.target.value) || -1 }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>URL изображения (опционально)</Label>
        <Input
          value={form.imageUrl}
          onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label>CSS эффект (опционально)</Label>
        <Input
          value={form.cssEffect}
          onChange={e => setForm(f => ({ ...f, cssEffect: e.target.value }))}
          placeholder="animation: glow 2s infinite; text-shadow: 0 0 10px #a855f7;"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={form.isAvailable}
          onCheckedChange={v => setForm(f => ({ ...f, isAvailable: v }))}
        />
        <Label>Доступна для покупки</Label>
      </div>
    </div>
  );

  return (
    <Card className="glass glass-border border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              Декорации профиля
            </CardTitle>
            <CardDescription>
              Значки, рамки, эффекты и эмодзи для отображения рядом с никнеймом участников
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) { setEditId(null); setForm(defaultForm); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Создать
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Редактировать декорацию" : "Создать декорацию"}</DialogTitle>
                <DialogDescription>
                  {editId ? "Измените параметры декорации" : "Добавьте новую декорацию профиля в каталог"}
                </DialogDescription>
              </DialogHeader>
              <DecorationForm />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateOpen(false); setEditId(null); setForm(defaultForm); }}>
                  Отмена
                </Button>
                <Button onClick={editId ? handleUpdate : handleCreate} disabled={!form.name || !form.description}>
                  {editId ? "Сохранить" : "Создать"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Быстрые пресеты */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Быстрое добавление — эмодзи для ника
          </h3>
          <div className="flex flex-wrap gap-2">
            {presetDecorations.map(preset => (
              <Button
                key={preset.emoji}
                variant="outline"
                size="sm"
                className="gap-1 text-lg hover:scale-110 transition-transform"
                onClick={() => addPreset(preset)}
              >
                {preset.emoji}
                <span className="text-xs">{preset.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Список декораций */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : decorations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Нет декораций. Создайте первую!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {decorations.map(decoration => (
              <div
                key={decoration.id}
                className={`p-4 rounded-xl border transition-all hover:border-primary/30 ${
                  decoration.isAvailable ? "bg-card/50" : "bg-card/20 opacity-60"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl border border-border/50 shrink-0"
                    style={{
                      background: decoration.color ? `${decoration.color}20` : "rgba(168,85,247,0.1)",
                      borderColor: decoration.color ? `${decoration.color}40` : undefined,
                    }}
                  >
                    {decoration.emoji || (
                      decoration.type === "badge" ? <BadgeCheck className="w-6 h-6" /> :
                      decoration.type === "avatar_frame" ? <Frame className="w-6 h-6" /> :
                      decoration.type === "profile_effect" ? <Sparkles className="w-6 h-6" /> :
                      decoration.type === "name_color" ? <Palette className="w-6 h-6" /> :
                      <Star className="w-6 h-6" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{decoration.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${rarityColors[decoration.rarity] || ""}`}>
                        {rarityLabels[decoration.rarity]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {typeLabels[decoration.type] || decoration.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{decoration.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>💰 {decoration.price} LC</span>
                      <span>👥 {decoration.currentOwners}{decoration.maxOwners > 0 ? `/${decoration.maxOwners}` : ""}</span>
                      <span>{categoryLabels[decoration.category]}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAssignDecorationId(decoration.id);
                        setAssignOpen(true);
                      }}
                      title="Выдать участнику"
                    >
                      <Gift className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(decoration)}
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAvailability(decoration)}
                      title={decoration.isAvailable ? "Скрыть" : "Показать"}
                    >
                      {decoration.isAvailable ? "🟢" : "🔴"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Удалить декорацию "${decoration.name}"?`)) {
                          deleteMutation.mutate(decoration.id);
                        }
                      }}
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assign dialog */}
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Выдать декорацию
              </DialogTitle>
              <DialogDescription>
                Введите Discord ID участника, которому хотите выдать декорацию
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Discord ID участника</Label>
                <Input
                  value={assignDiscordId}
                  onChange={e => setAssignDiscordId(e.target.value)}
                  placeholder="123456789012345678"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => assignMutation.mutate({ decorationId: assignDecorationId, discordId: assignDiscordId })}
                disabled={!assignDiscordId}
              >
                Выдать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
