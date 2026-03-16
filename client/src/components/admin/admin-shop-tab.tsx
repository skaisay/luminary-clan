import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Coins, Store, Download, Sparkles } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import type { ShopItem } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DiscordRole {
  id: string;
  name: string;
  color: string | null;
  position: number;
  permissions: string[];
  mentionable: boolean;
  hoist: boolean;
}

export function AdminShopTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShopItem | null>(null);
  const [isRoleSelectOpen, setIsRoleSelectOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    itemType: "role",
    rarity: "common",
    roleCategory: "beautiful",
    discordRoleId: "",
    roleColor: "",
    roleIcon: "",
    imageUrl: "",
    stock: -1,
    isAvailable: true,
  });

  const { data: items, isLoading } = useQuery<ShopItem[]>({
    queryKey: ["/api/admin/shop/items"],
  });

  const { data: discordRoles, isLoading: isLoadingRoles } = useQuery<DiscordRole[]>({
    queryKey: ["/api/admin/discord/roles"],
    enabled: isRoleSelectOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/shop/items", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Предмет создан успешно" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка создания",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/shop/items/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Предмет обновлен успешно" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
      setEditItem(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка обновления",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/shop/items/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Предмет удален успешно" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка удаления",
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      itemType: "role",
      rarity: "common",
      roleCategory: "beautiful",
      discordRoleId: "",
      roleColor: "",
      roleIcon: "",
      imageUrl: "",
      stock: -1,
      isAvailable: true,
    });
  };

  const handleSelectDiscordRole = (role: DiscordRole) => {
    const hasAdminPerms = role.permissions.includes('Administrator') || 
                          role.permissions.includes('ManageGuild') ||
                          role.permissions.includes('ManageRoles');
    
    setFormData({
      ...formData,
      name: role.name,
      description: hasAdminPerms 
        ? `Роль с привилегиями: ${role.name}` 
        : `Декоративная роль: ${role.name}`,
      roleCategory: hasAdminPerms ? "premium" : "decorative",
      discordRoleId: role.id,
      roleColor: role.color || "",
      price: hasAdminPerms ? 5000 : 1000,
    });
    setIsRoleSelectOpen(false);
    toast({
      title: "Роль загружена",
      description: `Информация о роли "${role.name}" загружена из Discord`,
    });
  };

  const handleEdit = (item: ShopItem) => {
    setEditItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price,
      itemType: item.itemType,
      rarity: item.rarity || "common",
      roleCategory: item.roleCategory || "beautiful",
      discordRoleId: item.discordRoleId || "",
      roleColor: item.roleColor || "",
      roleIcon: item.roleIcon || "",
      imageUrl: item.imageUrl || "",
      stock: item.stock || -1,
      isAvailable: item.isAvailable,
    });
  };

  const handleSubmit = () => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены, что хотите удалить этот предмет?")) {
      deleteMutation.mutate(id);
    }
  };

  const importRolesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/shop/import-roles");
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.imported > 0) {
        toast({ 
          title: "Роли импортированы!", 
          description: `Импортировано ${data.imported} ролей из Discord сервера` 
        });
      } else {
        toast({ 
          title: "Импорт завершен", 
          description: "Новых ролей не найдено. Все доступные роли уже добавлены в магазин." 
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/roles"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка импорта",
        description: error.message,
      });
    },
  });

  const createTestRolesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/discord/create-test-roles");
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Тестовые роли созданы!", 
        description: data.message || `Создано ${data.created} красивых ролей в Discord` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discord/roles"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка создания ролей",
        description: error.message,
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="glass glass-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-6 w-6" />
                Управление магазином
              </CardTitle>
              <CardDescription>Добавляйте и редактируйте предметы в магазине LumiCoin</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={() => createTestRolesMutation.mutate()}
                disabled={createTestRolesMutation.isPending}
                data-testid="button-create-test-roles"
              >
                <Sparkles className="h-4 w-4" />
                {createTestRolesMutation.isPending ? "Создание..." : "Создать тестовые роли"}
              </Button>
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={() => importRolesMutation.mutate()}
                disabled={importRolesMutation.isPending}
                data-testid="button-import-roles"
              >
                <Download className="h-4 w-4" />
                {importRolesMutation.isPending ? "Импорт..." : "Импорт ролей из Discord"}
              </Button>
              <Dialog open={isCreateOpen || !!editItem} onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) {
                  setEditItem(null);
                  resetForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-create-shop-item">
                    <Plus className="h-4 w-4" />
                    Добавить предмет
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass glass-border">
                <DialogHeader>
                  <DialogTitle>{editItem ? "Редактировать предмет" : "Создать новый предмет"}</DialogTitle>
                  <DialogDescription>
                    Заполните информацию о предмете для магазина
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {!editItem && formData.itemType === "role" && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setIsRoleSelectOpen(true)}
                      data-testid="button-load-discord-role"
                    >
                      <SiDiscord className="h-5 w-5" />
                      Загрузить роль из Discord
                    </Button>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Название</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="VIP Роль"
                      data-testid="input-item-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Уникальная VIP роль с особыми привилегиями"
                      rows={3}
                      data-testid="input-item-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Цена (LumiCoin)</Label>
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        <Input
                          id="price"
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                          data-testid="input-item-price"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="stock">Запас (-1 = бесконечно)</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || -1 })}
                        data-testid="input-item-stock"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="itemType">Тип предмета</Label>
                    <Select value={formData.itemType} onValueChange={(value) => setFormData({ ...formData, itemType: value })}>
                      <SelectTrigger data-testid="select-item-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">Роль</SelectItem>
                        <SelectItem value="item">Предмет</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rarity">Редкость</Label>
                    <Select value={formData.rarity} onValueChange={(value) => setFormData({ ...formData, rarity: value })}>
                      <SelectTrigger data-testid="select-item-rarity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legendary">✨ Legendary (легендарный)</SelectItem>
                        <SelectItem value="epic">💎 Epic (эпический)</SelectItem>
                        <SelectItem value="rare">⭐ Rare (редкий)</SelectItem>
                        <SelectItem value="uncommon">🌟 Uncommon (необычный)</SelectItem>
                        <SelectItem value="common">Common (обычный)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imageUrl">URL изображения</Label>
                    <Input
                      id="imageUrl"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://example.com/image.png"
                      data-testid="input-item-image"
                    />
                  </div>
                  {formData.itemType === "role" && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="roleCategory">Категория роли</Label>
                        <Select value={formData.roleCategory} onValueChange={(value) => setFormData({ ...formData, roleCategory: value })}>
                          <SelectTrigger data-testid="select-role-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="legendary">✨ Legendary (самая редкая)</SelectItem>
                            <SelectItem value="unique">💎 Unique (очень редкая)</SelectItem>
                            <SelectItem value="rare">⭐ Rare (редкая)</SelectItem>
                            <SelectItem value="beautiful">🎨 Beautiful (красивая)</SelectItem>
                            <SelectItem value="common">Common (обычная)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="roleColor">Цвет роли (HEX)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="roleColor"
                            value={formData.roleColor}
                            onChange={(e) => setFormData({ ...formData, roleColor: e.target.value })}
                            placeholder="#FFD700"
                            data-testid="input-role-color"
                          />
                          {formData.roleColor && (
                            <div 
                              className="w-12 h-10 rounded border glass-border"
                              style={{ backgroundColor: formData.roleColor }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="roleIcon">Иконка роли (URL)</Label>
                        <Input
                          id="roleIcon"
                          value={formData.roleIcon}
                          onChange={(e) => setFormData({ ...formData, roleIcon: e.target.value })}
                          placeholder="https://example.com/icon.png"
                          data-testid="input-role-icon"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isAvailable"
                      checked={formData.isAvailable}
                      onCheckedChange={(checked) => setFormData({ ...formData, isAvailable: checked })}
                      data-testid="switch-item-available"
                    />
                    <Label htmlFor="isAvailable">Активен</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsCreateOpen(false);
                    setEditItem(null);
                    resetForm();
                  }}>
                    Отмена
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-shop-item"
                  >
                    {editItem ? "Сохранить" : "Создать"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : items && items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Запас</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const safeName = item.name.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_');
                  return (
                  <TableRow key={item.id} data-testid={`row-shop-item-${item.id}`} data-ai={`shop-row-${safeName}`}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.itemType === "role" ? "Роль" : "Предмет"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Coins className="h-4 w-4 text-primary" />
                        {item.price}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.stock === -1 ? "∞" : item.stock}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isAvailable ? "default" : "outline"}>
                        {item.isAvailable ? "Активен" : "Неактивен"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-${item.id}`}
                          data-ai={`edit-${safeName}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          data-testid={`button-delete-${item.id}`}
                          data-ai={`delete-${safeName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Нет предметов в магазине. Создайте первый!
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRoleSelectOpen} onOpenChange={setIsRoleSelectOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto glass glass-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiDiscord className="h-6 w-6" />
              Выберите роль из Discord
            </DialogTitle>
            <DialogDescription>
              Выберите роль с вашего Discord сервера для добавления в магазин
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingRoles ? (
              <div className="text-center py-8">Загрузка ролей...</div>
            ) : discordRoles && discordRoles.length > 0 ? (
              <div className="grid gap-2">
                {discordRoles.map((role) => {
                  const hasAdminPerms = role.permissions.includes('Administrator') || 
                                       role.permissions.includes('ManageGuild') ||
                                       role.permissions.includes('ManageRoles');
                  return (
                    <Card
                      key={role.id}
                      className="glass glass-border hover-elevate cursor-pointer transition-all"
                      onClick={() => handleSelectDiscordRole(role)}
                      data-testid={`card-discord-role-${role.id}`}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            {role.color && (
                              <div 
                                className="w-4 h-4 rounded-full border glass-border"
                                style={{ backgroundColor: role.color }}
                              />
                            )}
                            <div>
                              <CardTitle className="text-base">{role.name}</CardTitle>
                              <CardDescription className="text-xs">
                                Позиция: {role.position}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {hasAdminPerms && (
                              <Badge variant="default" className="bg-red-500/20 text-red-400 border-red-500/30">
                                С привилегиями
                              </Badge>
                            )}
                            {role.hoist && (
                              <Badge variant="secondary">Отдельно</Badge>
                            )}
                            {role.mentionable && (
                              <Badge variant="outline">Упоминаемая</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Роли не найдены
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
