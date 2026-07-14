import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/utils/format";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserPlus, Edit, Trash2, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { permissionProfilesApi } from "@/api/permissionProfiles.api";
import { managerPermissionsApi } from "@/api/managerPermissions.api";
import type { PermissionsMap, PermissionProfile } from "@/types/permissions";
import { MODULES } from "@/types/permissions";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const ACTION_KEYS = ["read", "create", "update", "delete"] as const;

const getRoleColor = (role: string) => {
  switch (role) {
    case "ADMIN": return "bg-red-100 text-red-800";
    case "MANAGER": return "bg-blue-100 text-blue-800";
    case "CLIENT": return "bg-green-100 text-green-800";
    case "FREELANCER": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

// ─── Manager Permissions Panel ──────────────────────────────────────────────

function ManagerPermissionsPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["permission-profiles"],
    queryFn: () => permissionProfilesApi.getAll(),
    staleTime: 60_000,
  });

  const { data: managerPerm, isLoading } = useQuery({
    queryKey: ["manager-permissions", userId],
    queryFn: () => managerPermissionsApi.getByUserId(userId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { profileId?: string | null; overrides?: Partial<PermissionsMap> }) =>
      managerPermissionsApi.update(userId, data),
    onSuccess: () => {
      toast.success(t("permissions.updateSuccess"));
      void qc.invalidateQueries({ queryKey: ["manager-permissions", userId] });
    },
    onError: () => toast.error(t("permissions.updateError")),
  });

  // Build the effective overrides state from current managerPerm
  const currentOverrides = useMemo(() => {
    const base: Partial<PermissionsMap> = {};
    const saved = managerPerm?.overrides as Partial<PermissionsMap> | undefined;
    for (const mod of MODULES) {
      if (saved?.[mod]) {
        const defaults = { read: false, create: false, update: false, delete: false };
        base[mod] = Object.assign(defaults, saved[mod]);
      }
    }
    return base;
  }, [managerPerm]);

  const [overridesDraft, setOverridesDraft] = useState<Partial<PermissionsMap> | null>(null);
  const overrides = overridesDraft ?? currentOverrides;

  const handleProfileChange = (profileId: string) => {
    updateMutation.mutate({ profileId: profileId === "__none__" ? null : profileId, overrides: overrides as any });
  };

  const toggleOverride = (mod: (typeof MODULES)[number], action: keyof PermissionsMap[typeof mod]) => {
    const current = overrides[mod] ?? { read: false, create: false, update: false, delete: false };
    const next = { ...overrides, [mod]: { ...current, [action]: !current[action] } };
    setOverridesDraft(next as Partial<PermissionsMap>);
  };

  const handleSaveOverrides = () => {
    updateMutation.mutate({
      profileId: managerPerm?.profileId ?? null,
      overrides: overrides as any,
    });
    setOverridesDraft(null);
  };

  const selectedProfileId = managerPerm?.profileId ?? "__none__";
  const hasDraft = overridesDraft !== null;

  // Compute which cells differ from the profile permissions (to show "Personnalisé" badge)
  const profilePermissions = useMemo(() => {
    const p = profiles.find((pr) => pr.id === selectedProfileId);
    return p?.permissions as PermissionsMap | undefined;
  }, [profiles, selectedProfileId]);

  const isCustomized = useCallback(
    (mod: (typeof MODULES)[number], action: keyof PermissionsMap[typeof mod]) => {
      const ov = overrides[mod];
      if (!ov) return false;
      const profileVal = profilePermissions?.[mod]?.[action];
      const overrideVal = (ov as Record<string, boolean>)[action as string];
      return overrideVal !== undefined && overrideVal !== profileVal;
    },
    [overrides, profilePermissions]
  );

  if (isLoading) {
    return <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 pt-3">
      {/* Profile selector */}
      <div className="flex items-center gap-3">
        <Label className="w-32 shrink-0 text-sm font-medium">Profil de base</Label>
        <Select value={selectedProfileId} onValueChange={handleProfileChange} disabled={updateMutation.isPending}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Aucun profil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Aucun profil</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.description && <span className="text-muted-foreground ml-1 text-xs">: {p.description}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Overrides grid */}
      <div>
        <p className="text-sm font-medium mb-2">
          Ajustements individuels
          {hasDraft && <span className="ml-2 text-xs text-amber-600 font-normal">• modifications non sauvegardées</span>}
        </p>
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-36">Module</TableHead>
                {ACTION_KEYS.map((k) => (
                  <TableHead key={k} className="text-center w-24">{t(`permissions.actions.${k}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULES.map((mod) => {
                const modOverride = overrides[mod] ?? { read: false, create: false, update: false, delete: false };
                return (
                  <TableRow key={mod}>
                    <TableCell className="font-medium text-sm">{t(`permissions.modules.${mod}`, mod)}</TableCell>
                    {ACTION_KEYS.map((action) => {
                      const checked = !!(modOverride as Record<string, boolean>)[action];
                      const customized = isCustomized(mod, action as any);
                      return (
                        <TableCell key={action} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleOverride(mod, action as any)}
                            />
                            {customized && (
                              <span className="text-[10px] font-medium text-amber-600">custom</span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {hasDraft && (
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setOverridesDraft(null)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSaveOverrides} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Sauvegarder
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Manager Dialog ─────────────────────────────────────────────────

function ProfilesManagerDialog() {
  const [open, setOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const qc = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["permission-profiles"],
    queryFn: () => permissionProfilesApi.getAll(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      permissionProfilesApi.create({
        name: createName,
        description: createDesc || undefined,
        permissions: Object.fromEntries(
          MODULES.map((m) => [m, { read: false, create: false, update: false, delete: false }])
        ) as any,
      }),
    onSuccess: () => {
      toast.success("Profil créé");
      setCreateName("");
      setCreateDesc("");
      void qc.invalidateQueries({ queryKey: ["permission-profiles"] });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => permissionProfilesApi.delete(id),
    onSuccess: () => {
      toast.success("Profil supprimé");
      void qc.invalidateQueries({ queryKey: ["permission-profiles"] });
    },
    onError: () => toast.error("Impossible de supprimer ce profil (utilisé par des managers?)"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Gérer les profils</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Profils de permissions</DialogTitle>
          <DialogDescription>Créez et gérez les profils de permissions pour les Managers.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Nouveau profil</p>
            <Input placeholder="Nom du profil" value={createName} onChange={(e) => setCreateName(e.target.value)} />
            <Input placeholder="Description (optionnel)" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} />
            <Button
              size="sm"
              disabled={!createName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Créer
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const SettingsUsersTab = memo(function SettingsUsersTab({
  currentUserId,
  users,
  loadingUsers,
  invitingUser,
  updatingUser,
  deletingUser,
  inviteUser,
  updateUser,
  deleteUser,
  permissions,
}: {
  currentUserId: string;
  users?: AppUser[];
  loadingUsers: boolean;
  invitingUser: boolean;
  updatingUser: boolean;
  deletingUser: boolean;
  inviteUser(input: { name: string; email: string; role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER" }): void;
  updateUser(input: { id: string; data: { name: string; role: string } }): void;
  deleteUser(id: string): void;
  permissions?: Record<string, string[]>;
}) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "MANAGER" as const });
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [expandedPermissions, setExpandedPermissions] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return users?.filter((u) => u.role === "ADMIN" || u.role === "MANAGER") ?? [];
  }, [users]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const handleInviteSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      inviteUser(inviteForm);
      setInviteDialogOpen(false);
      setInviteForm({ name: "", email: "", role: "MANAGER" });
    },
    [inviteForm, inviteUser]
  );

  const handleEditSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      updateUser({ id: editingUser.id, data: { name: editingUser.name, role: editingUser.role } });
      setEditingUser(null);
    },
    [editingUser, updateUser]
  );

  const canDelete = useCallback((id: string) => id !== currentUserId, [currentUserId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Utilisateurs</h2>
        <div className="flex items-center gap-2">
          <ProfilesManagerDialog />
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Inviter un utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inviter un utilisateur</DialogTitle>
                <DialogDescription>Envoyer une invitation à un nouvel utilisateur</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="invite-name">Nom</Label>
                  <Input
                    id="invite-name"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="invite-role">Rôle</Label>
                  <Select value={inviteForm.role} onValueChange={(val) => setInviteForm((s) => ({ ...s, role: val as any }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setInviteDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={invitingUser}>
                    {invitingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Envoyer l'invitation
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div ref={parentRef} className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <tr>
                    <td colSpan={5} style={{ height: `${totalSize}px`, position: "relative" }} />
                  </tr>
                  {virtualItems.map((v) => {
                    const u = filteredUsers[v.index];
                    if (!u) return null;
                    const isPermExpanded = expandedPermissions === u.id;
                    return (
                        <TableRow
                          key={u.id}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${v.start}px)`,
                          }}
                        >
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <Badge className={getRoleColor(u.role)}>{u.role}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(u.createdAt)}</TableCell>
                          <TableCell className="text-right flex justify-end gap-1">
                            {u.role === "MANAGER" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Configurer les permissions"
                                onClick={() => setExpandedPermissions(isPermExpanded ? null : u.id)}
                              >
                                <ShieldCheck className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            <Dialog
                              open={editingUser?.id === u.id}
                              onOpenChange={(open) => setEditingUser(open ? { id: u.id, name: u.name, role: u.role } : null)}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Modifier l'utilisateur</DialogTitle>
                                </DialogHeader>
                                {editingUser?.id === u.id && (
                                  <form onSubmit={handleEditSubmit} className="space-y-4">
                                    <div>
                                      <Label htmlFor="edit-name">Nom</Label>
                                      <Input
                                        id="edit-name"
                                        value={editingUser.name}
                                        onChange={(e) => setEditingUser((s) => s ? { ...s, name: e.target.value } : s)}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-role">Rôle</Label>
                                      <Select
                                        value={editingUser.role}
                                        onValueChange={(val) => setEditingUser((s) => s ? { ...s, role: val } : s)}
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ADMIN">Admin</SelectItem>
                                          <SelectItem value="MANAGER">Manager</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" type="button" onClick={() => setEditingUser(null)}>Annuler</Button>
                                      <Button type="submit" disabled={updatingUser}>
                                        {updatingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Sauvegarder
                                      </Button>
                                    </DialogFooter>
                                  </form>
                                )}
                              </DialogContent>
                            </Dialog>

                            {canDelete(u.id) && (
                              <Dialog open={deleteDialogOpen === u.id} onOpenChange={(open) => setDeleteDialogOpen(open ? u.id : null)}>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Supprimer l'utilisateur</DialogTitle>
                                    <DialogDescription>Êtes-vous sûr de vouloir supprimer cet utilisateur ?</DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="outline" type="button" onClick={() => setDeleteDialogOpen(null)}>Annuler</Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => { deleteUser(u.id); setDeleteDialogOpen(null); }}
                                      disabled={deletingUser}
                                    >
                                      {deletingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                      Supprimer
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline permissions panel : rendered outside the virtualized table */}
      {expandedPermissions && (() => {
        const u = filteredUsers.find((u) => u.id === expandedPermissions);
        if (!u || u.role !== "MANAGER") return null;
        return (
          <Card key={`perms-${u.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                    Permissions : {u.name}
                  </CardTitle>
                  <CardDescription>Profil de base + ajustements individuels pour ce Manager</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setExpandedPermissions(null)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ManagerPermissionsPanel userId={u.id} />
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
});
