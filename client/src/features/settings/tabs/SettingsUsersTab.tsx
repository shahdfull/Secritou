import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/utils/format";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, UserPlus, Edit, Trash2, ShieldCheck, ChevronUp, Search, Settings2, Info } from "lucide-react";
import { toast } from "sonner";
import { permissionProfilesApi } from "@/api/permissionProfiles.api";
import { managerPermissionsApi } from "@/api/managerPermissions.api";
import type { PermissionsMap, PermissionProfile } from "@/types/permissions";
import { MODULES } from "@/types/permissions";
import { PermissionsGrid } from "../PermissionsGrid";
import { getServerErrorMessage, getServerRequestId } from "@/utils/apiError";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER";
  createdAt: string;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
  connectedTimeAverages?: { today: number; weekly: number; monthly: number };
};

// Formats a seconds duration as "Xh Ymin" (or "—" for zero/undefined), for the
// connected-time average columns.
function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
}

const EMPTY_PERMISSIONS = Object.fromEntries(
  MODULES.map((m) => [m, { read: false, create: false, update: false, delete: false }])
) as PermissionsMap;

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
    onError: (error) => {
      const message = getServerErrorMessage(error) ?? t("permissions.updateError");
      const requestId = getServerRequestId(error);
      toast.error(requestId ? `${message} (ref. ${requestId})` : message);
    },
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
    updateMutation.mutate({ profileId: profileId === "__none__" ? null : profileId, overrides });
  };

  const toggleOverride = (mod: (typeof MODULES)[number], action: keyof PermissionsMap[typeof mod]) => {
    // Flip relative to what's effectively shown (profile grant + any existing
    // override merged on top), not relative to overrides[mod] alone —
    // otherwise unchecking a box that's only checked because the profile
    // grants it silently no-ops on the first click (it "flips" an implicit
    // false to true instead of the visible true to false).
    const base = profilePermissions?.[mod] ?? { read: false, create: false, update: false, delete: false };
    const effective = { ...base, ...overrides[mod] };
    const next = { ...overrides, [mod]: { ...effective, [action]: !effective[action] } };
    setOverridesDraft(next as Partial<PermissionsMap>);
  };

  const handleSaveOverrides = () => {
    updateMutation.mutate(
      {
        profileId: managerPerm?.profileId ?? null,
        overrides,
      },
      {
        onSuccess: () => {
          setOverridesDraft(null);
        },
      }
    );
  };

  const selectedProfileId = managerPerm?.profileId ?? "__none__";
  const hasDraft = overridesDraft !== null;

  // Compute which cells differ from the profile permissions (to show "modifié" badge)
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

  // What the grid should actually display: the base profile's grant, with any
  // explicit override applied on top. Without this, the grid only ever shows
  // overrides.mod (empty until the admin unchecks something), so picking a
  // profile like "Commercial" left every box unchecked even though the
  // profile already grants several rights — nothing to compare against.
  const effectivePermissions = useMemo(() => {
    const result: Partial<PermissionsMap> = {};
    for (const mod of MODULES) {
      const base = profilePermissions?.[mod] ?? { read: false, create: false, update: false, delete: false };
      const ov = overrides[mod];
      result[mod] = ov ? { ...base, ...ov } : base;
    }
    return result;
  }, [profilePermissions, overrides]);

  if (isLoading) {
    return <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 pt-3">
      {/* Explanation — how the two layers below combine */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Ce Manager reçoit d'abord les droits du <strong>profil de base</strong> choisi ci-dessous. Vous pouvez ensuite
          cocher ou décocher des cases individuellement dans la grille : ces changements deviennent des{" "}
          <strong>ajustements personnels</strong> (marqués « modifié ») qui prennent le pas sur le profil, uniquement
          pour cet utilisateur.
        </p>
      </div>

      {/* Profile selector */}
      <div className="flex items-center gap-3">
        <Label className="w-32 shrink-0 text-sm font-medium">Profil de base</Label>
        <Select value={selectedProfileId} onValueChange={handleProfileChange} disabled={updateMutation.isPending}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Aucun profil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Aucun profil (aucun droit)</SelectItem>
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
        <PermissionsGrid value={effectivePermissions} onToggle={toggleOverride} isCustomized={isCustomized} />
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

// ─── Profile Editor (create + edit permissions) ─────────────────────────────

function ProfileEditor({
  profile,
  onDone,
}: {
  profile: PermissionProfile | null; // null = creating a new profile
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  // Merge onto EMPTY_PERMISSIONS rather than trusting the saved shape as-is —
  // a profile saved before a module was added to MODULES won't have an entry
  // for it, and toggling that module would otherwise spread `undefined`.
  const [permissions, setPermissions] = useState<PermissionsMap>(() => ({
    ...EMPTY_PERMISSIONS,
    ...profile?.permissions,
  }));

  const saveMutation = useMutation({
    mutationFn: () =>
      profile
        ? permissionProfilesApi.update(profile.id, { name, description: description || undefined, permissions })
        : permissionProfilesApi.create({ name, description: description || undefined, permissions }),
    onSuccess: () => {
      toast.success(profile ? "Profil mis à jour" : "Profil créé");
      void qc.invalidateQueries({ queryKey: ["permission-profiles"] });
      onDone();
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  function toggle(mod: (typeof MODULES)[number], action: keyof PermissionsMap[typeof mod]) {
    setPermissions((prev) => {
      const current = prev[mod] ?? EMPTY_PERMISSIONS[mod];
      return { ...prev, [mod]: { ...current, [action]: !current[action] } };
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label htmlFor="profile-name">Nom du profil</Label>
          <Input id="profile-name" placeholder="Ex : Chef de projet" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="profile-desc">Description (optionnel)</Label>
          <Input
            id="profile-desc"
            placeholder="À quoi sert ce profil ?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Droits accordés par ce profil</p>
        <PermissionsGrid value={permissions} onToggle={toggle} />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Annuler</Button>
        <Button disabled={!name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {profile ? "Enregistrer" : "Créer le profil"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Profile Manager Dialog ─────────────────────────────────────────────────

function ProfilesManagerDialog() {
  const [open, setOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PermissionProfile | null | "new">(null);
  const qc = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["permission-profiles"],
    queryFn: () => permissionProfilesApi.getAll(),
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => permissionProfilesApi.delete(id),
    onSuccess: () => {
      toast.success("Profil supprimé");
      void qc.invalidateQueries({ queryKey: ["permission-profiles"] });
    },
    onError: () => toast.error("Impossible de supprimer ce profil (il est peut-être assigné à un Manager)"),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setEditingProfile(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Profils de permissions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        {editingProfile !== null ? (
          <>
            <DialogHeader>
              <DialogTitle>{editingProfile === "new" ? "Nouveau profil" : `Modifier « ${editingProfile.name} »`}</DialogTitle>
              <DialogDescription>
                Un profil définit un ensemble de droits que vous pouvez ensuite assigner à un ou plusieurs Managers.
              </DialogDescription>
            </DialogHeader>
            <ProfileEditor
              profile={editingProfile === "new" ? null : editingProfile}
              onDone={() => setEditingProfile(null)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Profils de permissions</DialogTitle>
              <DialogDescription>
                Un profil est un modèle de droits réutilisable (ex : « Chef de projet », « Comptabilité ») que vous
                assignez ensuite à un Manager depuis la liste des utilisateurs. Seuls les Managers utilisent des profils —
                les Admins ont tous les droits, les Clients et Freelancers sont gérés ailleurs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun profil pour le moment.</p>
              ) : (
                profiles.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingProfile(p)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
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
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
              <Button className="gap-1.5" onClick={() => setEditingProfile("new")}>
                <UserPlus className="h-3.5 w-3.5" />
                Nouveau profil
              </Button>
            </DialogFooter>
          </>
        )}
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
}: {
  currentUserId: string;
  users?: AppUser[];
  loadingUsers: boolean;
  invitingUser: boolean;
  updatingUser: boolean;
  deletingUser: boolean;
  inviteUser(input: { name: string; email: string; role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER" }): void;
  updateUser(input: { id: string; data: { name: string; role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER" } }): void;
  deleteUser(id: string): void;
}) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: "ADMIN" | "MANAGER" }>({ name: "", email: "", role: "MANAGER" });
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; role: "ADMIN" | "MANAGER" | "CLIENT" | "FREELANCER" } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [expandedPermissions, setExpandedPermissions] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const staff = users?.filter((u) => u.role === "ADMIN" || u.role === "MANAGER") ?? [];
    if (!search.trim()) return staff;
    const q = search.trim().toLowerCase();
    return staff.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
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
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">Admins &amp; Managers</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Comptes internes avec accès au back-office. Les Clients et Freelancers ne sont pas gérés ici — voir
              respectivement les modules CRM (fiche client) et Talent (candidatures).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
                  <DialogDescription>Envoyer une invitation à un nouvel Admin ou Manager.</DialogDescription>
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
                    <Select value={inviteForm.role} onValueChange={(val) => setInviteForm((s) => ({ ...s, role: val as "ADMIN" | "MANAGER" }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin — accès total</SelectItem>
                        <SelectItem value="MANAGER">Manager — droits selon profil de permissions</SelectItem>
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

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {loadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {search ? "Aucun utilisateur ne correspond à cette recherche." : "Aucun Admin ou Manager pour le moment."}
              </div>
            ) : (
              <div ref={parentRef} className="max-h-[520px] overflow-auto" style={{ scrollbarGutter: "stable" }}>
                {/* Plain divs, not a native <table>, because the rows below are
                    virtualized (position: absolute + translateY). <tr> ignores
                    absolute positioning in real table layout — it silently
                    breaks row placement (a phantom blank row, missing actions)
                    instead of erroring, which is why this used to look fine in
                    the editor but rendered wrong in the browser. */}
                <div className="min-w-[1180px] grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] text-sm sticky top-0 bg-background z-10 border-b">
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Nom</div>
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Email</div>
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Rôle</div>
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Créé le</div>
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Dernière connexion</div>
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Moy. jour</div>
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Moy. semaine</div>
                  <div className="h-10 px-2 flex items-center justify-center font-medium text-muted-foreground">Moy. mois</div>
                  <div className="h-10 px-2 flex items-center justify-end font-medium text-muted-foreground">Actions</div>
                </div>
                <div style={{ height: `${totalSize}px`, position: "relative", minWidth: 1180 }}>
                  {virtualItems.map((v) => {
                    const u = filteredUsers[v.index];
                    if (!u) return null;
                    const isPermExpanded = expandedPermissions === u.id;
                    return (
                      <div
                        key={u.id}
                        className="min-w-[1180px] grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] items-center border-b text-sm hover:bg-muted/50 transition-colors"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${v.size}px`,
                          transform: `translateY(${v.start}px)`,
                        }}
                      >
                        <div className="px-2 py-2 flex justify-center text-center truncate">{u.name}</div>
                        <div className="px-2 py-2 flex justify-center text-center truncate">{u.email}</div>
                        <div className="px-2 py-2 flex flex-col items-center gap-1">
                          <Badge className={getRoleColor(u.role)}>{u.role}</Badge>
                          {u.mustChangePassword && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                                  En attente
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>N'a pas encore effectué sa première connexion</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="px-2 py-2 flex justify-center text-center">{formatDate(u.createdAt)}</div>
                        <div className="px-2 py-2 flex justify-center text-center text-muted-foreground">
                          {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Jamais connecté"}
                        </div>
                        <div className="px-2 py-2 flex justify-center text-center text-muted-foreground">{formatDuration(u.connectedTimeAverages?.today)}</div>
                        <div className="px-2 py-2 flex justify-center text-center text-muted-foreground">{formatDuration(u.connectedTimeAverages?.weekly)}</div>
                        <div className="px-2 py-2 flex justify-center text-center text-muted-foreground">{formatDuration(u.connectedTimeAverages?.monthly)}</div>
                        <div className="px-2 py-2 flex justify-end gap-1">
                          {u.role === "MANAGER" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Configurer les permissions"
                              onClick={() => setExpandedPermissions(isPermExpanded ? null : u.id)}
                            >
                              <ShieldCheck className="h-4 w-4 text-blue-500" />
                            </Button>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button variant="ghost" size="icon" disabled className="opacity-30">
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Les Admins ont automatiquement tous les droits</TooltipContent>
                            </Tooltip>
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
                                      onValueChange={(val) => setEditingUser((s) => s ? { ...s, role: val as "ADMIN" | "MANAGER" } : s)}
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

                          {!canDelete(u.id) && <div className="h-9 w-9" aria-hidden="true" />}
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
                        </div>
                      </div>
                    );
                  })}
                </div>
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
    </TooltipProvider>
  );
});
