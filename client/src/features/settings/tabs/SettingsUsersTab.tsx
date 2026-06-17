import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserPlus, Edit, Trash2 } from "lucide-react";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const getRoleColor = (role: string) => {
  switch (role) {
    case "ADMIN":
      return "bg-red-100 text-red-800";
    case "MANAGER":
      return "bg-blue-100 text-blue-800";
    case "CLIENT":
      return "bg-green-100 text-green-800";
    case "FREELANCER":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

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

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: users?.length ?? 0,
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

  const permissionRows = useMemo(() => Object.entries(permissions ?? {}), [permissions]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Users</h2>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>Send an invitation to a new user</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <Label htmlFor="invite-name">Name</Label>
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
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteForm.role} onValueChange={(val) => setInviteForm((s) => ({ ...s, role: val as any }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="FREELANCER">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={invitingUser}>
                  {invitingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <tr>
                    <td colSpan={5} style={{ height: `${totalSize}px`, position: "relative" }} />
                  </tr>
                  {virtualItems.map((v) => {
                    const u = users?.[v.index];
                    if (!u) return null;
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
                        <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right flex justify-end gap-2">
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
                                <DialogTitle>Edit User</DialogTitle>
                                <DialogDescription>Update user information</DialogDescription>
                              </DialogHeader>
                              {editingUser?.id === u.id && (
                                <form onSubmit={handleEditSubmit} className="space-y-4">
                                  <div>
                                    <Label htmlFor="edit-name">Name</Label>
                                    <Input
                                      id="edit-name"
                                      value={editingUser.name}
                                      onChange={(e) => setEditingUser((s) => (s ? { ...s, name: e.target.value } : s))}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-role">Role</Label>
                                    <Select
                                      value={editingUser.role}
                                      onValueChange={(val) => setEditingUser((s) => (s ? { ...s, role: val } : s))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="MANAGER">Manager</SelectItem>
                                        <SelectItem value="CLIENT">Client</SelectItem>
                                        <SelectItem value="FREELANCER">Freelancer</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" type="button" onClick={() => setEditingUser(null)}>
                                      Cancel
                                    </Button>
                                    <Button type="submit" disabled={updatingUser}>
                                      {updatingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                      Save
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
                                  <DialogTitle>Delete User</DialogTitle>
                                  <DialogDescription>Are you sure you want to delete this user?</DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline" type="button" onClick={() => setDeleteDialogOpen(null)}>
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    type="button"
                                    onClick={() => {
                                      deleteUser(u.id);
                                      setDeleteDialogOpen(null);
                                    }}
                                    disabled={deletingUser}
                                  >
                                    {deletingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Delete
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

      {permissions && (
        <Card>
          <CardHeader>
            <CardTitle>Permissions Matrix</CardTitle>
            <CardDescription>Permissions per role</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissionRows.map(([role, perms]) => (
                  <TableRow key={role}>
                    <TableCell className="font-medium">{role}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {perms.map((perm) => (
                          <Badge key={perm} variant="outline">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

