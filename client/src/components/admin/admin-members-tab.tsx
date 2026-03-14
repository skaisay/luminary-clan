import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, X, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClanMember } from "@shared/schema";

export default function AdminMembersTab() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ClanMember>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: members, isLoading } = useQuery<ClanMember[]>({
    queryKey: ["/api/members"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClanMember> }) => {
      const res = await apiRequest("PUT", `/api/admin/members/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan/stats"] });
      toast({ title: "Участник обновлен" });
      setEditingId(null);
      setEditData({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/members/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan/stats"] });
      toast({ title: "Участник удален" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<ClanMember>) => {
      const res = await apiRequest("POST", "/api/admin/members", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan/stats"] });
      toast({ title: "Участник добавлен" });
      setIsAddDialogOpen(false);
    },
  });

  const syncDiscordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/sync-discord-members", undefined);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clan/stats"] });
      toast({ 
        title: "Синхронизация завершена", 
        description: data.message 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Ошибка синхронизации", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleEdit = (member: ClanMember) => {
    setEditingId(member.id);
    setEditData({ ...member });
  };

  const handleSave = (id: string) => {
    const cleanData = {
      username: editData.username,
      role: editData.role,
      rank: Number(editData.rank) || 0,
      wins: Number(editData.wins) || 0,
      losses: Number(editData.losses) || 0,
      kills: Number(editData.kills) || 0,
      deaths: Number(editData.deaths) || 0,
      assists: Number(editData.assists) || 0,
      lumiCoins: Number(editData.lumiCoins) || 0,
      discordId: editData.discordId || null,
      avatar: editData.avatar || null,
    };
    updateMutation.mutate({ id, data: cleanData });
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены что хотите удалить этого участника?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl neon-text-cyan">Управление Участниками</CardTitle>
            <CardDescription>
              Редактирование, добавление и удаление участников клана
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => syncDiscordMutation.mutate()}
              disabled={syncDiscordMutation.isPending}
              data-testid="button-sync-discord"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncDiscordMutation.isPending ? 'animate-spin' : ''}`} />
              {syncDiscordMutation.isPending ? "Синхронизация..." : "Синхронизировать с Discord"}
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-member">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Добавить участника</DialogTitle>
                  <DialogDescription>Заполните данные нового участника клана</DialogDescription>
                </DialogHeader>
                <AddMemberForm onSubmit={(data) => addMutation.mutate(data)} isPending={addMutation.isPending} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Рейтинг</TableHead>
                <TableHead>Победы</TableHead>
                <TableHead>Поражения</TableHead>
                <TableHead>LumiCoin</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => (
                <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                  <TableCell>
                    {editingId === member.id ? (
                      <Input
                        value={editData.username || ""}
                        onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                        className="h-8"
                      />
                    ) : (
                      member.username
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <Input
                        value={editData.role || ""}
                        onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                        className="h-8"
                      />
                    ) : (
                      member.role
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <Input
                        type="number"
                        value={editData.rank || 0}
                        onChange={(e) => setEditData({ ...editData, rank: parseInt(e.target.value) })}
                        className="h-8"
                      />
                    ) : (
                      member.rank
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <Input
                        type="number"
                        value={editData.wins || 0}
                        onChange={(e) => setEditData({ ...editData, wins: parseInt(e.target.value) })}
                        className="h-8"
                      />
                    ) : (
                      member.wins
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <Input
                        type="number"
                        value={editData.losses || 0}
                        onChange={(e) => setEditData({ ...editData, losses: parseInt(e.target.value) })}
                        className="h-8"
                      />
                    ) : (
                      member.losses
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <Input
                        type="number"
                        value={editData.lumiCoins || 0}
                        onChange={(e) => setEditData({ ...editData, lumiCoins: parseInt(e.target.value) })}
                        className="h-8"
                      />
                    ) : (
                      member.lumiCoins ?? 0
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === member.id ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => handleSave(member.id)} data-testid={`button-save-${member.id}`}>
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(member)} data-testid={`button-edit-${member.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(member.id)} data-testid={`button-delete-${member.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AddMemberForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [formData, setFormData] = useState({
    username: "",
    discordId: "",
    role: "Member",
    rank: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    lumiCoins: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Имя *</Label>
          <Input
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            data-testid="input-new-username"
          />
        </div>
        <div>
          <Label>Discord ID</Label>
          <Input
            value={formData.discordId}
            onChange={(e) => setFormData({ ...formData, discordId: e.target.value })}
            data-testid="input-new-discord-id"
          />
        </div>
        <div>
          <Label>Роль</Label>
          <Input
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            data-testid="input-new-role"
          />
        </div>
        <div>
          <Label>Рейтинг</Label>
          <Input
            type="number"
            value={formData.rank}
            onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Победы</Label>
          <Input
            type="number"
            value={formData.wins}
            onChange={(e) => setFormData({ ...formData, wins: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Поражения</Label>
          <Input
            type="number"
            value={formData.losses}
            onChange={(e) => setFormData({ ...formData, losses: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Убийства</Label>
          <Input
            type="number"
            value={formData.kills}
            onChange={(e) => setFormData({ ...formData, kills: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Смерти</Label>
          <Input
            type="number"
            value={formData.deaths}
            onChange={(e) => setFormData({ ...formData, deaths: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Ассисты</Label>
          <Input
            type="number"
            value={formData.assists}
            onChange={(e) => setFormData({ ...formData, assists: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>LumiCoin</Label>
          <Input
            type="number"
            value={formData.lumiCoins}
            onChange={(e) => setFormData({ ...formData, lumiCoins: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-member">
        {isPending ? "Добавление..." : "Добавить участника"}
      </Button>
    </form>
  );
}
