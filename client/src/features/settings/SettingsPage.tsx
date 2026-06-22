import React, { Suspense, lazy, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.store";
import { useTheme } from "@/providers/ThemeProvider";
import {
  useUsers,
  useInviteUser,
  useUpdateUser,
  useDeleteUser,
  usePermissions,
} from "@/hooks/useUsers";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import i18n from "@/i18n";
import { toast } from "sonner";

const SettingsUsersTab = lazy(() =>
  import("./tabs/SettingsUsersTab").then((m) => ({ default: m.SettingsUsersTab }))
);
const SettingsJoinRequestsTab = lazy(() =>
  import("./tabs/SettingsJoinRequestsTab").then((m) => ({ default: m.SettingsJoinRequestsTab }))
);
import { SettingsProfileTab } from "./tabs/SettingsProfileTab";
import { SettingsAppearanceTab } from "./tabs/SettingsAppearanceTab";

export function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState(i18n.language);

  // Users state
  const { data: users, isLoading: loadingUsers } = useUsers();
  const { mutate: inviteUser, isPending: invitingUser } = useInviteUser();
  const { mutate: updateUser, isPending: updatingUser } = useUpdateUser();
  const { mutate: deleteUser, isPending: deletingUser } = useDeleteUser();
  const { data: permissions } = usePermissions();

  const handleSavePrimaryColor = useCallback((color: string) => {
    localStorage.setItem("companyColor", color);
    toast.success(t("toasts.platformColorSaved"));
  }, [t]);

  const handleLangChange = useCallback((newLang: string) => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem("lang", newLang);
  }, []);

  const isAdmin = user?.role === "ADMIN";
  const currentUserId = user?.id ?? "";

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.description")}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-4">
          <TabsTrigger value="profile">{t("settingsTabs.profile")}</TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="users">{t("settingsTabs.users")}</TabsTrigger>
              <TabsTrigger value="requests">{t("settingsTabs.requests")}</TabsTrigger>
            </>
          )}
          <TabsTrigger value="appearance">{t("settingsTabs.appearance")}</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <SettingsProfileTab name={user?.name} email={user?.email} />
        </TabsContent>

        {/* Users Tab (ADMIN only) */}
        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            <Suspense
              fallback={
                <Card>
                  <CardContent className="py-10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </CardContent>
                </Card>
              }
            >
              <SettingsUsersTab
                currentUserId={currentUserId}
                users={users}
                loadingUsers={loadingUsers}
                invitingUser={invitingUser}
                updatingUser={updatingUser}
                deletingUser={deletingUser}
                inviteUser={(input) => inviteUser(input as any)}
                updateUser={(input) => updateUser(input as any)}
                deleteUser={(id) => deleteUser(id)}
                permissions={permissions as any}
              />
            </Suspense>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="requests" className="space-y-4">
            <Suspense
              fallback={
                <Card>
                  <CardContent className="py-10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </CardContent>
                </Card>
              }
            >
              <SettingsJoinRequestsTab />
            </Suspense>
          </TabsContent>
        )}

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4">
          <SettingsAppearanceTab
            theme={theme}
            setTheme={setTheme}
            lang={lang}
            onLangChange={handleLangChange}
            onSavePrimaryColor={handleSavePrimaryColor}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
