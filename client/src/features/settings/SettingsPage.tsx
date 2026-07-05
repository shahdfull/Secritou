import React, { Suspense, lazy, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  Globe,
} from "lucide-react";
import i18n from "@/i18n";
import { toast } from "sonner";

const SettingsUsersTab = lazy(() =>
  import("./tabs/SettingsUsersTab").then((m) => ({ default: m.SettingsUsersTab }))
);
const SettingsJoinRequestsTab = lazy(() =>
  import("./tabs/SettingsJoinRequestsTab").then((m) => ({ default: m.SettingsJoinRequestsTab }))
);
const SettingsSiteContentTab = lazy(() =>
  import("./tabs/SettingsSiteContentTab").then((m) => ({ default: m.SettingsSiteContentTab }))
);
import { SettingsProfileTab } from "./tabs/SettingsProfileTab";
import { SettingsAppearanceTab } from "./tabs/SettingsAppearanceTab";
const FreelancerProfileTab = lazy(() =>
  import("./tabs/FreelancerProfileTab").then((m) => ({ default: m.FreelancerProfileTab }))
);

export function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState(i18n.language);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  // Users state
  const { data: users, isLoading: loadingUsers, isError: usersError } = useUsers();
  const { mutate: inviteUser, isPending: invitingUser } = useInviteUser();
  const { mutate: updateUser, isPending: updatingUser } = useUpdateUser();
  const { mutate: deleteUser, isPending: deletingUser } = useDeleteUser();
  const { data: permissions, isError: permissionsError } = usePermissions();

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
  const isFreelancer = user?.role === "FREELANCER";
  const currentUserId = user?.id ?? "";

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.description")}</p>
      </div>

      <Tabs defaultValue={tabParam ?? "profile"}>
        <TabsList className={`grid w-full ${isAdmin ? "grid-cols-3 md:grid-cols-5" : isFreelancer ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="profile">{t("settingsTabs.profile")}</TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="users">{t("settingsTabs.users")}</TabsTrigger>
              <TabsTrigger value="requests">{t("settingsTabs.requests")}</TabsTrigger>
              <TabsTrigger value="site-content" className="gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Site vitrine
              </TabsTrigger>
            </>
          )}
          {isFreelancer && (
            <TabsTrigger value="freelancer-profile">Mon profil</TabsTrigger>
          )}
          <TabsTrigger value="appearance">{t("settingsTabs.appearance")}</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <SettingsProfileTab name={user?.name} email={user?.email} />
        </TabsContent>

        {/* Freelancer Profile Tab */}
        {isFreelancer && (
          <TabsContent value="freelancer-profile" className="space-y-4">
            <Suspense fallback={<Card><CardContent className="py-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>}>
              <FreelancerProfileTab />
            </Suspense>
          </TabsContent>
        )}

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
              {usersError || permissionsError ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    {t("common.error")}
                  </CardContent>
                </Card>
              ) : (
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
              )}
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

        {/* Site vitrine CMS Tab (ADMIN only) */}
        {isAdmin && (
          <TabsContent value="site-content" className="space-y-4">
            <Suspense
              fallback={
                <Card>
                  <CardContent className="py-10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </CardContent>
                </Card>
              }
            >
              <SettingsSiteContentTab />
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
