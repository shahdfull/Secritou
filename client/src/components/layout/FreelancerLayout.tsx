import { memo, useCallback, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarHeader,
} from "@/components/ui/sidebar";
import logoAsset from "@/assets/secritou-logo.png";
import { Home, FolderOpen, CheckSquare, Files, Settings, LogOut } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth.store";
import { useLogout } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { useTranslation } from "react-i18next";

const NAV_ITEMS = [
  { key: "freelancerDashboard", url: "/app/freelancer-dashboard", icon: Home },
  { key: "projects",            url: "/app/projects",             icon: FolderOpen },
  { key: "tasks",               url: "/app/tasks",                icon: CheckSquare },
  { key: "documents",           url: "/app/documents",            icon: Files },
  { key: "settings",            url: "/app/settings",             icon: Settings },
] as const;

export const FreelancerLayout = memo(function FreelancerLayout() {
  const user = useAuthStore((s) => s.user);
  const { mutate: logout, isPending } = useLogout();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }, [user?.name]);

  const handleLogout = useCallback(() => {
    logout(undefined, { onSuccess: () => navigate("/login") });
  }, [logout, navigate]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-ink",
    ].join(" ");

  return (
    <SidebarProvider defaultOpen={true}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        {t("a11y.skipToContent")}
      </a>
      <div className="flex h-screen-safe w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-border bg-surface-warm w-56 shrink-0">
          <SidebarHeader className="px-5 py-4 border-b border-border bg-surface-warm">
            <div className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
              <img src={logoAsset} alt="Secritou" className="h-7 w-7 object-contain" loading="lazy" />
              Secritou
            </div>
          </SidebarHeader>

          <SidebarContent className="flex-1 px-3 py-4 bg-surface-warm">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={false} className="p-0 h-auto hover:bg-transparent">
                        <NavLink
                          to={item.url}
                          end={item.url === "/app/freelancer-dashboard"}
                          className={navLinkClass}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{t(`sidebar.${item.key}`)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border px-3 py-3 bg-surface-warm">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full rounded-lg px-2 py-2 hover:bg-muted transition-colors text-left">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate leading-tight">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate leading-tight">{user?.email}</p>
                  </div>
                  <svg className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="5" r="1" fill="currentColor" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                    <circle cx="12" cy="19" r="1" fill="currentColor" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
                <DropdownMenuLabel>{t("userMenu.myAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t("userMenu.settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={isPending} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  {isPending ? t("userMenu.loggingOut") : t("userMenu.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-5 gap-4">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <Avatar className="h-8 w-8 cursor-pointer" onClick={() => navigate("/app/settings")}>
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main id="main" className="flex-1 overflow-auto p-6 bg-surface-warm/10">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
});
